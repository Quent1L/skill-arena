import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

type UpdateModule = typeof import('../pwa.update')

const ORIGIN = 'http://localhost:3000'

function stubLocation() {
  const location = { href: `${ORIGIN}/`, origin: ORIGIN, reload: vi.fn() }
  Object.defineProperty(window, 'location', {
    value: location,
    writable: true,
    configurable: true,
  })
  return location
}

function stubFetch(response: { ok?: boolean; version?: string } | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response
    return {
      ok: response.ok ?? true,
      json: async () => ({ version: response.version }),
    }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Waiting service worker whose postMessage triggers `controllerchange`. */
function stubServiceWorker(options: { waiting?: boolean; cooperative?: boolean } = {}) {
  const target = new EventTarget()
  const postMessage = vi.fn(() => {
    if (options.cooperative !== false) target.dispatchEvent(new Event('controllerchange'))
  })
  const registration = {
    waiting: options.waiting === false ? null : { postMessage },
    installing: null,
    update: vi.fn(async () => {}),
  }
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      getRegistration: async () => registration,
    },
    writable: true,
    configurable: true,
  })
  return { registration, postMessage }
}

/** State is module-level: reloading the module isolates each test. */
async function loadModule(): Promise<UpdateModule> {
  vi.resetModules()
  return import('../pwa.update')
}

describe('pwa.update', () => {
  beforeEach(() => {
    stubLocation()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  describe('checkVersion', () => {
    it('ne signale rien quand la version servie est identique', async () => {
      stubFetch({ version: __APP_VERSION__ })
      const { checkVersion, isUpdatePending } = await loadModule()

      expect(await checkVersion()).toBe(false)
      expect(isUpdatePending()).toBe(false)
    })

    it('signale une mise à jour quand la version diffère', async () => {
      stubFetch({ version: '99.0.0' })
      const { checkVersion, isUpdatePending } = await loadModule()

      expect(await checkVersion()).toBe(true)
      expect(isUpdatePending()).toBe(true)
    })

    it('reste silencieux quand le fetch échoue (hors ligne)', async () => {
      stubFetch(new Error('network down'))
      const { checkVersion, isUpdatePending } = await loadModule()

      expect(await checkVersion()).toBe(false)
      expect(isUpdatePending()).toBe(false)
    })

    it('reste silencieux quand version.json est absent (dev)', async () => {
      stubFetch({ ok: false })
      const { checkVersion, isUpdatePending } = await loadModule()

      expect(await checkVersion()).toBe(false)
      expect(isUpdatePending()).toBe(false)
    })

    it('contourne le cache HTTP', async () => {
      const fetchMock = stubFetch({ version: __APP_VERSION__ })
      const { checkVersion } = await loadModule()
      await checkVersion()

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/version.json?t='),
        expect.objectContaining({ cache: 'no-store' }),
      )
    })
  })

  describe('checkVersionThrottled', () => {
    it('ne refetch pas dans la fenêtre de throttle', async () => {
      const fetchMock = stubFetch({ version: __APP_VERSION__ })
      const { checkVersionThrottled } = await loadModule()

      await checkVersionThrottled()
      await checkVersionThrottled()

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('blockUpdates', () => {
    it('compte les verrous et ignore une double libération', async () => {
      const { blockUpdates, updatesBlocked } = await loadModule()

      const releaseFirst = blockUpdates()
      const releaseSecond = blockUpdates()
      expect(updatesBlocked()).toBe(true)

      releaseFirst()
      releaseFirst()
      expect(updatesBlocked()).toBe(true)

      releaseSecond()
      expect(updatesBlocked()).toBe(false)
    })
  })

  describe('applyUpdate', () => {
    it('demande au worker en attente de prendre la main, puis recharge', async () => {
      const { postMessage } = stubServiceWorker()
      const location = stubLocation()
      vi.useFakeTimers()
      const { applyUpdate } = await loadModule()

      const applied = applyUpdate('/tournaments/42')
      await vi.advanceTimersByTimeAsync(1500)
      await applied

      expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
      expect(location.href).toBe(`${ORIGIN}/tournaments/42`)
    })

    it("recharge la page courante quand aucune destination n'est fournie", async () => {
      stubServiceWorker()
      const location = stubLocation()
      vi.useFakeTimers()
      const { applyUpdate } = await loadModule()

      const applied = applyUpdate()
      await vi.advanceTimersByTimeAsync(1500)
      await applied

      expect(location.reload).toHaveBeenCalled()
    })

    it("laisse le temps de lire l'overlay avant de recharger", async () => {
      stubServiceWorker()
      const location = stubLocation()
      vi.useFakeTimers()
      const { applyUpdate } = await loadModule()

      const applied = applyUpdate('/tournaments/42')
      await vi.advanceTimersByTimeAsync(1400)
      expect(location.href).toBe(`${ORIGIN}/`)

      await vi.advanceTimersByTimeAsync(100)
      await applied
      expect(location.href).toBe(`${ORIGIN}/tournaments/42`)
    })

    it('revalide le worker avant de lui passer la main', async () => {
      // A waiting worker may be left over from an earlier deployment: activating
      // it as-is would strand the app on an intermediate version.
      const { registration, postMessage } = stubServiceWorker({ waiting: true })
      stubLocation()
      vi.useFakeTimers()
      const { applyUpdate } = await loadModule()

      const applied = applyUpdate('/tournaments/42')
      await vi.advanceTimersByTimeAsync(1500)
      await applied

      expect(registration.update).toHaveBeenCalled()
      expect(registration.update.mock.invocationCallOrder[0]).toBeLessThan(
        postMessage.mock.invocationCallOrder[0],
      )
    })

    it('recharge malgré tout si le worker ne rend jamais la main', async () => {
      stubServiceWorker({ cooperative: false })
      const location = stubLocation()
      vi.useFakeTimers()
      const { applyUpdate } = await loadModule()

      const applied = applyUpdate('/tournaments/42')
      await vi.advanceTimersByTimeAsync(3000)
      await applied

      expect(location.href).toBe(`${ORIGIN}/tournaments/42`)
    })

    it("expose isApplying pendant l'opération pour piloter l'overlay", async () => {
      stubServiceWorker()
      stubLocation()
      vi.useFakeTimers()
      const { applyUpdate, usePWAUpdate } = await loadModule()
      const { isApplying } = usePWAUpdate()

      expect(isApplying.value).toBe(false)
      const applied = applyUpdate('/tournaments/42')
      expect(isApplying.value).toBe(true)

      await vi.advanceTimersByTimeAsync(1500)
      await applied
    })
  })
})
