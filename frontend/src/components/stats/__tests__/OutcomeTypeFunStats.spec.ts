import { describe, it, expect, vi } from 'vitest'
import { RouterLinkStub } from '@vue/test-utils'
import type { OutcomeTypeFunStat, OutcomeTypeLeader } from '@skol-arena/shared'
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
    ...overrides,
  }
}

function funStat(overrides: Partial<OutcomeTypeFunStat> = {}): OutcomeTypeFunStat {
  return {
    outcomeTypeId: 'ot1',
    outcomeTypeName: 'Fin normale',
    totalMatches: 124,
    topWinnersByVolume: [leader()],
    topWinnersByRate: [leader({ playerId: 'p2', displayName: 'Rémi', ratePct: 88 })],
    topLosersByVolume: [leader({ playerId: 'p3', displayName: 'Matéo', count: 21 })],
    topLosersByRate: [leader({ playerId: 'p4', displayName: 'Julien', ratePct: 64 })],
    winnersRateIsLowSample: false,
    losersRateIsLowSample: false,
    ...overrides,
  }
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
    expect(wrapper.findComponent(InfoTooltip).props('text')).toBe(
      'tournamentStatsTab.outcomeTypeFunStats.efficiencyTooltip:3',
    )

    await wrapper.findComponent({ name: 'SelectButton' }).vm.$emit('update:modelValue', 'losers')

    const text = wrapper.text()
    expect(text).toContain('tournamentStatsTab.outcomeTypeFunStats.vulnerability')
    expect(text).not.toContain('tournamentStatsTab.outcomeTypeFunStats.efficiency')
    expect(wrapper.findComponent(InfoTooltip).props('text')).toBe(
      'tournamentStatsTab.outcomeTypeFunStats.vulnerabilityTooltip:3',
    )
  })

  it('signale un échantillon faible et adapte l’info-bulle', () => {
    const wrapper = mountWithPrime(OutcomeTypeFunStats, {
      props: { stats: [funStat({ winnersRateIsLowSample: true })] },
    })

    expect(wrapper.find('[data-test="low-sample-badge"]').text()).toContain(
      'tournamentStatsTab.outcomeTypeFunStats.lowSample:3',
    )
    expect(wrapper.findComponent(InfoTooltip).props('text')).toBe(
      'tournamentStatsTab.outcomeTypeFunStats.lowSampleTooltip:3',
    )
  })

  it('explique la pondération quand le seuil est respecté', () => {
    const wrapper = mountWithPrime(OutcomeTypeFunStats, { props: { stats: [funStat()] } })

    expect(wrapper.find('[data-test="low-sample-badge"]').exists()).toBe(false)
    expect(wrapper.findComponent(InfoTooltip).props('text')).toBe(
      'tournamentStatsTab.outcomeTypeFunStats.efficiencyTooltip:3',
    )
  })

  it('affiche un état vide quand aucun taux n’est calculable', () => {
    const wrapper = mountWithPrime(OutcomeTypeFunStats, {
      props: {
        stats: [funStat({ topWinnersByVolume: [], topWinnersByRate: [] })],
      },
    })

    expect(wrapper.find('[data-test="volume-list"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="rate-list"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('tournamentStatsTab.outcomeTypeFunStats.noRateData')
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
