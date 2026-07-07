import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ClientTournamentSummary } from '@skol-arena/shared/types/index'
import TournamentCard from '../TournamentCard.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

function makeSummary(over: Partial<ClientTournamentSummary> = {}): ClientTournamentSummary {
  return {
    id: 't1',
    name: 'Summer Cup',
    mode: 'championship',
    teamMode: 'flex',
    status: 'ongoing',
    startDate: new Date('2026-06-01'),
    endDate: new Date('2026-08-31'),
    ...over,
  } as ClientTournamentSummary
}

describe('TournamentCard', () => {
  it('affiche nom, statut et mode', () => {
    const wrapper = mount(TournamentCard, { props: { tournament: makeSummary() } })
    expect(wrapper.text()).toContain('Summer Cup')
    expect(wrapper.text()).toContain('tournamentCard.status.ongoing')
    expect(wrapper.text()).toContain('tournamentCard.mode.championship')
  })

  it('accent visuel selon le mode', () => {
    const ranked = mount(TournamentCard, {
      props: { tournament: makeSummary({ mode: 'ranked' }) },
    })
    expect(ranked.classes()).toContain('mode-ranked')
  })

  it('affiche la discipline quand présente', () => {
    const wrapper = mount(TournamentCard, {
      props: {
        tournament: makeSummary({ discipline: { id: 'd1', name: 'Babyfoot' } }),
      },
    })
    expect(wrapper.text()).toContain('Babyfoot')
  })

  it('émet click avec le tournoi', async () => {
    const tournament = makeSummary()
    const wrapper = mount(TournamentCard, { props: { tournament } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toEqual([[tournament]])
  })

  it('barre de progression pleine pour un tournoi terminé', () => {
    const wrapper = mount(TournamentCard, {
      props: { tournament: makeSummary({ status: 'finished' }) },
    })
    expect(wrapper.find('.progress-bar').attributes('style')).toContain('width: 100%')
    expect(wrapper.text()).toContain('tournamentCard.period.finished')
  })
})
