import { describe, it, expect, vi, beforeEach } from 'vitest'

import { useMatchService } from '../match.service'

type WsHandler = (data: unknown) => void

const handlers = new Set<WsHandler>()
const off = vi.fn(() => undefined)

vi.mock('@/composables/notification/notification.socket', () => ({
  onWsEvent: (event: string, handler: WsHandler) => {
    if (event !== 'match_updated') return () => undefined
    handlers.add(handler)
    return () => {
      handlers.delete(handler)
      off()
    }
  },
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
// Only useI18n is swapped: the app builds a real i18n instance at import time
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/composables/useAppToast', () => ({ useAppToast: () => ({ add: vi.fn() }) }))
vi.mock('@/composables/participant.service', () => ({
  useParticipantService: () => ({ getTournamentParticipants: vi.fn() }),
}))

function emit(payload: unknown) {
  handlers.forEach((h) => h(payload))
}

beforeEach(() => {
  vi.useFakeTimers()
  handlers.clear()
  off.mockClear()
})

describe('subscribeToMatchUpdates', () => {
  it('refreshes on an update of the watched match', () => {
    const onUpdate = vi.fn()
    useMatchService().subscribeToMatchUpdates('m-1', onUpdate)

    emit({ matchId: 'm-1', status: 'disputed' })
    vi.runAllTimers()

    expect(onUpdate).toHaveBeenCalledTimes(1)
  })

  it('ignores updates of other matches', () => {
    const onUpdate = vi.fn()
    useMatchService().subscribeToMatchUpdates('m-1', onUpdate)

    emit({ matchId: 'm-2', status: 'finalized' })
    vi.runAllTimers()

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('folds the events of a single action into one refresh', () => {
    const onUpdate = vi.fn()
    useMatchService().subscribeToMatchUpdates('m-1', onUpdate)

    // A validation that finalizes the match reports both moves
    emit({ matchId: 'm-1', status: 'reported' })
    emit({ matchId: 'm-1', status: 'finalized' })
    vi.runAllTimers()

    expect(onUpdate).toHaveBeenCalledTimes(1)
  })

  it('stops listening once unsubscribed', () => {
    const onUpdate = vi.fn()
    const unsubscribe = useMatchService().subscribeToMatchUpdates('m-1', onUpdate)

    unsubscribe()
    emit({ matchId: 'm-1', status: 'finalized' })
    vi.runAllTimers()

    expect(off).toHaveBeenCalled()
    expect(onUpdate).not.toHaveBeenCalled()
  })
})
