import { describe, it, expect, vi } from 'vitest'
import { RouterLinkStub } from '@vue/test-utils'
import type { WeeklyMmrLeader } from '@skol-arena/shared'
import { mountWithPrime } from '@/test-support/mount'
import WeeklyMmrLeaders from '../WeeklyMmrLeaders.vue'

// t() echoes the key, plus the interpolated count when there is one, so assertions can
// check both the wording used and the number fed to it.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, count?: number) => (count === undefined ? key : `${key}:${count}`),
  }),
}))

function leader(overrides: Partial<WeeklyMmrLeader> = {}): WeeklyMmrLeader {
  return {
    playerId: 'p1',
    displayName: 'Thomas',
    shortName: 'THO',
    mmrGained: 42,
    matchesPlayed: 5,
    ...overrides,
  }
}

function mountCard(props: {
  gainers?: WeeklyMmrLeader[]
  losers?: WeeklyMmrLeader[]
  tournamentId?: string | null
}) {
  return mountWithPrime(WeeklyMmrLeaders, {
    props: { gainers: [], losers: [], ...props },
  })
}

describe('WeeklyMmrLeaders', () => {
  it('classe les gains dans l’ordre reçu et préfixe le delta d’un +', () => {
    const wrapper = mountCard({
      gainers: [
        leader({ playerId: 'a', displayName: 'Alice', mmrGained: 60 }),
        leader({ playerId: 'b', displayName: 'Bob', mmrGained: 25 }),
      ],
    })
    const text = wrapper.find('[data-test="gainers-list"]').text()
    expect(text.indexOf('Alice')).toBeLessThan(text.indexOf('Bob'))
    expect(text).toContain('+60')
    expect(text).toContain('+25')
  })

  it('affiche les pertes avec leur signe négatif, sans + ajouté', () => {
    const wrapper = mountCard({
      losers: [leader({ playerId: 'c', displayName: 'Chloe', mmrGained: -33 })],
    })
    const text = wrapper.find('[data-test="losers-list"]').text()
    expect(text).toContain('-33')
    expect(text).not.toContain('+')
  })

  it('affiche le nombre de matchs joués sur la semaine', () => {
    const wrapper = mountCard({ gainers: [leader({ matchesPlayed: 7 })] })
    expect(wrapper.find('[data-test="gainers-list"]').text()).toContain(
      'tournamentStatsTab.weeklyMmr.matchCount:7',
    )
  })

  it('remplace une colonne vide par le message dédié', () => {
    const wrapper = mountCard({ gainers: [leader()] })
    expect(wrapper.find('[data-test="losers-list"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('tournamentStatsTab.weeklyMmr.empty')
  })

  it('pointe vers la fiche joueur en conservant le contexte tournoi', () => {
    const wrapper = mountCard({
      gainers: [leader({ playerId: 'p9' })],
      tournamentId: 't1',
    })
    const link = wrapper.findComponent(RouterLinkStub)
    expect(link.props('to')).toEqual({ path: '/players/p9', query: { tournamentId: 't1' } })
  })

  it('dimensionne les barres relativement au leader de la colonne', () => {
    const wrapper = mountCard({
      gainers: [
        leader({ playerId: 'a', mmrGained: 80 }),
        leader({ playerId: 'b', mmrGained: 20 }),
      ],
    })
    const bars = wrapper.find('[data-test="gainers-list"]').findAll('.rounded-full .rounded-full')
    expect(bars[0].attributes('style')).toContain('width: 100%')
    expect(bars[1].attributes('style')).toContain('width: 25%')
  })
})
