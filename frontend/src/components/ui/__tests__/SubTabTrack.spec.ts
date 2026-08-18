import { describe, it, expect } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import SubTabTrack from '../SubTabTrack.vue'

const OPTIONS = [
  { value: 'a', label: 'One' },
  { value: 'b', label: 'Two' },
  { value: 'c', label: 'Three' },
  { value: 'd', label: 'Four' },
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
  it('one label per view, only the active view is selected', () => {
    const wrapper = mountTrack({ modelValue: 'b' })
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map((tab) => tab.text())).toEqual(['One', 'Two', 'Three', 'Four'])
    expect(tabs.map((tab) => tab.attributes('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ])
  })

  it('tapping a label emits the new view', async () => {
    const wrapper = mountTrack()
    await wrapper.find('[data-test="subtab-c"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['c']])
  })

  it('tapping the already-active view emits nothing', async () => {
    const wrapper = mountTrack()
    await wrapper.find('[data-test="subtab-a"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  // The neighbors are mounted so the finger never reveals an empty pane.
  it('only mounts the views within swipe reach', async () => {
    const wrapper = mountTrack({ modelValue: 'b' })
    expect(wrapper.text()).toContain('pane-a')
    expect(wrapper.text()).toContain('pane-c')
    expect(wrapper.text()).not.toContain('pane-d')

    await wrapper.setProps({ modelValue: 'c' })
    expect(wrapper.text()).toContain('pane-d')
    expect(wrapper.text()).not.toContain('pane-a')
  })

  it('a zero radius mounts only the active view', () => {
    const wrapper = mountTrack({ renderRadius: 0 })
    expect(wrapper.text()).toContain('pane-a')
    expect(wrapper.text()).not.toContain('pane-b')
  })

  it('announces the mounted views, so their data loads in time', async () => {
    const wrapper = mountTrack()
    expect(wrapper.emitted('visible-values')).toEqual([[['a', 'b']]])

    await wrapper.setProps({ modelValue: 'b' })
    expect(wrapper.emitted('visible-values')).toEqual([[['a', 'b']], [['a', 'b', 'c']]])
  })

  it('idle views are removed from keyboard navigation and screen readers', () => {
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
