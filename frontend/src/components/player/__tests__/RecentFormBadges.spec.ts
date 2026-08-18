import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RecentFormBadges from '../RecentFormBadges.vue'

describe('RecentFormBadges', () => {
  it('renders one badge per result, in order', () => {
    const wrapper = mount(RecentFormBadges, { props: { results: ['V', 'D', 'N'] } })
    const badges = wrapper.findAll('.w-4.h-4')
    expect(badges.map((b) => b.text())).toEqual(['V', 'D', 'N'])
  })

  it('color by result: V green, D red, N gray', () => {
    const wrapper = mount(RecentFormBadges, { props: { results: ['V', 'D', 'N'] } })
    const badges = wrapper.findAll('.w-4.h-4')
    expect(badges[0].classes()).toContain('bg-green-600')
    expect(badges[1].classes()).toContain('bg-red-600')
    expect(badges[2].classes()).toContain('bg-gray-600')
  })

  it('no badge with no results', () => {
    const wrapper = mount(RecentFormBadges, { props: { results: [] } })
    expect(wrapper.findAll('.w-4.h-4')).toHaveLength(0)
  })
})
