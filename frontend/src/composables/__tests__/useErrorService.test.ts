import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ToastServiceMethods } from 'primevue/toastservice'
import { NETWORK_ERROR } from '@/utils/HttpErrors'

vi.mock('@/i18n', () => ({
  i18n: { global: { t: (key: string) => key } },
}))

const add = vi.fn()
const toast = { add } as unknown as ToastServiceMethods

async function loadErrorService() {
  vi.resetModules()
  const mod = await import('@/composables/useErrorService')
  mod.initErrorService(toast)
  return mod.errorService
}

beforeEach(() => {
  add.mockReset()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('errorService — serveur injoignable', () => {
  it('remplace le message brut du navigateur par un message explicite', async () => {
    const errorService = await loadErrorService()

    errorService.showError(
      new Error('NetworkError when attempting to fetch resource.', { cause: NETWORK_ERROR }),
    )

    expect(add).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
        severity: 'warn',
        summary: 'errorService.serverUnreachableSummary',
        detail: 'errorService.serverUnreachableDetail',
      }))
  })

  it("n'empile pas un toast par appel réseau échoué", async () => {
    const errorService = await loadErrorService()
    const fail = () => new Error('Failed to fetch', { cause: NETWORK_ERROR })

    // /api/config + /api/auth/get-session + its retry
    errorService.showError(fail())
    errorService.showError(fail())
    errorService.showNetworkError()

    expect(add).toHaveBeenCalledOnce()
  })

  it('réaffiche un toast après expiration du précédent', async () => {
    const errorService = await loadErrorService()

    errorService.showNetworkError()
    vi.advanceTimersByTime(8000)
    errorService.showNetworkError()

    expect(add).toHaveBeenCalledTimes(2)
  })

  it('se tait quand la page est en train de partir', async () => {
    // Un rechargement de mise à jour coupe les requêtes en vol : chaque abandon
    // remonte comme un échec réseau, sur un écran qui n'existera plus.
    const errorService = await loadErrorService()
    const { markLeaving } = await import('@/utils/app-lifecycle')

    markLeaving()
    errorService.showError(new Error('Failed to fetch', { cause: NETWORK_ERROR }))
    errorService.showError(new Error('Tournoi introuvable', { cause: 'TOURNAMENT_NOT_FOUND' }))

    expect(add).not.toHaveBeenCalled()
  })

  it('garde le marqueur réseau des rejets non gérés', async () => {
    // Régression : le handler transmettait `reason.message`, une chaîne, ce qui
    // perdait `cause` — un backend injoignable sortait en erreur brute
    // « Failed to fetch » au lieu du message dédié.
    vi.resetModules()
    const mod = await import('@/composables/useErrorService')
    mod.initErrorService(toast)
    mod.errorService.install()

    const event = new Event('unhandledrejection') as Event & { reason: unknown }
    event.reason = new Error('Failed to fetch', { cause: NETWORK_ERROR })
    window.dispatchEvent(event)
    mod.errorService.uninstall()

    expect(add).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ severity: 'warn', summary: 'errorService.serverUnreachableSummary' }),
    )
  })

  it('laisse passer les vraies erreurs applicatives', async () => {
    const errorService = await loadErrorService()

    errorService.showError(new Error('Tournoi introuvable', { cause: 'TOURNAMENT_NOT_FOUND' }))

    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Tournoi introuvable' }),
    )
  })
})
