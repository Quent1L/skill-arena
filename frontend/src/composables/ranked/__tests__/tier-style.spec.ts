import { describe, it, expect } from 'vitest'
import { makeTier } from '@/test-support/factories'
import { tierStyleIdx, getTierIconClass, getTierTextHex, TIER_ICON, TIER_TEXT_HEX } from '../tier-style'

describe('tierStyleIdx', () => {
  it('0 pour un tier null', () => {
    expect(tierStyleIdx(null)).toBe(0)
  })

  it('level - 1 dans la plage des styles', () => {
    expect(tierStyleIdx(makeTier({ level: 1 }))).toBe(0)
    expect(tierStyleIdx(makeTier({ level: 3 }))).toBe(2)
    expect(tierStyleIdx(makeTier({ level: 5 }))).toBe(4)
  })

  it('clampe au dernier style pour les niveaux au-delà', () => {
    expect(tierStyleIdx(makeTier({ level: 9 }))).toBe(TIER_ICON.length - 1)
  })
})

describe('getTierIconClass', () => {
  it('préfère iconClass du tier', () => {
    expect(getTierIconClass(makeTier({ level: 2, iconClass: 'fa fa-fire' }))).toBe('fa fa-fire')
  })

  it('retombe sur l’icône par niveau', () => {
    expect(getTierIconClass(makeTier({ level: 2, iconClass: null }))).toBe(TIER_ICON[1])
  })

  it('tier null → icône du premier niveau', () => {
    expect(getTierIconClass(null)).toBe(TIER_ICON[0])
  })
})

describe('getTierTextHex', () => {
  it('couleur par niveau', () => {
    expect(getTierTextHex(makeTier({ level: 3 }))).toBe(TIER_TEXT_HEX[2])
  })

  it('tier null → gris par défaut', () => {
    expect(getTierTextHex(null)).toBe('#9ca3af')
  })
})
