import { describe, it, expect, vi } from 'vitest'
import type { ClientRankTier } from '@skol-arena/shared'
import { makeTier } from '@/test-support/factories'
import {
  getSubRank,
  getTierLabel,
  getLp,
  isTopTier,
  getMatchLabel,
  useRankedService,
  MMR_FLOOR,
} from '../ranked.service'

vi.mock('../ranked.api', () => ({ rankedApi: {} }))
vi.mock('@/i18n', () => ({
  i18n: { global: { t: (key: string) => key } },
}))

function tiers(...defs: Array<Partial<ClientRankTier>>): ClientRankTier[] {
  return defs.map((d) => makeTier(d))
}

describe('getSubRank', () => {
  it('null quand le tier n’a pas de sous-rangs (subRanks <= 1)', () => {
    const [tier] = tiers({ level: 1, minMmr: 1000, subRanks: 1 })
    expect(getSubRank(1100, tier, [tier])).toBeNull()
  })

  it('découpe la plage jusqu’au tier suivant en sous-rangs décroissants', () => {
    const all = tiers(
      { level: 1, minMmr: 1000, subRanks: 4 },
      { level: 2, minMmr: 1200, subRanks: 1 },
    )
    const tier = all[0]
    // plage 1000→1200, sous-plage de 50
    expect(getSubRank(1000, tier, all)).toBe(4)
    expect(getSubRank(1049, tier, all)).toBe(4)
    expect(getSubRank(1050, tier, all)).toBe(3)
    expect(getSubRank(1150, tier, all)).toBe(1)
    expect(getSubRank(1199, tier, all)).toBe(1)
  })

  it('clampe à 1 quand le MMR dépasse le haut de la plage', () => {
    const all = tiers(
      { level: 1, minMmr: 1000, subRanks: 4 },
      { level: 2, minMmr: 1200, subRanks: 1 },
    )
    expect(getSubRank(1250, all[0], all)).toBe(1)
  })

  it('clampe au max quand le MMR est sous le bas de la plage', () => {
    const all = tiers(
      { level: 1, minMmr: 1000, subRanks: 4 },
      { level: 2, minMmr: 1200, subRanks: 1 },
    )
    expect(getSubRank(900, all[0], all)).toBe(4)
  })

  it('tier max: la plage est déduite de l’écart avec le tier précédent', () => {
    const all = tiers(
      { level: 1, minMmr: 800, subRanks: 1 },
      { level: 2, minMmr: 1000, subRanks: 4 },
    )
    // rangeTop = 1000 + (1000 - 800) = 1200, sous-plage de 50
    expect(getSubRank(1050, all[1], all)).toBe(3)
  })

  it('tier unique: plage par défaut de 1000', () => {
    const all = tiers({ level: 1, minMmr: 1000, subRanks: 2 })
    // rangeTop = 2000, sous-plage de 500
    expect(getSubRank(1100, all[0], all)).toBe(2)
    expect(getSubRank(1600, all[0], all)).toBe(1)
  })
})

describe('getTierLabel', () => {
  it('tier null → tiret', () => {
    expect(getTierLabel(null, 2)).toBe('—')
  })

  it('sans sous-rang → nom seul', () => {
    expect(getTierLabel(makeTier({ name: 'Gold' }), null)).toBe('Gold')
  })

  it('avec sous-rang → nom + numéro', () => {
    expect(getTierLabel(makeTier({ name: 'Gold' }), 2)).toBe('Gold 2')
  })
})

describe('getLp', () => {
  it('0 sous le plancher MMR', () => {
    expect(getLp(MMR_FLOOR - 50, makeTier({ minMmr: 600 }))).toBe(0)
  })

  it('écart au-dessus du minMmr du tier', () => {
    expect(getLp(1250, makeTier({ minMmr: 1200 }))).toBe(50)
  })

  it('jamais négatif quand le MMR est sous le minMmr du tier', () => {
    expect(getLp(1100, makeTier({ minMmr: 1200 }))).toBe(0)
  })
})

describe('isTopTier', () => {
  it('true quand aucun tier au-dessus', () => {
    const all = tiers({ level: 1 }, { level: 2 })
    expect(isTopTier(all[1], all)).toBe(true)
  })

  it('false quand un tier supérieur existe', () => {
    const all = tiers({ level: 1 }, { level: 2 })
    expect(isTopTier(all[0], all)).toBe(false)
  })
})

describe('getMatchLabel', () => {
  it('rookieProtection: MMR < 900 contre adversaire à +100', () => {
    expect(getMatchLabel(850, 1000, 5)).toBe('rankedService.matchLabel.rookieProtection')
  })

  it('exploit: victoire en gros outsider (E < 0.35)', () => {
    // E = 1/(1+10^(200/400)) ≈ 0.24
    expect(getMatchLabel(1000, 1200, 10)).toBe('rankedService.matchLabel.exploit')
  })

  it('pas d’exploit quand le delta est négatif', () => {
    expect(getMatchLabel(1000, 1200, -10)).toBeNull()
  })

  it('favorite: gros favori (E > 0.65) quel que soit le delta', () => {
    // E = 1/(1+10^(-200/400)) ≈ 0.76
    expect(getMatchLabel(1200, 1000, -5)).toBe('rankedService.matchLabel.favorite')
  })

  it('null pour un match équilibré', () => {
    expect(getMatchLabel(1000, 1000, -5)).toBeNull()
  })
})

describe('useRankedService().getRank', () => {
  const { getRank } = useRankedService()

  it('null sans tiers', () => {
    expect(getRank(1000, [])).toBeNull()
  })

  it('retourne le tier le plus haut dont le minMmr est atteint', () => {
    const all = tiers(
      { level: 1, minMmr: 700, name: 'Bronze' },
      { level: 2, minMmr: 1100, name: 'Gold' },
      { level: 3, minMmr: 1500, name: 'Diamond' },
    )
    expect(getRank(1200, all)?.name).toBe('Gold')
    expect(getRank(1500, all)?.name).toBe('Diamond')
  })

  it('retombe sur le premier tier quand le MMR est sous tous les seuils', () => {
    const all = tiers({ level: 1, minMmr: 700, name: 'Bronze' }, { level: 2, minMmr: 1100 })
    expect(getRank(500, all)?.name).toBe('Bronze')
  })
})
