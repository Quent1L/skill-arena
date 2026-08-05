import { describe, it, expect } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import SubTabTrack from '../SubTabTrack.vue'

const OPTIONS = [
  { value: 'a', label: 'Un' },
  { value: 'b', label: 'Deux' },
  { value: 'c', label: 'Trois' },
  { value: 'd', label: 'Quatre' },
]

function mountTrack(props: Record<string, unknown> = {}) {
  return mount(SubTabTrack, {
    props: { options: OPTIONS, modelValue: 'a', ...props },
    slots: Object.fromEntries(
      OPTIONS.map((option) => [option.value, () => h('p', `pane-${option.value}`)]),
    ),
  })
}

describe('SubTabTrack', () => {
  it('un label par vue, seule la vue active est sélectionnée', () => {
    const wrapper = mountTrack({ modelValue: 'b' })
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map((tab) => tab.text())).toEqual(['Un', 'Deux', 'Trois', 'Quatre'])
    expect(tabs.map((tab) => tab.attributes('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ])
  })

  it('un tap sur un label remonte la nouvelle vue', async () => {
    const wrapper = mountTrack()
    await wrapper.find('[data-test="subtab-c"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['c']])
  })

  it('un tap sur la vue déjà active ne remonte rien', async () => {
    const wrapper = mountTrack()
    await wrapper.find('[data-test="subtab-a"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  // Les voisins sont montés pour que le doigt ne révèle jamais un volet vide.
  it('ne monte que les vues à portée de glissement', async () => {
    const wrapper = mountTrack({ modelValue: 'b' })
    expect(wrapper.text()).toContain('pane-a')
    expect(wrapper.text()).toContain('pane-c')
    expect(wrapper.text()).not.toContain('pane-d')

    await wrapper.setProps({ modelValue: 'c' })
    expect(wrapper.text()).toContain('pane-d')
    expect(wrapper.text()).not.toContain('pane-a')
  })

  it('un rayon nul ne monte que la vue active', () => {
    const wrapper = mountTrack({ renderRadius: 0 })
    expect(wrapper.text()).toContain('pane-a')
    expect(wrapper.text()).not.toContain('pane-b')
  })

  it('annonce les vues montées, pour que leurs données soient chargées à temps', async () => {
    const wrapper = mountTrack()
    expect(wrapper.emitted('visible-values')).toEqual([[['a', 'b']]])

    await wrapper.setProps({ modelValue: 'b' })
    expect(wrapper.emitted('visible-values')).toEqual([[['a', 'b']], [['a', 'b', 'c']]])
  })

  it('les vues au repos sont retirées du parcours clavier et des lecteurs', () => {
    const wrapper = mountTrack({ modelValue: 'b' })
    const panes = wrapper.findAll('[aria-hidden]')
    expect(panes.map((pane) => pane.attributes('aria-hidden'))).toEqual([
      'true',
      'false',
      'true',
      'true',
    ])
  })
})
