import { describe, it, expect, vi } from 'vitest'
import { RouterLinkStub } from '@vue/test-utils'
import type {
  OutcomeTypeFunStat,
  OutcomeTypeLeader,
  OutcomeTypeLeaderboard,
} from '@skol-arena/shared'
import { mountWithPrime } from '@/test-support/mount'
import InfoTooltip from '@/components/InfoTooltip.vue'
import OutcomeTypeFunStats from '../OutcomeTypeFunStats.vue'

// t() echoes the key, plus the interpolated value when there is one, so assertions can
// check both the wording used and the number fed to it.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: { count?: number; pct?: number; name?: string }) => {
      if (!params) return key
      const value = params.count ?? params.pct ?? params.name
      return `${key}:${value}`
    },
  }),
}))

function leader(overrides: Partial<OutcomeTypeLeader> = {}): OutcomeTypeLeader {
  return {
    playerId: 'p1',
    displayName: 'Thomas',
    shortName: 'THO',
    count: 37,
    matchesPlayed: 40,
    ratePct: 92,
    sharePct: 53,
    rank: 1,
    tiedCount: 1,
    ...overrides,
  }
}

function board(
  leaders: OutcomeTypeLeader[],
  overrides: Partial<OutcomeTypeLeaderboard> = {},
): OutcomeTypeLeaderboard {
  return {
    leaders,
    omittedNames: [],
    omittedCount: 0,
    isFlat: false,
    isLowSample: false,
    ...overrides,
  }
}

function funStat(overrides: Partial<OutcomeTypeFunStat> = {}): OutcomeTypeFunStat {
  return {
    outcomeTypeId: 'ot1',
    outcomeTypeName: 'Fin normale',
    totalMatches: 124,
    topWinnersByVolume: board([leader()]),
    topWinnersByRate: board([leader({ playerId: 'p2', displayName: 'Rémi', ratePct: 88 })]),
    topLosersByVolume: board([leader({ playerId: 'p3', displayName: 'Matéo', count: 21 })]),
    topLosersByRate: board([leader({ playerId: 'p4', displayName: 'Julien', ratePct: 64 })]),
    ...overrides,
  }
}

/** The rate column's tooltip — the volume column carries the first one. */
function rateTooltip(wrapper: ReturnType<typeof mountWithPrime>) {
  return wrapper.findAllComponents(InfoTooltip)[1]!
}

describe('OutcomeTypeFunStats', () => {
  it('affiche volume et efficacité côte à côte pour chaque type de résultat', () => {
    const wrapper = mountWithPrime(OutcomeTypeFunStats, { props: { stats: [funStat()] } })

    const text = wrapper.text()
    expect(text).toContain('tournamentStatsTab.outcomeTypeFunStats.king:Fin normale')
    expect(text).toContain('tournamentStatsTab.outcomeTypeFunStats.matchCount:124')
    // volume column: win count + share of total
    expect(text).toContain('tournamentStatsTab.outcomeTypeFunStats.winCount:37')
    expect(text).toContain('tournamentStatsTab.outcomeTypeFunStats.shareOfTotal:53')
    // efficiency column: rate + sample size
    expect(text).toContain('Rémi')
    expect(text).toContain('88 %')
    expect(text).toContain('tournamentStatsTab.outcomeTypeFunStats.matchCount:40')
  })

  it('bascule les deux colonnes sur les perdants via le sélecteur', async () => {
    const wrapper = mountWithPrime(OutcomeTypeFunStats, { props: { stats: [funStat()] } })

    expect(wrapper.text()).toContain('Thomas')

    const toggle = wrapper.findComponent({ name: 'SelectButton' })
    await toggle.vm.$emit('update:modelValue', 'losers')

    const text = wrapper.text()
    expect(text).toContain('Matéo')
    expect(text).toContain('Julien')
    expect(text).not.toContain('Thomas')
    expect(text).toContain('tournamentStatsTab.outcomeTypeFunStats.lossCount:21')
    // the card title follows the side too
    expect(text).toContain('tournamentStatsTab.outcomeTypeFunStats.victim:Fin normale')
    expect(text).not.toContain('tournamentStatsTab.outcomeTypeFunStats.king')
  })

  it('parle de vulnérabilité et non d’efficacité côté perdants', async () => {
    const wrapper = mountWithPrime(OutcomeTypeFunStats, { props: { stats: [funStat()] } })

    expect(wrapper.text()).toContain('tournamentStatsTab.outcomeTypeFunStats.efficiency')
    expect(rateTooltip(wrapper).props('text')).toBe(
      'tournamentStatsTab.outcomeTypeFunStats.efficiencyTooltip:3',
    )

    await wrapper.findComponent({ name: 'SelectButton' }).vm.$emit('update:modelValue', 'losers')

    const text = wrapper.text()
    expect(text).toContain('tournamentStatsTab.outcomeTypeFunStats.vulnerability')
    expect(text).not.toContain('tournamentStatsTab.outcomeTypeFunStats.efficiency')
    expect(rateTooltip(wrapper).props('text')).toBe(
      'tournamentStatsTab.outcomeTypeFunStats.vulnerabilityTooltip:3',
    )
  })

  it('signale un échantillon faible et adapte l’info-bulle', () => {
    const stats = [
      funStat({
        topWinnersByRate: board([leader({ playerId: 'p2' })], { isLowSample: true }),
      }),
    ]
    const wrapper = mountWithPrime(OutcomeTypeFunStats, { props: { stats } })

    expect(wrapper.find('[data-test="low-sample-badge"]').text()).toContain(
      'tournamentStatsTab.outcomeTypeFunStats.lowSample:3',
    )
    expect(rateTooltip(wrapper).props('text')).toBe(
      'tournamentStatsTab.outcomeTypeFunStats.lowSampleTooltip:3',
    )
  })

  it('explique la pondération quand le seuil est respecté', () => {
    const wrapper = mountWithPrime(OutcomeTypeFunStats, { props: { stats: [funStat()] } })

    expect(wrapper.find('[data-test="low-sample-badge"]').exists()).toBe(false)
    expect(rateTooltip(wrapper).props('text')).toBe(
      'tournamentStatsTab.outcomeTypeFunStats.efficiencyTooltip:3',
    )
  })

  it('explique aussi le critère de la colonne volume', () => {
    const wrapper = mountWithPrime(OutcomeTypeFunStats, { props: { stats: [funStat()] } })

    expect(wrapper.findAllComponents(InfoTooltip)[0]!.props('text')).toBe(
      'tournamentStatsTab.outcomeTypeFunStats.volumeTooltip',
    )
  })

  it('affiche un état vide quand aucun taux n’est calculable', () => {
    const wrapper = mountWithPrime(OutcomeTypeFunStats, {
      props: {
        stats: [funStat({ topWinnersByVolume: board([]), topWinnersByRate: board([]) })],
      },
    })

    expect(wrapper.find('[data-test="volume-list"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="rate-list"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('tournamentStatsTab.outcomeTypeFunStats.noRateData')
  })

  it('affiche le rang et non la position dans la liste', () => {
    const tied = board([
      leader({ playerId: 'p1', displayName: 'Thomas', rank: 1, tiedCount: 2 }),
      leader({ playerId: 'p2', displayName: 'Rémi', rank: 1, tiedCount: 2 }),
      leader({ playerId: 'p3', displayName: 'Matéo', rank: 3, tiedCount: 1, count: 12 }),
    ])
    const wrapper = mountWithPrime(OutcomeTypeFunStats, {
      props: { stats: [funStat({ topWinnersByVolume: tied })] },
    })

    const badges = wrapper.find('[data-test="volume-list"]').findAll('span.rounded-full')
    expect(badges.map((b) => b.text())).toEqual(['1', '1', '3'])
    // The medal follows the rank, so both leaders wear the same one.
    expect(badges[0]!.classes()).toEqual(badges[1]!.classes())
  })

  it('signale une fois par groupe les joueurs départagés par rien', () => {
    const tied = board([
      leader({ playerId: 'p1', rank: 1, tiedCount: 2 }),
      leader({ playerId: 'p2', displayName: 'Rémi', rank: 1, tiedCount: 2 }),
    ])
    const wrapper = mountWithPrime(OutcomeTypeFunStats, {
      props: { stats: [funStat({ topWinnersByVolume: tied })] },
    })

    const markers = wrapper.find('[data-test="volume-list"]').findAll('[data-test="ex-aequo"]')
    expect(markers).toHaveLength(1)
    expect(markers[0]!.text()).toContain('tournamentStatsTab.outcomeTypeFunStats.exAequo')
  })

  it('compte les ex aequo laissés de côté par la coupe', () => {
    const cut = board([leader()], { omittedCount: 4, omittedNames: ['A', 'B', 'C', 'D'] })
    const wrapper = mountWithPrime(OutcomeTypeFunStats, {
      props: { stats: [funStat({ topWinnersByVolume: cut })] },
    })

    expect(wrapper.find('[data-test="more-tied"]').text()).toBe(
      'tournamentStatsTab.outcomeTypeFunStats.moreTied:4',
    )
  })

  it('remplace le podium par un tableau d’honneur quand rien ne départage', () => {
    const flat = board(
      [
        leader({ playerId: 'p1', rank: 1, tiedCount: 3 }),
        leader({ playerId: 'p2', displayName: 'Rémi', rank: 1, tiedCount: 3 }),
        leader({ playerId: 'p3', displayName: 'Matéo', rank: 1, tiedCount: 3 }),
      ],
      { isFlat: true },
    )
    const wrapper = mountWithPrime(OutcomeTypeFunStats, {
      props: { stats: [funStat({ topWinnersByVolume: flat })] },
    })

    const roll = wrapper.find('[data-test="honour-roll"]')
    expect(wrapper.find('[data-test="volume-list"]').exists()).toBe(false)
    expect(roll.text()).toContain('tournamentStatsTab.outcomeTypeFunStats.noRanking')
    expect(roll.text()).toContain('tournamentStatsTab.outcomeTypeFunStats.honourRollWinners:3')
    expect(roll.text()).toContain('Rémi')
  })

  it('renvoie vers la fiche joueur en conservant le contexte du tournoi', () => {
    const wrapper = mountWithPrime(OutcomeTypeFunStats, {
      props: { stats: [funStat()], tournamentId: 't1' },
    })

    expect(wrapper.findComponent(RouterLinkStub).props('to')).toEqual({
      path: '/players/p1',
      query: { tournamentId: 't1' },
    })
  })
})
