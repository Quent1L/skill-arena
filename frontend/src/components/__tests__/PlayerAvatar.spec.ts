import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlayerAvatar from '../PlayerAvatar.vue'
import PlayerAvatarStack from '../PlayerAvatarStack.vue'
import { getAvatarBg } from '@/utils/StringUtils'

describe('PlayerAvatar', () => {
  it('shows the name’s initials', () => {
    const wrapper = mount(PlayerAvatar, { props: { name: 'John Doe' } })
    expect(wrapper.text()).toBe('JD')
  })

  it('background color derived from the name (or colorKey)', () => {
    // jsdom normalizes hex colors to rgb()
    const hexToRgb = (hex: string) =>
      `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`

    const byName = mount(PlayerAvatar, { props: { name: 'Alice' } })
    expect(byName.attributes('style')).toContain(`background: ${hexToRgb(getAvatarBg('Alice'))}`)

    const byKey = mount(PlayerAvatar, { props: { name: 'Alice', colorKey: 'ZZ' } })
    expect(byKey.attributes('style')).toContain(`background: ${hexToRgb(getAvatarBg('ZZ'))}`)
  })

  it('size and shape driven by props', () => {
    const small = mount(PlayerAvatar, { props: { name: 'A', size: 'sm', shape: 'circle' } })
    expect(small.classes()).toContain('w-7')
    expect(small.classes()).toContain('rounded-full')

    const defaultShape = mount(PlayerAvatar, { props: { name: 'A' } })
    expect(defaultShape.classes()).toContain('w-9')
    expect(defaultShape.classes()).toContain('rounded-md')
  })
})

describe('PlayerAvatarStack', () => {
  const players = [
    { id: 'p1', displayName: 'Alice Doe', shortName: 'AD' },
    { id: 'p2', displayName: 'Bob Roe', shortName: 'BR' },
  ]

  it('renders one avatar per player', () => {
    const wrapper = mount(PlayerAvatarStack, { props: { players } })
    expect(wrapper.findAllComponents(PlayerAvatar)).toHaveLength(2)
  })

  it('overlaps the avatars only from 2 players onward', () => {
    const stacked = mount(PlayerAvatarStack, { props: { players } })
    expect(stacked.classes()).toContain('-space-x-2')

    const single = mount(PlayerAvatarStack, { props: { players: players.slice(0, 1) } })
    expect(single.classes()).not.toContain('-space-x-2')
  })

  const roster = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `p${i}`,
      displayName: `Player ${i}`,
      shortName: `P${i}`,
    }))

  it('shows all avatars up to 3 players', () => {
    const wrapper = mount(PlayerAvatarStack, { props: { players: roster(3) } })

    expect(wrapper.findAllComponents(PlayerAvatar)).toHaveLength(3)
    expect(wrapper.text()).not.toContain('+')
  })

  it('beyond 3, keeps the first 3 and counts the rest', () => {
    const wrapper = mount(PlayerAvatarStack, { props: { players: roster(5) } })

    const avatars = wrapper.findAllComponents(PlayerAvatar)
    expect(avatars).toHaveLength(3)
    expect(avatars.map((a) => a.props('name'))).toEqual(['Player 0', 'Player 1', 'Player 2'])
    expect(wrapper.text()).toContain('+2')
  })

  it('the chip lists the hidden players on hover and follows the requested size', () => {
    const wrapper = mount(PlayerAvatarStack, { props: { players: roster(5), size: 'xs' } })
    const chip = wrapper.find('[title]')

    expect(chip.attributes('title')).toBe('Player 3, Player 4')
    expect(chip.classes()).toContain('w-6')
  })

  it('respects a custom limit', () => {
    const wrapper = mount(PlayerAvatarStack, { props: { players: roster(5), max: 4 } })

    expect(wrapper.findAllComponents(PlayerAvatar)).toHaveLength(4)
    expect(wrapper.text()).toContain('+1')
  })
})
