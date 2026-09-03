import { describe, it, expect } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import type { ClientBracketRound } from '@skol-arena/shared'

import fr from '@/i18n/messages/fr.json'
import en from '@/i18n/messages/en.json'
import { makeTier } from '@/test-support/factories'
import { useServerLabels } from '../serverLabels'

/**
 * Rendered through a real component so useI18n resolves against the actual message
 * files: the point of these resolvers is that the app's locale really applies to
 * names the server wrote once.
 */
function labels(locale: 'fr' | 'en' = 'fr') {
  const i18n = createI18n({ legacy: false, locale, fallbackLocale: 'fr', messages: { fr, en } })
  const Harness = defineComponent({ setup: () => useServerLabels(), render: () => null })

  return mount(Harness, { global: { plugins: [i18n] } }).vm
}

function makeRound(over: Partial<ClientBracketRound> = {}): ClientBracketRound {
  return {
    id: 'r-1',
    bracketConfigId: 'bc-1',
    roundNumber: 0,
    roundName: 'Demi-finales',
    roundNameKey: 'SEMI_FINALS',
    translationParams: null,
    bracketType: 'winners',
    matchesCount: 2,
    createdAt: new Date('2026-01-01'),
    ...over,
  }
}

describe('tierName', () => {
  it('renders a seeded tier in the app locale, not the one it was created in', () => {
    const tier = makeTier({ name: 'Confirmé', nameKey: 'CONFIRMED' })

    expect(labels('fr').tierName(tier)).toBe('Confirmé')
    expect(labels('en').tierName(tier)).toBe('Advanced')
  })

  it('keeps the name of a tier an organizer named by hand', () => {
    const tier = makeTier({ name: 'Vétéran', nameKey: null })

    expect(labels('en').tierName(tier)).toBe('Vétéran')
  })

  it('falls back on the stored name when the key is unknown to the client', () => {
    const tier = makeTier({ name: 'Mythique', nameKey: 'MYTHIC' })

    expect(labels('fr').tierName(tier)).toBe('Mythique')
  })

  it('dashes a missing tier', () => {
    expect(labels('fr').tierName(null)).toBe('—')
  })
})

describe('tierLabel', () => {
  it('appends the sub-rank to the translated name', () => {
    const tier = makeTier({ name: 'Légende', nameKey: 'LEGEND' })

    expect(labels('en').tierLabel(tier, 2)).toBe('Legend 2')
    expect(labels('en').tierLabel(tier, null)).toBe('Legend')
  })

  it('dashes a missing tier, sub-rank or not', () => {
    expect(labels('fr').tierLabel(null, 2)).toBe('—')
  })
})

describe('roundName', () => {
  it('renders a named round in the app locale', () => {
    expect(labels('fr').roundName(makeRound())).toBe('Demi-finales')
    expect(labels('en').roundName(makeRound())).toBe('Semi-finals')
  })

  it('interpolates a numbered round', () => {
    const round = makeRound({
      roundName: 'Tour 3',
      roundNameKey: 'ROUND',
      translationParams: { round: 3 },
    })

    expect(labels('en').roundName(round)).toBe('Round 3')
  })

  it('falls back on the stored name for a round written before the keys existed', () => {
    const round = makeRound({ roundName: 'Demi-finales', roundNameKey: null })

    expect(labels('en').roundName(round)).toBe('Demi-finales')
  })
})
