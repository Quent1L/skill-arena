import { describe, it, expect, vi } from 'vitest'
import type { ClientRankTier, MmrChartPoint } from '@skol-arena/shared'
import { makeTier } from '@/test-support/factories'
import {
  getSubRank,
  getTierLabel,
  getLp,
  isTopTier,
  getMatchLabel,
  getTierForMmr,
  getPeakMmr,
  getWeeklyMmrGain,
  getCurrentWeekStart,
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

function point(mmrBefore: number, mmrDelta: number, playedAt: string): MmrChartPoint {
  return { mmrBefore, mmrAfter: mmrBefore + mmrDelta, mmrDelta, playedAt: new Date(playedAt) }
}

describe('getTierForMmr', () => {
  it('null sans tiers', () => {
    expect(getTierForMmr(1000, [])).toBeNull()
  })

  it('retourne le tier le plus haut dont le minMmr est atteint', () => {
    const all = tiers(
      { level: 1, minMmr: 700, name: 'Bronze' },
      { level: 2, minMmr: 1100, name: 'Gold' },
      { level: 3, minMmr: 1500, name: 'Diamond' },
    )
    expect(getTierForMmr(1200, all)?.name).toBe('Gold')
    expect(getTierForMmr(1500, all)?.name).toBe('Diamond')
  })

  it('retombe sur le premier tier quand le MMR est sous tous les seuils', () => {
    const all = tiers({ level: 1, minMmr: 700, name: 'Bronze' }, { level: 2, minMmr: 1100 })
    expect(getTierForMmr(500, all)?.name).toBe('Bronze')
  })
})

describe('getPeakMmr', () => {
  it('null sans historique', () => {
    expect(getPeakMmr([])).toBeNull()
  })

  it('retient le plus haut mmrAfter, même si le joueur a rechuté depuis', () => {
    const history = [
      point(1000, 40, '2026-07-20T10:00:00Z'),
      point(1040, 60, '2026-07-21T10:00:00Z'),
      point(1100, -80, '2026-07-22T10:00:00Z'),
    ]
    expect(getPeakMmr(history)).toBe(1100)
  })

  it('retombe sur le MMR de départ quand le joueur n’a fait que perdre', () => {
    const history = [
      point(1000, -20, '2026-07-20T10:00:00Z'),
      point(980, -30, '2026-07-21T10:00:00Z'),
    ]
    expect(getPeakMmr(history)).toBe(1000)
  })
})

describe('getWeeklyMmrGain', () => {
  const weekStart = new Date('2026-07-27T00:00:00Z')

  it('ignore les matchs antérieurs au début de semaine', () => {
    const history = [
      point(1000, 50, '2026-07-26T23:59:00Z'),
      point(1050, 20, '2026-07-27T09:00:00Z'),
      point(1070, -5, '2026-07-30T09:00:00Z'),
    ]
    expect(getWeeklyMmrGain(history, weekStart)).toEqual({ mmrGained: 15, matchesPlayed: 2 })
  })

  it('renvoie 0 match quand le joueur n’a pas joué cette semaine', () => {
    const history = [point(1000, 50, '2026-07-20T10:00:00Z')]
    expect(getWeeklyMmrGain(history, weekStart)).toEqual({ mmrGained: 0, matchesPlayed: 0 })
  })

  it('inclut le match joué pile au début de semaine', () => {
    const history = [point(1000, 12, '2026-07-27T00:00:00Z')]
    expect(getWeeklyMmrGain(history, weekStart)).toEqual({ mmrGained: 12, matchesPlayed: 1 })
  })
})

describe('getCurrentWeekStart', () => {
  it('renvoie le lundi 00:00 local de la semaine courante', () => {
    // jeudi 30/07/2026
    const start = getCurrentWeekStart(new Date(2026, 6, 30, 14, 22))
    expect(start.getDay()).toBe(1)
    expect(start.getDate()).toBe(27)
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
  })

  it('rattache le dimanche à la semaine qui vient de s’écouler', () => {
    const start = getCurrentWeekStart(new Date(2026, 7, 2, 23, 59))
    expect(start.getDate()).toBe(27)
    expect(start.getMonth()).toBe(6)
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
