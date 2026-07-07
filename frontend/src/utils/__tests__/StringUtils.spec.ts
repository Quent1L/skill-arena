import { describe, it, expect } from 'vitest'
import { getInitials, getAvatarBg } from '../StringUtils'

describe('getInitials', () => {
  it("'?' pour null ou vide", () => {
    expect(getInitials(null)).toBe('?')
    expect(getInitials(undefined)).toBe('?')
    expect(getInitials('')).toBe('?')
  })

  it('première lettre des premier et dernier mots', () => {
    expect(getInitials('John Doe')).toBe('JD')
    expect(getInitials('Jean Paul Marc')).toBe('JM')
  })

  it('deux premières lettres pour un seul mot', () => {
    expect(getInitials('alice')).toBe('AL')
  })

  it('ignore les espaces superflus', () => {
    expect(getInitials('  padded name  ')).toBe('PN')
  })
})

describe('getAvatarBg', () => {
  it('déterministe pour un même nom', () => {
    expect(getAvatarBg('Alice')).toBe(getAvatarBg('Alice'))
  })

  it('retourne une couleur hex', () => {
    expect(getAvatarBg('Bob')).toMatch(/^#[0-9a-f]{6}$/)
  })
})
