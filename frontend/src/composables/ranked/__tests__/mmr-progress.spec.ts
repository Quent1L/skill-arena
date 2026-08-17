import { describe, it, expect } from 'vitest'
import { makeTier } from '@/test-support/factories'
import { buildMmrBarSegments, getTierBounds, tierPercent } from '../mmr-progress'

// Four contiguous 200-wide tiers: 700 / 900 / 1100 / 1300.
const TIERS = [
  makeTier({ level: 1, name: 'Bronze', minMmr: 700 }),
  makeTier({ level: 2, name: 'Argent', minMmr: 900 }),
  makeTier({ level: 3, name: 'Or', minMmr: 1100 }),
  makeTier({ level: 4, name: 'Diamant', minMmr: 1300 }),
]

const tierAt = (level: number) => TIERS.find((t) => t.level === level)!

describe('getTierBounds', () => {
  it('borne un tier par le minMmr du suivant', () => {
    expect(getTierBounds(tierAt(2), TIERS)).toEqual({ min: 900, max: 1100, isOpenEnded: false })
  })

  it('donne au dernier tier la largeur du précédent, et le signale comme ouvert', () => {
    expect(getTierBounds(tierAt(4), TIERS)).toEqual({ min: 1300, max: 1500, isOpenEnded: true })
  })

  it('retombe sur TIER_SIZE quand le tier est seul', () => {
    const solo = makeTier({ level: 1, minMmr: 700 })
    expect(getTierBounds(solo, [solo])).toEqual({ min: 700, max: 900, isOpenEnded: true })
  })
})

describe('tierPercent', () => {
  it('positionne le MMR dans la fenêtre du tier', () => {
    expect(tierPercent(1000, tierAt(2), TIERS)).toBe(50)
  })

  it('reste borné entre 0 et 100 hors de la fenêtre', () => {
    expect(tierPercent(500, tierAt(2), TIERS)).toBe(0)
    expect(tierPercent(5000, tierAt(2), TIERS)).toBe(100)
  })

  it('vaut 0 sans tier', () => {
    expect(tierPercent(1000, null, TIERS)).toBe(0)
  })
})

describe('buildMmrBarSegments', () => {
  it('un seul segment quand le tier ne change pas', () => {
    const segments = buildMmrBarSegments(1000, 1040, TIERS)
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({
      fromPct: 50,
      toPct: 70,
      direction: 'up',
      isFinal: true,
    })
    expect(segments[0].tier?.name).toBe('Argent')
  })

  it('marque une perte intra-tier comme descendante', () => {
    const [segment] = buildMmrBarSegments(1040, 1000, TIERS)
    expect(segment.direction).toBe('down')
    expect(segment.fromPct).toBe(70)
    expect(segment.toPct).toBe(50)
  })

  it("montée de rang : le premier segment termine à 100 %, le second repart de 0", () => {
    const segments = buildMmrBarSegments(1080, 1120, TIERS)
    expect(segments).toHaveLength(2)
    expect(segments[0]).toMatchObject({ fromPct: 90, toPct: 100, isFinal: false })
    expect(segments[0].tier?.name).toBe('Argent')
    expect(segments[1]).toMatchObject({ fromPct: 0, toPct: 10, isFinal: true })
    expect(segments[1].tier?.name).toBe('Or')
  })

  it('descente de rang : le premier segment vide la barre, le second repart de 100 %', () => {
    const segments = buildMmrBarSegments(1120, 1080, TIERS)
    expect(segments).toHaveLength(2)
    expect(segments[0]).toMatchObject({ fromPct: 10, toPct: 0, isFinal: false })
    expect(segments[0].tier?.name).toBe('Or')
    expect(segments[1]).toMatchObject({ fromPct: 100, toPct: 90, isFinal: true })
    expect(segments[1].tier?.name).toBe('Argent')
  })

  it('traverse chaque tier intermédiaire et enchaîne les bornes MMR sans trou', () => {
    const segments = buildMmrBarSegments(750, 1350, TIERS)
    expect(segments.map((s) => s.tier?.name)).toEqual(['Bronze', 'Argent', 'Or', 'Diamant'])
    expect(segments.map((s) => [s.mmrFrom, s.mmrTo])).toEqual([
      [750, 900],
      [900, 1100],
      [1100, 1300],
      [1300, 1350],
    ])
  })

  it('plafonne les segments intermédiaires en gardant le compteur continu', () => {
    const segments = buildMmrBarSegments(750, 1350, TIERS, { maxIntermediateSegments: 1 })
    expect(segments).toHaveLength(3)
    // Le saut de tier tronqué reste continu côté MMR : chaque segment repart où
    // le précédent s'est arrêté, et le pourcentage se borne tout seul.
    expect(segments[2].mmrFrom).toBe(segments[1].mmrTo)
    expect(segments[2].fromPct).toBe(0)
  })

  it('privilégie les niveaux fournis sur le tier déduit du MMR', () => {
    const segments = buildMmrBarSegments(1000, 1000, TIERS, {
      tierBeforeLevel: 1,
      tierAfterLevel: 1,
    })
    expect(segments).toHaveLength(1)
    expect(segments[0].tier?.name).toBe('Bronze')
  })

  it('retombe sur le MMR quand le niveau fourni est inconnu', () => {
    const segments = buildMmrBarSegments(1000, 1040, TIERS, { tierBeforeLevel: 99 })
    expect(segments[0].tier?.name).toBe('Argent')
  })

  it('sans table de tiers, garde une fenêtre synthétique plutôt qu’une barre morte', () => {
    const [segment] = buildMmrBarSegments(1000, 1100, [])
    expect(segment.tier).toBeNull()
    expect(segment.minMmr).toBe(1000)
    expect(segment.maxMmr).toBe(1200)
    expect(segment.toPct).toBe(50)
  })
})
