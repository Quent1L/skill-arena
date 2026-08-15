import { describe, it, expect } from 'vitest'
import type { ClientMatchDetail, MatchDetailConfirmation } from '@skol-arena/shared/types/index'

import {
  buildConfirmationStatusMap,
  confirmationStatusClass,
  confirmationStatusIcon,
  confirmationStatusLabelKey,
} from '../match-confirmation-status'

function confirmation(over: Partial<MatchDetailConfirmation>): MatchDetailConfirmation {
  return {
    id: 'c-1',
    matchId: 'm-1',
    playerId: 'p1',
    isConfirmed: false,
    isContested: false,
    contestationReason: null,
    sidePosition: 1,
    isPostFinalization: false,
    ...over,
  } as MatchDetailConfirmation
}

function makeMatch(confirmations: MatchDetailConfirmation[]): ClientMatchDetail {
  const side = (position: number, ids: string[]) => ({
    position,
    score: 0,
    pointsAwarded: 0,
    isWinner: false,
    entryId: `e-${position}`,
    entryName: null,
    teamId: null,
    players: ids.map((id) => ({ id, displayName: id.toUpperCase(), shortName: id })),
  })

  return {
    id: 'm-1',
    status: 'reported',
    sides: [side(1, ['p1', 'p2']), side(2, ['p3', 'p4'])],
    confirmations,
  } as unknown as ClientMatchDetail
}

describe('buildConfirmationStatusMap', () => {
  it('maps every participant, defaulting to pending', () => {
    const map = buildConfirmationStatusMap(makeMatch([]))

    expect([...map.keys()]).toEqual(['p1', 'p2', 'p3', 'p4'])
    expect([...map.values()]).toEqual(['pending', 'pending', 'pending', 'pending'])
  })

  it('reads confirmed and contested off the confirmations', () => {
    const map = buildConfirmationStatusMap(
      makeMatch([
        confirmation({ playerId: 'p1', isConfirmed: true }),
        confirmation({ playerId: 'p3', isContested: true }),
      ]),
    )

    expect(map.get('p1')).toBe('confirmed')
    expect(map.get('p3')).toBe('contested')
    expect(map.get('p2')).toBe('pending')
  })

  it('ignores post-finalization confirmations', () => {
    const map = buildConfirmationStatusMap(
      makeMatch([confirmation({ playerId: 'p2', isContested: true, isPostFinalization: true })]),
    )

    expect(map.get('p2')).toBe('pending')
  })

  it('ignores confirmations from someone who is not in the match', () => {
    const map = buildConfirmationStatusMap(
      makeMatch([confirmation({ playerId: 'ghost', isConfirmed: true })]),
    )

    expect(map.has('ghost')).toBe(false)
    expect(map.size).toBe(4)
  })
})

describe('confirmation status vocabulary', () => {
  it('gives each status its own icon, colour and label key', () => {
    const statuses = ['confirmed', 'contested', 'pending'] as const
    const icons = statuses.map(confirmationStatusIcon)
    const classes = statuses.map(confirmationStatusClass)
    const keys = statuses.map(confirmationStatusLabelKey)

    expect(new Set(icons).size).toBe(3)
    expect(new Set(classes).size).toBe(3)
    expect(new Set(keys).size).toBe(3)
    expect(confirmationStatusClass('confirmed')).toContain('match-win')
    expect(confirmationStatusClass('contested')).toContain('match-loss')
  })
})
