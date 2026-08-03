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

function stubFetch(
  response: { ok?: boolean; version?: string; minVersion?: string | null } | Error,
) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response
    return {
      ok: response.ok ?? true,
      json: async () => ({ version: response.version, minVersion: response.minVersion ?? null }),
    }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** A floor no released version will ever reach: whatever runs is below it. */
const FORCING_MIN_VERSION = '99.0.0'

/** Service worker still downloading its precache: it never reaches `installed` on its own. */
function createInstallingWorker() {
  const target = new EventTarget()
  return {
    state: 'installing' as ServiceWorkerState,
    postMessage: vi.fn(),
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    transitionTo(state: ServiceWorkerState) {
      this.state = state
      target.dispatchEvent(new Event('statechange'))
    },
  }
}

type InstallingWorker = ReturnType<typeof createInstallingWorker>

/** Waiting service worker whose postMessage triggers `controllerchange`. */
function stubServiceWorker(
  options: {
    waiting?: boolean
    cooperative?: boolean
    controlled?: boolean
    installing?: InstallingWorker
  } = {},
) {
  const container = new EventTarget()
  const registrationEvents = new EventTarget()
  const postMessage = vi.fn(() => {
    if (options.cooperative !== false) container.dispatchEvent(new Event('controllerchange'))
  })
  const registration = {
    waiting: options.waiting === false ? null : { postMessage },
    installing: options.installing ?? null,
    update: vi.fn(async () => {}),
    addEventListener: registrationEvents.addEventListener.bind(registrationEvents),
  }
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      // Truthy unless stated otherwise: a page under an active worker is the case
      // that can be served a stale bundle, and the one all of this guards against.
      controller: options.controlled === false ? null : {},
      addEventListener: container.addEventListener.bind(container),
      removeEventListener: container.removeEventListener.bind(container),
      getRegistration: async () => registration,
    },
    writable: true,
    configurable: true,
  })
  return { registration, postMessage, container }
}

/** Brings an installing worker to `installed`, which is when it becomes the waiting one. */
function finishInstall(
  stub: ReturnType<typeof stubServiceWorker>,
  worker: InstallingWorker,
): ReturnType<typeof vi.fn> {
  const postMessage = vi.fn(() => stub.container.dispatchEvent(new Event('controllerchange')))
  stub.registration.waiting = { postMessage }
  worker.transitionTo('installed')
  return postMessage
}

/** State is module-level: reloading the module isolates each test. */
async function loadModule(): Promise<UpdateModule> {
  vi.resetModules()
  return import('../pwa.update')
}

describe('pwa.update', () => {
  beforeEach(() => {
    stubLocation()
    sessionStorage.clear()
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    Reflect.deleteProperty(navigator, 'serviceWorker')
    sessionStorage.clear()
    localStorage.clear()
  })

  describe('confirmation post-mise à jour', () => {
    it("ne dit rien au tout premier lancement", async () => {
      const { consumeUpdateConfirmation } = await loadModule()

      expect(consumeUpdateConfirmation()).toBeNull()
      expect(localStorage.getItem('skol.lastVersion')).toBe(__APP_VERSION__)
    })

    it('ne dit rien quand la version n’a pas bougé', async () => {
      localStorage.setItem('skol.lastVersion', __APP_VERSION__)
      const { consumeUpdateConfirmation } = await loadModule()

      expect(consumeUpdateConfirmation()).toBeNull()
    })

    it('annonce la nouvelle version après un changement', async () => {
      localStorage.setItem('skol.lastVersion', '0.0.1')
      const { consumeUpdateConfirmation } = await loadModule()

      expect(consumeUpdateConfirmation()).toBe(__APP_VERSION__)
      expect(localStorage.getItem('skol.lastVersion')).toBe(__APP_VERSION__)
    })

    it('ne se répète pas au lancement suivant', async () => {
      localStorage.setItem('skol.lastVersion', '0.0.1')
      const { consumeUpdateConfirmation } = await loadModule()

      expect(consumeUpdateConfirmation()).toBe(__APP_VERSION__)
      expect(consumeUpdateConfirmation()).toBeNull()
    })

    it('annonce aussi une mise à jour obligatoire', async () => {
      // L'écran bloquant de l'aller dit qu'une version est *exigée*, pas qu'elle est
      // installée, et il peut ne durer que le plancher de 1,5 s : sans ça, la page a
      // rechargé sous les pieds de l'utilisateur sans explication.
      localStorage.setItem('skol.lastVersion', '0.0.1')
      stubFetch({ version: __APP_VERSION__, minVersion: __APP_VERSION__ })
      const { checkVersion, consumeUpdateConfirmation } = await loadModule()
      await checkVersion()

      expect(consumeUpdateConfirmation()).toBe(__APP_VERSION__)
    })

    it("tient l'écran le temps de le lire, puis rend la main", async () => {
      localStorage.setItem('skol.lastVersion', '0.0.1')
      vi.useFakeTimers()
      const { announceUpdate, usePWAUpdate } = await loadModule()
      const { confirmedVersion, updatePhase, overlayVisible } = usePWAUpdate()

      const announced = announceUpdate()
      await vi.advanceTimersByTimeAsync(0)
      expect(confirmedVersion.value).toBe(__APP_VERSION__)
      expect(updatePhase.value).toBe('done')
      expect(overlayVisible.value).toBe(true)

      await vi.advanceTimersByTimeAsync(3500)
      await announced

      expect(confirmedVersion.value).toBeNull()
      expect(overlayVisible.value).toBe(false)
    })
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

    it('lance le téléchargement du nouveau worker dès la détection, une seule fois', async () => {
      // Sans ce préchargement, le download ne démarre qu'au moment d'appliquer et
      // l'utilisateur attend devant l'overlay ce qu'il aurait pu attendre en fond.
      const { registration } = stubServiceWorker()
      stubFetch({ version: '99.0.0' })
      const { checkVersion } = await loadModule()

      await checkVersion()
      await checkVersion()
      await vi.waitFor(() => expect(registration.update).toHaveBeenCalledTimes(1))
    })

    it('abandonne après deux rechargements infructueux sur la même version', async () => {
      sessionStorage.setItem(
        'skol.updateReloads',
        JSON.stringify({ version: '99.0.0', count: 2 }),
      )
      stubFetch({ version: '99.0.0' })
      const { checkVersion, isUpdatePending } = await loadModule()

      expect(await checkVersion()).toBe(false)
      expect(isUpdatePending()).toBe(false)
    })

    it('efface le compteur de rechargements dès que la version servie est atteinte', async () => {
      sessionStorage.setItem(
        'skol.updateReloads',
        JSON.stringify({ version: __APP_VERSION__, count: 2 }),
      )
      stubFetch({ version: __APP_VERSION__ })
      const { checkVersion } = await loadModule()

      await checkVersion()
      expect(sessionStorage.getItem('skol.updateReloads')).toBeNull()
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

  describe('progression du précache', () => {
    it('suit les messages du worker sans jamais reculer', async () => {
      const { container } = stubServiceWorker()
      const { usePWAUpdate } = await loadModule()
      const { downloadProgress, downloadDone, downloadTotal } = usePWAUpdate()

      expect(downloadProgress.value).toBeNull()

      container.dispatchEvent(
        new MessageEvent('message', { data: { type: 'PRECACHE_PROGRESS', done: 30, total: 120 } }),
      )
      expect(downloadProgress.value).toBe(0.25)
      expect(downloadDone.value).toBe(30)
      expect(downloadTotal.value).toBe(120)

      // Un worker qui relance son install repart de zéro : la barre, elle, ne recule pas.
      container.dispatchEvent(
        new MessageEvent('message', { data: { type: 'PRECACHE_PROGRESS', done: 2, total: 120 } }),
      )
      expect(downloadProgress.value).toBe(0.25)
      expect(downloadDone.value).toBe(30)
    })
  })

  describe('mise à jour obligatoire', () => {
    it('force quand la version tourne sous le plancher servi', async () => {
      stubFetch({ version: '99.9.9', minVersion: FORCING_MIN_VERSION })
      stubServiceWorker()
      const { checkVersion, isUpdateForcedPending } = await loadModule()

      expect(await checkVersion()).toBe(true)
      expect(isUpdateForcedPending()).toBe(true)
    })

    it('reste en arrière-plan sans plancher', async () => {
      stubFetch({ version: '99.9.9' })
      stubServiceWorker()
      const { checkVersion, isUpdateForcedPending } = await loadModule()

      expect(await checkVersion()).toBe(true)
      expect(isUpdateForcedPending()).toBe(false)
    })

    it('reste en arrière-plan quand le plancher est déjà atteint', async () => {
      stubFetch({ version: '99.9.9', minVersion: '0.0.1' })
      stubServiceWorker()
      const { checkVersion, isUpdateForcedPending } = await loadModule()

      await checkVersion()
      expect(isUpdateForcedPending()).toBe(false)
    })

    it('ne force pas une version qui a déjà échoué à s’installer', async () => {
      // Le coupe-circuit passe avant : sinon l'utilisateur reste enfermé derrière une
      // mise à jour qui ne prendra jamais.
      sessionStorage.setItem(
        'skol.updateReloads',
        JSON.stringify({ version: '99.9.9', count: 2 }),
      )
      stubFetch({ version: '99.9.9', minVersion: FORCING_MIN_VERSION })
      stubServiceWorker()
      const { checkVersion, isUpdateForcedPending } = await loadModule()

      expect(await checkVersion()).toBe(false)
      expect(isUpdateForcedPending()).toBe(false)
    })

    it('ignore la demande de report', async () => {
      stubFetch({ version: '99.9.9', minVersion: FORCING_MIN_VERSION })
      stubServiceWorker()
      const { checkVersion, dismissUpdate, isUpdateDeferred } = await loadModule()
      await checkVersion()

      dismissUpdate()

      expect(isUpdateDeferred()).toBe(false)
    })

    it('attend le téléchargement bien au-delà du budget de routine', async () => {
      const installing = createInstallingWorker()
      stubFetch({ version: '99.9.9', minVersion: FORCING_MIN_VERSION })
      const stub = stubServiceWorker({ waiting: false, installing })
      const location = stubLocation()
      const { checkVersion, applyUpdate } = await loadModule()
      await checkVersion()
      vi.useFakeTimers()

      const applied = applyUpdate('/tournaments/42')
      let settled = false
      void applied.then(() => (settled = true))

      // Là où une release de routine aurait déjà rendu la main.
      await vi.advanceTimersByTimeAsync(10_000)
      expect(settled).toBe(false)

      const postMessage = finishInstall(stub, installing)
      await vi.advanceTimersByTimeAsync(1500)

      expect(await applied).toBe(true)
      expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
      expect(location.href).toBe(`${ORIGIN}/tournaments/42`)
    })

    it("libère l'app quand le téléchargement échoue vraiment, sans reboucler", async () => {
      // Le seul échappatoire d'une mise à jour obligatoire : hors-ligne, l'app doit
      // rester utilisable au lieu d'être condamnée.
      const installing = createInstallingWorker()
      stubFetch({ version: '99.9.9', minVersion: FORCING_MIN_VERSION })
      stubServiceWorker({ waiting: false, installing })
      const location = stubLocation()
      const { checkVersion, applyUpdate, isUpdateDeferred } = await loadModule()
      await checkVersion()
      vi.useFakeTimers()

      const applied = applyUpdate('/tournaments/42')
      await vi.advanceTimersByTimeAsync(120_000)

      expect(await applied).toBe(false)
      expect(isUpdateDeferred()).toBe(true)
      expect(location.reload).not.toHaveBeenCalled()

      // Une navigation suivante ne doit pas relancer la même attente.
      expect(await applyUpdate('/tournaments/43')).toBe(false)
      expect(location.href).toBe(`${ORIGIN}/`)
    })
  })

  describe('mise à jour de routine', () => {
    it('signale le bundle prêt dès que le précache de fond se termine', async () => {
      // Régression : sans ce signal, une release de routine n'atterrissait qu'au
      // prochain démarrage à froid — la garde du routeur n'apprenait jamais que le
      // worker était en attente.
      const installing = createInstallingWorker()
      stubFetch({ version: '99.9.9' })
      const stub = stubServiceWorker({ waiting: false, installing })
      const { checkVersion, isUpdateReady } = await loadModule()

      await checkVersion()
      expect(isUpdateReady()).toBe(false)

      finishInstall(stub, installing)
      await Promise.resolve()
      await Promise.resolve()

      expect(isUpdateReady()).toBe(true)
    })

    it('rend la main vite quand le bundle tarde, sans annuler le téléchargement', async () => {
      const installing = createInstallingWorker()
      stubFetch({ version: '99.9.9' })
      const stub = stubServiceWorker({ waiting: false, installing })
      const { checkVersion, applyUpdate, isUpdateReady } = await loadModule()
      await checkVersion()
      vi.useFakeTimers()

      const applied = applyUpdate('/tournaments/42')
      await vi.advanceTimersByTimeAsync(8000)

      expect(await applied).toBe(false)
      expect(isUpdateReady()).toBe(false)

      // L'install continue derrière : la prochaine navigation appliquera pour un
      // simple reload.
      finishInstall(stub, installing)
      await vi.advanceTimersByTimeAsync(0)
      expect(isUpdateReady()).toBe(true)
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

      expect(await applied).toBe(true)
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

    it('recharge malgré tout si le worker en attente ne rend jamais la main', async () => {
      stubServiceWorker({ cooperative: false })
      const location = stubLocation()
      vi.useFakeTimers()
      const { applyUpdate } = await loadModule()

      const applied = applyUpdate('/tournaments/42')
      // Handover budget, puis le plancher d'affichage qui court derrière.
      await vi.advanceTimersByTimeAsync(6500)
      await applied

      expect(location.href).toBe(`${ORIGIN}/tournaments/42`)
    })

    it("ne recharge jamais tant que l'ancien worker contrôle encore la page", async () => {
      // Régression : recharger ici renvoie l'ancien bundle depuis le précache, donc
      // un nouveau mismatch de version, donc un nouvel overlay — la boucle infinie.
      const installing = createInstallingWorker()
      stubServiceWorker({ waiting: false, installing })
      const location = stubLocation()
      vi.useFakeTimers()
      const { applyUpdate, usePWAUpdate } = await loadModule()
      const { updatePhase } = usePWAUpdate()

      const applied = applyUpdate('/tournaments/42')
      await vi.advanceTimersByTimeAsync(10)
      expect(updatePhase.value).toBe('downloading')

      await vi.advanceTimersByTimeAsync(120_000)

      expect(await applied).toBe(false)
      expect(location.reload).not.toHaveBeenCalled()
      expect(location.href).toBe(`${ORIGIN}/`)
    })

    it('rend la main sans bloquer quand le worker échoue son installation', async () => {
      const installing = createInstallingWorker()
      stubServiceWorker({ waiting: false, installing })
      const location = stubLocation()
      const { applyUpdate } = await loadModule()

      const applied = applyUpdate('/tournaments/42')
      await Promise.resolve()
      installing.transitionTo('redundant')

      expect(await applied).toBe(false)
      expect(location.reload).not.toHaveBeenCalled()
    })

    it('applique dès que le worker en cours de téléchargement est installé', async () => {
      const installing = createInstallingWorker()
      const stub = stubServiceWorker({ waiting: false, installing })
      const location = stubLocation()
      vi.useFakeTimers()
      const { applyUpdate } = await loadModule()

      const applied = applyUpdate('/tournaments/42')
      await vi.advanceTimersByTimeAsync(10)
      const postMessage = finishInstall(stub, installing)
      await vi.advanceTimersByTimeAsync(1500)

      expect(await applied).toBe(true)
      expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
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

  describe('dismissUpdate', () => {
    it("masque l'overlay et laisse la page en place quand le download se termine", async () => {
      const installing = createInstallingWorker()
      const stub = stubServiceWorker({ waiting: false, installing })
      const location = stubLocation()
      vi.useFakeTimers()
      const { applyUpdate, dismissUpdate, usePWAUpdate } = await loadModule()
      const { overlayVisible } = usePWAUpdate()

      const applied = applyUpdate('/tournaments/42')
      await vi.advanceTimersByTimeAsync(10)
      expect(overlayVisible.value).toBe(true)

      dismissUpdate()
      expect(overlayVisible.value).toBe(false)

      finishInstall(stub, installing)
      await vi.advanceTimersByTimeAsync(2000)

      expect(await applied).toBe(false)
      expect(location.reload).not.toHaveBeenCalled()
      expect(location.href).toBe(`${ORIGIN}/`)
    })

    it('applique à la navigation suivante, une fois le worker prêt', async () => {
      const installing = createInstallingWorker()
      const stub = stubServiceWorker({ waiting: false, installing })
      const location = stubLocation()
      vi.useFakeTimers()
      const { applyUpdate, dismissUpdate, isUpdateReady } = await loadModule()

      const deferredRun = applyUpdate('/tournaments/42')
      await vi.advanceTimersByTimeAsync(10)
      dismissUpdate()
      finishInstall(stub, installing)
      await vi.advanceTimersByTimeAsync(2000)
      await deferredRun
      expect(isUpdateReady()).toBe(true)

      const applied = applyUpdate('/tournaments/7')
      await vi.advanceTimersByTimeAsync(1500)

      expect(await applied).toBe(true)
      expect(location.href).toBe(`${ORIGIN}/tournaments/7`)
    })

    it('ne bloque plus la navigation tant que le worker traîne', async () => {
      const installing = createInstallingWorker()
      stubServiceWorker({ waiting: false, installing })
      stubLocation()
      vi.useFakeTimers()
      const { applyUpdate, dismissUpdate } = await loadModule()

      const deferredRun = applyUpdate('/tournaments/42')
      await vi.advanceTimersByTimeAsync(10)
      dismissUpdate()
      await vi.advanceTimersByTimeAsync(120_000)
      await deferredRun

      expect(await applyUpdate('/tournaments/7')).toBe(false)
    })

    it("repart tout seul quand le worker atterrit longtemps après l'abandon", async () => {
      // Un worker qui finit son install reste en `waiting` indéfiniment : rien ne
      // signale l'arrivée du nouveau bundle si on a cessé de la guetter.
      const installing = createInstallingWorker()
      const stub = stubServiceWorker({ waiting: false, installing })
      const location = stubLocation()
      vi.useFakeTimers()
      const { applyUpdate, dismissUpdate, isUpdateReady } = await loadModule()

      const abandoned = applyUpdate('/tournaments/42')
      await vi.advanceTimersByTimeAsync(10)
      dismissUpdate()
      await vi.advanceTimersByTimeAsync(120_000)
      await abandoned
      expect(isUpdateReady()).toBe(false)

      finishInstall(stub, installing)
      await vi.advanceTimersByTimeAsync(0)
      expect(isUpdateReady()).toBe(true)

      const applied = applyUpdate('/tournaments/7')
      await vi.advanceTimersByTimeAsync(1500)

      expect(await applied).toBe(true)
      expect(location.href).toBe(`${ORIGIN}/tournaments/7`)
    })
  })
})
