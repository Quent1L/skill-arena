import { describe, it, expect, vi } from 'vitest'
import { RouterLinkStub } from '@vue/test-utils'
import { mountWithPrime } from '@/test-support/mount'
import { makeTier, makePlayerMmr } from '@/test-support/factories'
import RankedLeaderboard from '../RankedLeaderboard.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  createI18n: () => ({ global: { t: (key: string) => key }, install: () => {} }),
}))

const tiers = [
  makeTier({ id: 'bronze', level: 1, name: 'Bronze', minMmr: 700 }),
  makeTier({ id: 'gold', level: 2, name: 'Gold', minMmr: 1100 }),
]

const players = [
  makePlayerMmr({
    currentMmr: 1450,
    player: { id: 'u1', displayName: 'Alice', shortName: 'AL' },
  }),
  makePlayerMmr({
    currentMmr: 1000,
    player: { id: 'u2', displayName: 'Bob', shortName: 'BO' },
  }),
]

function mountBoard(props: Record<string, unknown> = {}) {
  // showModeToggle est une prop Boolean optionnelle: absente, Vue la caste à false
  return mountWithPrime(RankedLeaderboard, {
    props: { players, tiers, showModeToggle: true, ...props },
  })
}

describe('RankedLeaderboard', () => {
  it('sans tiers: message dédié', () => {
    const wrapper = mountBoard({ tiers: [] })
    expect(wrapper.text()).toContain('rankedLeaderboard.noTiers')
  })

  it('groupe les joueurs sous le bon tier, tiers du plus haut au plus bas', () => {
    const wrapper = mountBoard()
    const text = wrapper.text()
    // Gold en premier (tri desc), Alice (1450) dedans; Bob (1000) en Bronze
    expect(text.indexOf('Gold')).toBeLessThan(text.indexOf('Bronze'))
    expect(text.indexOf('Gold')).toBeLessThan(text.indexOf('Alice'))
    expect(text.indexOf('Bronze')).toBeLessThan(text.indexOf('Bob'))
    expect(text.indexOf('Alice')).toBeLessThan(text.indexOf('Bronze'))
  })

  it('bascule provisoire: émet load-provisional une seule fois', async () => {
    const wrapper = mountBoard()
    const toggle = wrapper.findComponent({ name: 'SelectButton' })
    await toggle.vm.$emit('update:modelValue', 'provisional')
    await toggle.vm.$emit('update:modelValue', 'official')
    await toggle.vm.$emit('update:modelValue', 'provisional')
    expect(wrapper.emitted('load-provisional')).toHaveLength(1)
  })

  it('premier chargement: spinner plein écran', () => {
    const wrapper = mountBoard({ players: [], loading: true })
    expect(wrapper.findComponent({ name: 'ProgressSpinner' }).exists()).toBe(true)
  })

  it('rafraîchissement avec données: bannière discrète, liste conservée', () => {
    const wrapper = mountBoard({ loading: true })
    expect(wrapper.findComponent({ name: 'ProgressSpinner' }).exists()).toBe(false)
    expect(wrapper.text()).toContain('rankedLeaderboard.refreshing')
    expect(wrapper.text()).toContain('Alice')
  })

  it('recalcul en cours: bannière dédiée', () => {
    const wrapper = mountBoard({ isRecalculating: true })
    expect(wrapper.text()).toContain('rankedLeaderboard.recalculating')
  })

  it('ligne du joueur courant mise en évidence', () => {
    const wrapper = mountBoard({ currentUserId: 'u1' })
    const rows = wrapper.findAllComponents(RouterLinkStub)
    const aliceRow = rows.find((r) => r.text().includes('Alice'))
    expect(aliceRow!.classes()).toContain('bg-primary-900/30')
    expect(aliceRow!.text()).toContain('rankedLeaderboard.you')
  })

  it('masquage de la bascule via showModeToggle', () => {
    const wrapper = mountBoard({ showModeToggle: false })
    expect(wrapper.findComponent({ name: 'SelectButton' }).exists()).toBe(false)
  })
})
