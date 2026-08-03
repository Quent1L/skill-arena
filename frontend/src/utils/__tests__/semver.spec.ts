import { describe, expect, it } from 'vitest'
import { compareSemver, isVersionBelowMin } from '../semver'

describe('compareSemver', () => {
  it('traite les versions identiques comme égales', () => {
    expect(compareSemver('1.18.1', '1.18.1')).toBe(0)
  })

  it('compare les segments numériquement, pas lexicographiquement', () => {
    expect(compareSemver('1.9.0', '1.10.0')).toBeLessThan(0)
    expect(compareSemver('1.10.0', '1.9.0')).toBeGreaterThan(0)
  })

  it('donne la priorité au segment le plus significatif', () => {
    expect(compareSemver('2.0.0', '1.99.99')).toBeGreaterThan(0)
  })

  it('complète les segments manquants par 0', () => {
    expect(compareSemver('1.2', '1.2.0')).toBe(0)
    expect(compareSemver('1.2', '1.2.1')).toBeLessThan(0)
  })

  it('accepte un préfixe v', () => {
    expect(compareSemver('v1.18.1', '1.18.1')).toBe(0)
  })
})

describe('isVersionBelowMin', () => {
  it('exige la mise à jour sous le plancher', () => {
    expect(isVersionBelowMin('1.17.0', '1.18.0')).toBe(true)
  })

  it("n'exige rien à partir du plancher", () => {
    expect(isVersionBelowMin('1.18.0', '1.18.0')).toBe(false)
    expect(isVersionBelowMin('1.20.0', '1.18.0')).toBe(false)
  })

  it("n'exige rien sans plancher", () => {
    expect(isVersionBelowMin('1.17.0', null)).toBe(false)
    expect(isVersionBelowMin('1.17.0', '')).toBe(false)
  })

  // Bloquer l'app sur une valeur qu'on n'a pas su lire serait le pire des échecs.
  it('dégrade vers non bloquant sur une entrée illisible', () => {
    expect(isVersionBelowMin('1.17.0', 'latest')).toBe(false)
  })
})
