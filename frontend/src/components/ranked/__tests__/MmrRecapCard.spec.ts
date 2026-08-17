import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import type { ClientRankTier, MmrAnimationEventResponse } from '@skol-arena/shared'
import { makeMmrEvent, makeTier } from '@/test-support/factories'
import MmrRecapCard from '../MmrRecapCard.vue'

// t echoes the key, appending #count when an interpolation count is given, so we
// can assert both the chosen i18n key and its plural/singular count.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: { count?: number }) =>
      params?.count !== undefined ? `${key}#${params.count}` : key,
  }),
}))

const ev = makeMmrEvent

const TIERS = [
  makeTier({ level: 1, name: 'Bronze', minMmr: 700 }),
  makeTier({ level: 2, name: 'Argent', minMmr: 900 }),
]

function mountCard(events: MmrAnimationEventResponse[], tiers?: ClientRankTier[]) {
  return mount(MmrRecapCard, {
    props: tiers ? { events, tiers } : { events },
    global: { stubs: { PlayerAvatarStack: true } },
  })
}

// MmrRecapCard teleports to <body>; query there and reset between tests.
const netEl = () => document.body.querySelector('.text-4xl')?.textContent?.trim()
const summaryEl = () => document.body.querySelector('.text-gray-400')?.textContent?.trim()
const rowDeltas = () =>
  [...document.body.querySelectorAll('.divide-y .font-mono')].map((n) => n.textContent?.trim())
const toggleBtn = () =>
  [...document.body.querySelectorAll('button')].find((b) =>
    b.textContent?.includes('mmrRecapCard.showDetail') || b.textContent?.includes('mmrRecapCard.hideDetail'),
  )

afterEach(() => {
  document.body.innerHTML = ''
})

describe('MmrRecapCard', () => {
  it('net total = somme des displayDelta (avec fallback mmrDelta si null)', () => {
    mountCard([
      ev({ reason: 'recalculated', mmrDelta: 18, displayDelta: 3 }),
      ev({ reason: 'recalculated', mmrDelta: -5, displayDelta: -1 }),
      ev({ reason: 'match_finalized', mmrDelta: 4, displayDelta: null as unknown as number }), // legacy row
    ])
    expect(netEl()).toBe('+6') // 3 - 1 + 4
  })

  it('net négatif: pas de signe +', () => {
    mountCard([ev({ reason: 'recalculated', mmrDelta: -20, displayDelta: -8 })])
    expect(netEl()).toBe('-8')
  })

  it('chaque ligne affiche displayDelta, pas le delta complet', () => {
    mountCard([
      ev({ reason: 'recalculated', mmrDelta: 18, displayDelta: 3 }),
      ev({ reason: 'recalculated', mmrDelta: -5, displayDelta: -1 }),
    ])
    expect(rowDeltas()).toEqual(['+3', '-1'])
  })

  it("badges: 'recalculé' (fa-rotate) et 'annulé' (fa-ban) selon la raison", () => {
    mountCard([
      ev({ reason: 'recalculated', displayDelta: 2 }),
      ev({ reason: 'match_cancelled', displayDelta: -12 }),
      ev({ reason: 'cascade', displayDelta: -3 }),
    ])
    expect(document.body.querySelectorAll('.fa-rotate').length).toBe(1)
    expect(document.body.querySelectorAll('.fa-ban').length).toBe(2) // match_cancelled + cascade
  })

  it('résumé: un fragment par catégorie non vide, badge et résumé concordent', () => {
    mountCard([
      ev({ reason: 'match_finalized', displayDelta: 10 }),
      ev({ reason: 'match_finalized', displayDelta: 5 }),
      ev({ reason: 'recalculated', displayDelta: 1 }),
      ev({ reason: 'match_cancelled', displayDelta: -4 }),
    ])
    expect(summaryEl()).toBe(
      'mmrRecapCard.newMatchesPlural#2, mmrRecapCard.recalcMatchesSingular#1, mmrRecapCard.cancelledMatchesSingular#1',
    )
  })

  it('résumé: matchs recalculés seuls', () => {
    mountCard([
      ev({ reason: 'recalculated', displayDelta: 1 }),
      ev({ reason: 'recalculated', displayDelta: 2 }),
    ])
    expect(summaryEl()).toBe('mmrRecapCard.recalcMatchesPlural#2')
  })

  it('détail déplié tant que la liste reste lisible, sans bouton de repli', () => {
    mountCard([ev({ displayDelta: 1 }), ev({ displayDelta: 2 }), ev({ displayDelta: 3 })])
    expect(rowDeltas()).toEqual(['+1', '+2', '+3'])
    expect(toggleBtn()).toBeUndefined()
  })

  it('au-delà de 3 matchs, le détail est replié derrière un bouton', async () => {
    mountCard([1, 2, 3, 4].map((n) => ev({ displayDelta: n })))
    expect(rowDeltas()).toEqual([])

    const toggle = toggleBtn()
    expect(toggle?.textContent).toContain('mmrRecapCard.showDetail#4')

    toggle!.click()
    await nextTick()
    expect(rowDeltas()).toEqual(['+1', '+2', '+3', '+4'])
    expect(toggleBtn()?.textContent).toContain('mmrRecapCard.hideDetail')
  })

  it('sans table de tiers, aucune barre de progression', () => {
    mountCard([ev({ mmrBefore: 1000, mmrAfter: 1020, displayDelta: 20 })])
    expect(document.body.querySelector('.track')).toBeNull()
  })

  it('avec les tiers, la barre part du premier événement et arrive au dernier', async () => {
    mountCard(
      [
        ev({ mmrBefore: 1000, mmrAfter: 1020, displayDelta: 20 }),
        ev({ mmrBefore: 1020, mmrAfter: 1060, displayDelta: 40 }),
      ],
      TIERS,
    )
    expect(document.body.querySelector('.track')).not.toBeNull()
    expect(document.body.textContent).toContain('mmrRecapCard.progression')
    expect(document.body.textContent).toContain('1000 → 1000')
    // Ici le tier n'est affiché nulle part ailleurs : la barre doit le nommer.
    expect(document.body.querySelector('.bar-labels')?.textContent).toContain('Argent')

    ;(document.body.querySelector('.max-w-sm') as HTMLElement).click()
    await nextTick()
    expect(document.body.textContent).toContain('1000 → 1060')
  })

  it('recalcul : la barre suit le différentiel annoncé, pas la chaîne réécrite', async () => {
    // Un recalcul réécrit mmrBefore/mmrAfter sur des matchs déjà vus : partir de
    // events[0].mmrBefore dessinerait une longue montée sous un titre négatif.
    mountCard(
      [
        ev({ reason: 'recalculated', mmrBefore: 1000, mmrAfter: 1030, mmrDelta: 30, displayDelta: -5 }),
        ev({ reason: 'recalculated', mmrBefore: 1030, mmrAfter: 1050, mmrDelta: 20, displayDelta: -7 }),
      ],
      TIERS,
    )

    expect(netEl()).toBe('-12')
    // Départ = MMR courant moins les points annoncés, donc une barre qui descend.
    expect(document.body.textContent).toContain('1062 → 1062')
    ;(document.body.querySelector('.max-w-sm') as HTMLElement).click()
    await nextTick()
    expect(document.body.textContent).toContain('1062 → 1050')
  })
})
