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

  it('laisse passer les vraies erreurs applicatives', async () => {
    const errorService = await loadErrorService()

    errorService.showError(new Error('Tournoi introuvable', { cause: 'TOURNAMENT_NOT_FOUND' }))

    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Tournoi introuvable' }),
    )
  })
})
