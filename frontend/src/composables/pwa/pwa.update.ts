import { ref, readonly, computed } from 'vue'

/** Minimum time the UpdateOverlay stays up, so it can actually be read. */
export const UPDATE_OVERLAY_MIN_MS = 1500
/** Budget for the handover itself, once a worker is waiting: skipWaiting is instant. */
const HANDOVER_TIMEOUT_MS = 5000
/** Ceiling on how long we wait for a new worker to finish precaching. */
const DOWNLOAD_MAX_MS = 120 * 1000
/** Throttle window for navigation-triggered checks. */
const CHECK_THROTTLE_MS = 60 * 1000
/** Past this many reloads for the same version, stop: something is not converging. */
const MAX_RELOAD_ATTEMPTS = 2
const RELOAD_ATTEMPTS_KEY = 'skol.updateReloads'

/** What the overlay is currently waiting on. */
export type UpdatePhase = 'idle' | 'downloading' | 'applying'

/** A new version is deployed but not applied yet. */
const updatePending = ref(false)
/** Update is being applied: drives the UpdateOverlay. */
const isApplying = ref(false)
/** Downloading the new bundle, or handing over to the worker that already has it. */
const updatePhase = ref<UpdatePhase>('idle')
/**
 * The user asked to keep using the app rather than wait for the download, or the
 * download failed. Either way: stop blocking, apply at the next navigation once
 * the worker is ready.
 */
const deferred = ref(false)
/** The new worker has taken control of the page: the handover is already done. */
const controllerTakenOver = ref(false)
/**
 * A new worker is waiting or already in control: applying now costs a reload and
 * nothing else. Distinct from `controllerTakenOver`, because a worker that reached
 * `waiting` after the user deferred stays there until we ask it to skip — nothing
 * fires on its own to tell us the bundle is ready.
 */
const updateReady = ref(false)
/** Precache progress reported by the installing worker, 0..1, null while unknown. */
const downloadProgress = ref<number | null>(null)

/** The overlay is the apply routine made visible — unless the user waved it away. */
const overlayVisible = computed(() => isApplying.value && !deferred.value)

/** True once a deployment is detected. Only a reload clears it. */
export function isUpdatePending(): boolean {
  return updatePending.value
}

let lastCheckAt = 0
let blockers = 0
let prefetchStarted = false
let pendingVersion: string | null = null

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Races a promise against a delay without rejecting: timing out is a normal outcome. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, delay(ms).then(() => fallback)])
}

function hasServiceWorker(): boolean {
  return 'serviceWorker' in navigator
}

if (hasServiceWorker()) {
  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as { type?: string; done?: number; total?: number } | undefined
    if (data?.type !== 'PRECACHE_PROGRESS' || !data.total) return
    const ratio = Math.min(1, (data.done ?? 0) / data.total)
    // Monotonic: a worker restarting its install must not rewind the bar under
    // the user's eyes.
    downloadProgress.value = Math.max(downloadProgress.value ?? 0, ratio)
  })

  // Catches the handover that completes after the user deferred the update.
  // Gated on a pending update: the very first install also changes the controller,
  // and treating that as "the new bundle is in place" would let a later update
  // reload straight into the stale one.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!updatePending.value) return
    controllerTakenOver.value = true
    updateReady.value = true
  })
}

/* -------------------------------------------------------------------------- */
/* Reload loop breaker                                                         */
/* -------------------------------------------------------------------------- */

type ReloadAttempts = { version: string; count: number }

function readReloadAttempts(): ReloadAttempts | null {
  try {
    const raw = sessionStorage.getItem(RELOAD_ATTEMPTS_KEY)
    return raw ? (JSON.parse(raw) as ReloadAttempts) : null
  } catch {
    return null
  }
}

function recordReloadAttempt(version: string): void {
  try {
    const previous = readReloadAttempts()
    const count = previous?.version === version ? previous.count + 1 : 1
    sessionStorage.setItem(RELOAD_ATTEMPTS_KEY, JSON.stringify({ version, count }))
  } catch {
    // Private mode: the loop breaker is a safety net, never a requirement.
  }
}

function clearReloadAttempts(): void {
  try {
    sessionStorage.removeItem(RELOAD_ATTEMPTS_KEY)
  } catch {
    // See above.
  }
}

/**
 * True when we already reloaded for this exact version and came back on the old
 * one anyway. Reloading again would only replay the same failure, in front of the
 * user, forever.
 */
function reloadLoopDetected(version: string): boolean {
  const attempts = readReloadAttempts()
  return attempts?.version === version && attempts.count >= MAX_RELOAD_ATTEMPTS
}

/* -------------------------------------------------------------------------- */
/* Detection                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Starts the new worker's download as soon as a deployment is detected instead of
 * waiting for applyUpdate: the precache then runs while the user keeps reading the
 * current screen, and the handover is instant when they finally navigate.
 */
async function prefetchUpdate(): Promise<void> {
  if (prefetchStarted || !hasServiceWorker()) return
  prefetchStarted = true
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    await registration?.update()
  } catch {
    // Offline: let the next detection try again.
    prefetchStarted = false
  }
}

/**
 * Compares the served version against the one baked into the bundle. Much
 * faster than `registration.update()`, which has to re-download the worker.
 * Any failure means "no update": the file is absent in dev, and going offline
 * must obviously not trigger anything.
 */
export async function checkVersion(): Promise<boolean> {
  lastCheckAt = Date.now()
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) return false
    const data = (await response.json()) as { version?: string }
    if (!data.version) return false

    if (data.version === __APP_VERSION__) {
      // Running exactly what is served: whatever happened before worked out.
      clearReloadAttempts()
      return updatePending.value
    }

    pendingVersion = data.version
    if (reloadLoopDetected(data.version)) {
      console.warn(
        `[pwa] update to ${data.version} did not stick after ${MAX_RELOAD_ATTEMPTS} reloads, staying on ${__APP_VERSION__}`,
      )
      return false
    }

    updatePending.value = true
    void prefetchUpdate()
    return true
  } catch {
    return false
  }
}

/** Throttled variant, for the check fired on every navigation. */
export function checkVersionThrottled(): Promise<boolean> {
  if (Date.now() - lastCheckAt < CHECK_THROTTLE_MS) return Promise.resolve(updatePending.value)
  return checkVersion()
}

/* -------------------------------------------------------------------------- */
/* Applying                                                                    */
/* -------------------------------------------------------------------------- */

function waitForControllerChange(): Promise<void> {
  return new Promise((resolve) => {
    navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
  })
}

/**
 * Waits for a freshly downloaded worker to reach the `installed` state.
 * Resolves with `null` when the install failed: a redundant worker never reaches
 * `installed`, and waiting for it would hang until the download ceiling.
 */
function waitForInstalled(registration: ServiceWorkerRegistration): Promise<ServiceWorker | null> {
  return new Promise((resolve) => {
    let settled = false
    const settle = (worker: ServiceWorker | null) => {
      if (settled) return
      settled = true
      resolve(worker)
    }

    const track = (worker: ServiceWorker | null | undefined): boolean => {
      if (!worker) return false
      const onStateChange = () => {
        if (worker.state === 'installed' || worker.state === 'activated') {
          settle(registration.waiting ?? null)
        } else if (worker.state === 'redundant') {
          settle(null)
        }
      }
      worker.addEventListener('statechange', onStateChange)
      onStateChange()
      return true
    }

    if (registration.waiting) {
      settle(registration.waiting)
      return
    }
    if (track(registration.installing)) return

    // `update()` can resolve before the browser has created the new worker.
    registration.addEventListener?.('updatefound', () => track(registration.installing))
  })
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!hasServiceWorker()) return null
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null
  } catch {
    return null
  }
}

/**
 * Gets a new worker into control of the page. Returns false when none could take
 * over, which is the one case where reloading must not happen: the page would be
 * served by the very same stale worker and land right back here.
 */
async function prepareWorker(): Promise<boolean> {
  const registration = await getRegistration()
  // Nothing controls the page: the reload goes to the network, no cache can lie.
  if (!registration || !navigator.serviceWorker.controller) return true
  if (controllerTakenOver.value) return true

  updatePhase.value = registration.waiting ? 'applying' : 'downloading'

  // Always revalidate, even when a worker is already waiting: it may be left
  // over from an earlier deployment. Letting that one take over would strand us
  // on an intermediate version, permanently out of sync with version.json — and
  // therefore reloading on every navigation.
  try {
    await registration.update()
  } catch {
    // Unreachable worker script: a worker may still be waiting from before.
  }

  const installed = waitForInstalled(registration)
  // Keep watching past our own ceiling. A worker that lands after we gave up sits
  // in `waiting` forever unless asked to skip, so nothing else would ever tell us
  // the new bundle is downloaded and the next navigation can apply it for free.
  void installed.then((worker) => {
    if (worker) updateReady.value = true
  })

  const waiting = registration.waiting ?? (await withTimeout(installed, DOWNLOAD_MAX_MS, null))
  if (!waiting) return false

  updateReady.value = true
  updatePhase.value = 'applying'
  const controllerChanged = waitForControllerChange()
  waiting.postMessage({ type: 'SKIP_WAITING' })
  // Reload even if the worker never acknowledged: the assets did change and a
  // round-trip is the best shot left. The loop breaker caps how often that repeats.
  await withTimeout(controllerChanged, HANDOVER_TIMEOUT_MS, undefined)
  return true
}

function stopApplying(): void {
  isApplying.value = false
  updatePhase.value = 'idle'
}

/**
 * Applies the update then reloads, onto `targetUrl` when provided.
 * Returns true when a reload was triggered — the caller must then stop, the page
 * is on its way out. Returns false when the app has to stay on the current
 * version: no worker took over, or the user chose to keep browsing.
 */
export async function applyUpdate(targetUrl?: string): Promise<boolean> {
  if (isApplying.value) return false
  // Deferred and still not downloaded: blocking the user again on a download they
  // explicitly skipped would undo their choice.
  if (deferred.value && !updateReady.value) return false

  const deferredAtEntry = deferred.value
  isApplying.value = true
  updatePhase.value = 'applying'

  const target = new URL(targetUrl ?? window.location.href, window.location.origin).href
  const startedAt = Date.now()

  const ready = await prepareWorker()
  if (!ready) {
    // The download never landed. Let the app live on the current version rather
    // than reload into the same stale bundle over and over.
    deferred.value = true
    stopApplying()
    return false
  }

  controllerTakenOver.value = true
  updateReady.value = true

  if (deferred.value && !deferredAtEntry) {
    // The user hit "continue" while we were downloading: the new worker is in
    // place, but yanking the page from under them now would be worse than waiting
    // for their next navigation.
    stopApplying()
    return false
  }

  // The floor keeps the overlay from just flashing by on the fast path.
  await delay(Math.max(0, UPDATE_OVERLAY_MIN_MS - (Date.now() - startedAt)))

  recordReloadAttempt(pendingVersion ?? 'unknown')
  if (target === window.location.href) window.location.reload()
  else window.location.href = target
  return true
}

/**
 * Drops the blocking overlay: the app stays usable on the current version and the
 * update lands at the next navigation, once the new worker is ready.
 */
export function dismissUpdate(): void {
  deferred.value = true
}

/**
 * Holds off applying an update until the lock is released. Meant for forms split
 * across several routes, where navigating does not mean the input is abandoned.
 * Returns the release function.
 */
export function blockUpdates(): () => void {
  blockers += 1
  let released = false
  return () => {
    if (released) return
    released = true
    blockers -= 1
  }
}

export function updatesBlocked(): boolean {
  return blockers > 0
}

/** True when the user (or a failed download) told us to stop blocking the UI. */
export function isUpdateDeferred(): boolean {
  return deferred.value
}

/** True when the new bundle is downloaded: applying costs a reload, nothing more. */
export function isUpdateReady(): boolean {
  return updateReady.value
}

export function usePWAUpdate() {
  return {
    updatePending: readonly(updatePending),
    isApplying: readonly(isApplying),
    updatePhase: readonly(updatePhase),
    downloadProgress: readonly(downloadProgress),
    overlayVisible,
    checkVersion,
    checkVersionThrottled,
    applyUpdate,
    dismissUpdate,
    blockUpdates,
    updatesBlocked,
  }
}
