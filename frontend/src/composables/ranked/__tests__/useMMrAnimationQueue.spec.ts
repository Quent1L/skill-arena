import { describe, it, expect, vi } from 'vitest'
import type { MmrAnimationEventResponse } from '@skol-arena/shared'
import { useMMrAnimationQueue } from '../useMMrAnimationQueue'

// API is pulled in at import time; stub it so the composable has no side effects.
vi.mock('../mmr-animation-event.api', () => ({
  mmrAnimationEventApi: {
    fetchPendingEvents: vi.fn(),
    fetchPendingBadges: vi.fn(),
    markEventsViewed: vi.fn(),
    markBadgesViewed: vi.fn(),
  },
}))

function ev(reason: MmrAnimationEventResponse['reason']): MmrAnimationEventResponse {
  return {
    id: Math.random().toString(36),
    matchId: Math.random().toString(36),
    seasonId: 's',
    eventType: 'official',
    reason,
    mmrBefore: 1000,
    mmrAfter: 1000,
    mmrDelta: 0,
    displayDelta: 0,
    tierBeforeLevel: null,
    tierAfterLevel: null,
    tierBeforeName: null,
    tierAfterName: null,
    rankChanged: false,
    encouragementMessage: null,
    createdAt: '',
    opponents: [],
    teammates: [],
  }
}

describe('useMMrAnimationQueue.showRecap', () => {
  it('false sur file vide', () => {
    const q = useMMrAnimationQueue()
    expect(q.showRecap.value).toBe(false)
  })

  it('false pour un seul nouveau match', () => {
    const q = useMMrAnimationQueue()
    q.queue.value = [ev('match_finalized')]
    expect(q.showRecap.value).toBe(false)
  })

  it('true dès 2 events (n’importe quelle raison)', () => {
    const q = useMMrAnimationQueue()
    q.queue.value = [ev('match_finalized'), ev('match_finalized')]
    expect(q.showRecap.value).toBe(true)
  })

  it.each(['recalculated', 'match_cancelled', 'cascade'] as const)(
    "true pour un seul event '%s' (la carte recap honore displayDelta, pas l'anim plein delta)",
    (reason) => {
      const q = useMMrAnimationQueue()
      q.queue.value = [ev(reason)]
      expect(q.showRecap.value).toBe(true)
    },
  )
})
