import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RecentFormBadges from '../RecentFormBadges.vue'

describe('RecentFormBadges', () => {
  it('rend un badge par résultat, dans l’ordre', () => {
    const wrapper = mount(RecentFormBadges, { props: { results: ['V', 'D', 'N'] } })
    const badges = wrapper.findAll('.w-4.h-4')
    expect(badges.map((b) => b.text())).toEqual(['V', 'D', 'N'])
  })

  it('couleur par résultat: V vert, D rouge, N gris', () => {
    const wrapper = mount(RecentFormBadges, { props: { results: ['V', 'D', 'N'] } })
    const badges = wrapper.findAll('.w-4.h-4')
    expect(badges[0].classes()).toContain('bg-green-600')
    expect(badges[1].classes()).toContain('bg-red-600')
    expect(badges[2].classes()).toContain('bg-gray-600')
  })

  it('aucun badge sans résultats', () => {
    const wrapper = mount(RecentFormBadges, { props: { results: [] } })
    expect(wrapper.findAll('.w-4.h-4')).toHaveLength(0)
  })
})
