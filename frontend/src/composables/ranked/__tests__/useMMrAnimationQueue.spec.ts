import { describe, it, expect, vi } from 'vitest'
import type { MmrAnimationEventResponse } from '@skol-arena/shared'
import { makeMmrEvent } from '@/test-support/factories'
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
  return makeMmrEvent({ reason })
}

describe('useMMrAnimationQueue.showRecap', () => {
  it('false on an empty queue', () => {
    const q = useMMrAnimationQueue()
    expect(q.showRecap.value).toBe(false)
  })

  it('false for a single new match', () => {
    const q = useMMrAnimationQueue()
    q.queue.value = [ev('match_finalized')]
    expect(q.showRecap.value).toBe(false)
  })

  it('true from 2 events onward (any reason)', () => {
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
