import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { MmrAnimationEventResponse } from '@skol-arena/shared'
import MmrRecapCard from '../MmrRecapCard.vue'

// t echoes the key, appending #count when an interpolation count is given, so we
// can assert both the chosen i18n key and its plural/singular count.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: { count?: number }) =>
      params?.count !== undefined ? `${key}#${params.count}` : key,
  }),
}))

let seq = 0
function ev(over: Partial<MmrAnimationEventResponse>): MmrAnimationEventResponse {
  seq += 1
  return {
    id: `e${seq}`,
    matchId: `m${seq}`,
    seasonId: 's',
    eventType: 'official',
    reason: 'match_finalized',
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
    ...over,
  }
}

function mountCard(events: MmrAnimationEventResponse[]) {
  return mount(MmrRecapCard, {
    props: { events },
    global: { stubs: { PlayerAvatarStack: true } },
  })
}

// MmrRecapCard teleports to <body>; query there and reset between tests.
const netEl = () => document.body.querySelector('.text-4xl')?.textContent?.trim()
const summaryEl = () => document.body.querySelector('.text-gray-400')?.textContent?.trim()
const rowDeltas = () =>
  [...document.body.querySelectorAll('.divide-y .font-mono')].map((n) => n.textContent?.trim())

afterEach(() => {
  document.body.innerHTML = ''
})

describe('MmrRecapCard', () => {
  it('net total = somme des displayDelta (avec fallback mmrDelta si null)', () => {
    mountCard([
      ev({ reason: 'recalculated', mmrDelta: 18, displayDelta: 3 }),
      ev({ reason: 'recalculated', mmrDelta: -5, displayDelta: -1 }),
      ev({ reason: 'match_finalized', mmrDelta: 4, displayDelta: null as unknown as number }), // ligne héritée
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
})
