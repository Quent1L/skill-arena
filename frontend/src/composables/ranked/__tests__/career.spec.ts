import { describe, it, expect } from 'vitest'
import { makeCareerSeason, makeTier } from '@/test-support/factories'
import { careerPeak, groupCareerByDiscipline } from '../career'

const babyfoot = { id: 'disc-1', name: 'Babyfoot', icon: 'fa fa-futbol' }
const pingpong = { id: 'disc-2', name: 'Ping-pong', icon: 'fa fa-table-tennis' }

describe('careerPeak', () => {
  it('null when the player has no season in the discipline', () => {
    const seasons = [makeCareerSeason({ discipline: pingpong })]
    expect(careerPeak(seasons, 'disc-1')).toBeNull()
  })

  it('null on an empty career', () => {
    expect(careerPeak([], 'disc-1')).toBeNull()
  })

  it('takes the highest peak across every season of the discipline', () => {
    const seasons = [
      makeCareerSeason({ seasonId: 's1', seasonName: 'S1', peakMmr: 1200, discipline: babyfoot }),
      makeCareerSeason({ seasonId: 's2', seasonName: 'S2', peakMmr: 1450, discipline: babyfoot }),
      makeCareerSeason({ seasonId: 's3', seasonName: 'S3', peakMmr: 1300, discipline: babyfoot }),
    ]

    expect(careerPeak(seasons, 'disc-1')).toMatchObject({
      mmr: 1450,
      seasonId: 's2',
      seasonName: 'S2',
    })
  })

  it('ignores the seasons of other disciplines', () => {
    const seasons = [
      makeCareerSeason({ seasonId: 's1', peakMmr: 1200, discipline: babyfoot }),
      makeCareerSeason({ seasonId: 's2', peakMmr: 1900, discipline: pingpong }),
    ]

    expect(careerPeak(seasons, 'disc-1')?.mmr).toBe(1200)
  })

  it('covers the whole career when no discipline is given', () => {
    const seasons = [
      makeCareerSeason({ peakMmr: 1200, discipline: babyfoot }),
      makeCareerSeason({ peakMmr: 1900, discipline: pingpong }),
    ]

    expect(careerPeak(seasons, null)?.mmr).toBe(1900)
  })

  it('credits the oldest season on a tie — that is when the record was set', () => {
    const seasons = [
      makeCareerSeason({
        seasonId: 'recent',
        peakMmr: 1400,
        endDate: new Date('2026-06-30'),
        discipline: babyfoot,
      }),
      makeCareerSeason({
        seasonId: 'first',
        peakMmr: 1400,
        endDate: new Date('2025-06-30'),
        discipline: babyfoot,
      }),
    ]

    expect(careerPeak(seasons, 'disc-1')?.seasonId).toBe('first')
  })

  it('resolves the tier on the ladder of the season that set the record', () => {
    // 1450 is top tier on the old ladder, mid tier on the current one. The record
    // was set on the old one, so that is the badge it keeps.
    const seasons = [
      makeCareerSeason({
        seasonId: 'old',
        peakMmr: 1450,
        endDate: new Date('2025-06-30'),
        discipline: babyfoot,
        tiers: [
          makeTier({ seasonId: 'old', level: 1, minMmr: 700, name: 'Bronze' }),
          makeTier({ seasonId: 'old', level: 2, minMmr: 1400, name: 'Légende' }),
        ],
      }),
      makeCareerSeason({
        seasonId: 'now',
        peakMmr: 1300,
        endDate: new Date('2026-06-30'),
        discipline: babyfoot,
        tiers: [
          makeTier({ seasonId: 'now', level: 1, minMmr: 700, name: 'Bronze' }),
          makeTier({ seasonId: 'now', level: 2, minMmr: 1800, name: 'Légende' }),
        ],
      }),
    ]

    expect(careerPeak(seasons, 'disc-1')?.tier?.name).toBe('Légende')
  })

  it('leaves the tier null when the season never had a ladder', () => {
    const seasons = [makeCareerSeason({ peakMmr: 1450, discipline: babyfoot, tiers: [] })]
    expect(careerPeak(seasons, 'disc-1')?.tier).toBeNull()
  })
})

describe('groupCareerByDiscipline', () => {
  it('groups seasons under their discipline', () => {
    const groups = groupCareerByDiscipline([
      makeCareerSeason({ discipline: babyfoot }),
      makeCareerSeason({ discipline: pingpong }),
      makeCareerSeason({ discipline: babyfoot }),
    ])

    expect(groups).toHaveLength(2)
    expect(groups.find((g) => g.disciplineId === 'disc-1')?.seasons).toHaveLength(2)
    expect(groups.find((g) => g.disciplineId === 'disc-2')?.disciplineName).toBe('Ping-pong')
  })

  it('orders the seasons of a group newest first', () => {
    const groups = groupCareerByDiscipline([
      makeCareerSeason({ seasonId: 'old', endDate: new Date('2025-06-30'), discipline: babyfoot }),
      makeCareerSeason({ seasonId: 'new', endDate: new Date('2026-06-30'), discipline: babyfoot }),
    ])

    expect(groups[0].seasons.map((s) => s.seasonId)).toEqual(['new', 'old'])
  })

  it('puts the most recently played discipline first', () => {
    const groups = groupCareerByDiscipline([
      makeCareerSeason({ endDate: new Date('2024-06-30'), discipline: babyfoot }),
      makeCareerSeason({ endDate: new Date('2026-06-30'), discipline: pingpong }),
    ])

    expect(groups.map((g) => g.disciplineId)).toEqual(['disc-2', 'disc-1'])
  })

  it('keeps seasons whose discipline was deleted, in a trailing group', () => {
    const groups = groupCareerByDiscipline([
      makeCareerSeason({ endDate: new Date('2026-06-30'), discipline: null }),
      makeCareerSeason({ endDate: new Date('2024-06-30'), discipline: babyfoot }),
    ])

    expect(groups.map((g) => g.disciplineId)).toEqual(['disc-1', null])
    expect(groups[1].disciplineName).toBeNull()
  })

  it('returns nothing for an empty career', () => {
    expect(groupCareerByDiscipline([])).toEqual([])
  })
})
