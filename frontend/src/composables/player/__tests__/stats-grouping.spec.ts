import { describe, it, expect } from 'vitest'
import type { PlayerTournamentEntry } from '@skol-arena/shared/types/index'
import { groupTournamentHistory } from '../stats-grouping'

function entry(over: Partial<PlayerTournamentEntry> = {}): PlayerTournamentEntry {
  return {
    tournamentId: 't1',
    tournamentName: 'Tournament',
    mode: 'championship',
    disciplineName: 'Babyfoot',
    matchesPlayed: 10,
    wins: 6,
    draws: 0,
    losses: 4,
    ...over,
  } as PlayerTournamentEntry
}

describe('groupTournamentHistory', () => {
  it('folds competitions of the same discipline and mode together', () => {
    const groups = groupTournamentHistory([
      entry({ tournamentId: 'a' }),
      entry({ tournamentId: 'b' }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].entries).toHaveLength(2)
    expect(groups[0].totalMatches).toBe(20)
  })

  it('keeps the modes of one discipline apart', () => {
    const groups = groupTournamentHistory([
      entry({ tournamentId: 'a', mode: 'championship' }),
      entry({ tournamentId: 'b', mode: 'ranked' }),
    ])

    expect(groups.map((g) => g.mode).sort()).toEqual(['championship', 'ranked'])
  })

  it('derives the win rate from the totals', () => {
    const groups = groupTournamentHistory([
      entry({ tournamentId: 'a', matchesPlayed: 55, wins: 43, losses: 12 }),
      entry({ tournamentId: 'b', matchesPlayed: 1, wins: 1, losses: 0 }),
    ])

    expect(groups[0].winRate).toBe(79)
  })

  it('does not divide by zero on a competition without a played match', () => {
    const groups = groupTournamentHistory([
      entry({ matchesPlayed: 0, wins: 0, draws: 0, losses: 0 }),
    ])

    expect(groups[0].winRate).toBe(0)
  })

  it('names a competition with no discipline instead of dropping it', () => {
    const groups = groupTournamentHistory([entry({ disciplineName: undefined })])

    expect(groups).toHaveLength(1)
    expect(groups[0].discipline).toBeNull()
  })
})

// The exclusion is what unifies the page: the ranked career card already lists the
// seasons it covers, with the same match counts and records.
describe('groupTournamentHistory exclusions', () => {
  it('drops a competition another card already accounts for', () => {
    const groups = groupTournamentHistory(
      [entry({ tournamentId: 'season-1', mode: 'ranked' }), entry({ tournamentId: 'champ-1' })],
      new Set(['season-1']),
    )

    expect(groups.flatMap((g) => g.entries).map((e) => e.tournamentId)).toEqual(['champ-1'])
  })

  it('drops a group the exclusion empties, rather than leaving a shell', () => {
    const groups = groupTournamentHistory(
      [entry({ tournamentId: 'season-1', mode: 'ranked' })],
      new Set(['season-1']),
    )

    expect(groups).toEqual([])
  })

  it('leaves the totals of a surviving group untouched', () => {
    const groups = groupTournamentHistory(
      [
        entry({ tournamentId: 'season-1', mode: 'ranked', matchesPlayed: 99, wins: 99 }),
        entry({ tournamentId: 'champ-1', matchesPlayed: 10, wins: 5, losses: 5 }),
      ],
      new Set(['season-1']),
    )

    expect(groups[0].totalMatches).toBe(10)
    expect(groups[0].winRate).toBe(50)
  })

  // A ranked season the career does not cover — entries but no rated history — must
  // still appear somewhere.
  it('keeps a ranked season the career card does not cover', () => {
    const groups = groupTournamentHistory(
      [entry({ tournamentId: 'unrated', mode: 'ranked' })],
      new Set(['season-1']),
    )

    expect(groups.flatMap((g) => g.entries).map((e) => e.tournamentId)).toEqual(['unrated'])
  })

  it('never touches a non-ranked competition', () => {
    const groups = groupTournamentHistory(
      [entry({ tournamentId: 'champ-1' })],
      new Set(['champ-1-lookalike', 'season-1']),
    )

    expect(groups).toHaveLength(1)
  })

  it('groups everything when nothing is excluded', () => {
    expect(groupTournamentHistory([entry()])).toHaveLength(1)
  })
})
