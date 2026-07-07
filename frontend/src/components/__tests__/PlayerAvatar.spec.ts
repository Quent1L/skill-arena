import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlayerAvatar from '../PlayerAvatar.vue'
import PlayerAvatarStack from '../PlayerAvatarStack.vue'
import { getAvatarBg } from '@/utils/StringUtils'

describe('PlayerAvatar', () => {
  it('affiche les initiales du nom', () => {
    const wrapper = mount(PlayerAvatar, { props: { name: 'John Doe' } })
    expect(wrapper.text()).toBe('JD')
  })

  it('couleur de fond dérivée du nom (ou du colorKey)', () => {
    // jsdom normalise les couleurs hex en rgb()
    const hexToRgb = (hex: string) =>
      `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`

    const byName = mount(PlayerAvatar, { props: { name: 'Alice' } })
    expect(byName.attributes('style')).toContain(`background: ${hexToRgb(getAvatarBg('Alice'))}`)

    const byKey = mount(PlayerAvatar, { props: { name: 'Alice', colorKey: 'ZZ' } })
    expect(byKey.attributes('style')).toContain(`background: ${hexToRgb(getAvatarBg('ZZ'))}`)
  })

  it('taille et forme pilotées par props', () => {
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

  it('rend un avatar par joueur', () => {
    const wrapper = mount(PlayerAvatarStack, { props: { players } })
    expect(wrapper.findAllComponents(PlayerAvatar)).toHaveLength(2)
  })

  it('chevauche les avatars seulement à partir de 2 joueurs', () => {
    const stacked = mount(PlayerAvatarStack, { props: { players } })
    expect(stacked.classes()).toContain('-space-x-2')

    const single = mount(PlayerAvatarStack, { props: { players: players.slice(0, 1) } })
    expect(single.classes()).not.toContain('-space-x-2')
  })
})
