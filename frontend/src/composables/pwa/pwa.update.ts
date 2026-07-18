import { ref, readonly } from 'vue'

/** Minimum time the UpdateOverlay stays up, so it can actually be read. */
export const UPDATE_OVERLAY_MIN_MS = 1500
/** Past this, reload even if the service worker never handed over. */
const APPLY_TIMEOUT_MS = 3000
/** Throttle window for navigation-triggered checks. */
const CHECK_THROTTLE_MS = 60 * 1000

/** A new version is deployed but not applied yet. */
const updatePending = ref(false)
/** Update is being applied: drives the UpdateOverlay. */
const isApplying = ref(false)

/** True once a deployment is detected. Only a reload clears it. */
export function isUpdatePending(): boolean {
  return updatePending.value
}

let lastCheckAt = 0
let blockers = 0

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Races a promise against a delay without rejecting: timing out is a normal outcome. */
function withTimeout(promise: Promise<void>, ms: number): Promise<void> {
  return Promise.race([promise, delay(ms)])
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

    if (data.version !== __APP_VERSION__) updatePending.value = true
    return updatePending.value
  } catch {
    return false
  }
}

/** Throttled variant, for the check fired on every navigation. */
export function checkVersionThrottled(): Promise<boolean> {
  if (Date.now() - lastCheckAt < CHECK_THROTTLE_MS) return Promise.resolve(updatePending.value)
  return checkVersion()
}

function waitForControllerChange(): Promise<void> {
  return new Promise((resolve) => {
    navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
  })
}

/** Waits for a freshly downloaded worker to reach the `installed` state. */
function waitForInstalled(registration: ServiceWorkerRegistration): Promise<ServiceWorker | null> {
  return new Promise((resolve) => {
    const installing = registration.installing
    if (!installing) {
      resolve(registration.waiting)
      return
    }
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') resolve(registration.waiting)
    })
  })
}

/** Asks the waiting worker to take over, and waits until it has. */
async function handOverToNewWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return

  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return

  // Always revalidate, even when a worker is already waiting: it may be left
  // over from an earlier deployment. Letting that one take over would strand us
  // on an intermediate version, permanently out of sync with version.json — and
  // therefore reloading on every navigation.
  await registration.update()

  const waiting = registration.waiting ?? (await waitForInstalled(registration))
  if (!waiting) return

  const controllerChanged = waitForControllerChange()
  waiting.postMessage({ type: 'SKIP_WAITING' })
  await controllerChanged
}

/**
 * Applies the update then reloads, onto `targetUrl` when provided.
 * The reload happens no matter what: even if the worker never cooperated, the
 * assets did change and a network round-trip is enough to get back to a sane state.
 */
export async function applyUpdate(targetUrl?: string): Promise<void> {
  if (isApplying.value) return
  isApplying.value = true

  const target = new URL(targetUrl ?? window.location.href, window.location.origin).href

  // The waiting worker already precached the new assets during the check, so the
  // handover is near-instant: the floor keeps the overlay from just flashing by.
  await Promise.all([
    withTimeout(handOverToNewWorker(), APPLY_TIMEOUT_MS),
    delay(UPDATE_OVERLAY_MIN_MS),
  ])

  if (target === window.location.href) window.location.reload()
  else window.location.href = target
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

export function usePWAUpdate() {
  return {
    updatePending: readonly(updatePending),
    isApplying: readonly(isApplying),
    checkVersion,
    checkVersionThrottled,
    applyUpdate,
    blockUpdates,
    updatesBlocked,
  }
}
