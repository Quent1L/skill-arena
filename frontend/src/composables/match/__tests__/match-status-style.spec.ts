import { describe, it, expect } from 'vitest'
import { createI18n } from 'vue-i18n'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'

import fr from '@/i18n/messages/fr.json'
import en from '@/i18n/messages/en.json'
import {
  matchStatusDotClass,
  matchStatusLabelKey,
  matchStatusTone,
  useMatchStatus,
} from '../match-status-style'

/** Runs the composable inside a component, the only place useI18n() resolves. */
function withComposable(locale: 'fr' | 'en' = 'fr') {
  let api: ReturnType<typeof useMatchStatus> | null = null
  const i18n = createI18n({ legacy: false, locale, fallbackLocale: 'fr', messages: { fr, en } })
  const Host = defineComponent({
    setup() {
      api = useMatchStatus()
      return () => null
    },
  })
  mount(Host, { global: { plugins: [i18n] } })
  return api!
}

describe('match status vocabulary', () => {
  it('resolves legacy aliases onto their canonical status', () => {
    expect(matchStatusTone('ongoing')).toBe(matchStatusTone('pending_confirmation'))
    expect(matchStatusTone('contested')).toBe(matchStatusTone('disputed'))
    expect(matchStatusLabelKey('contested')).toBe('matchStatus.disputed')
    expect(matchStatusDotClass('ongoing')).toBe(matchStatusDotClass('pending_confirmation'))
  })

  it('gives every known status a translated label in both locales', () => {
    const statuses = [
      'scheduled',
      'reported',
      'pending_confirmation',
      'confirmed',
      'disputed',
      'finalized',
      'cancelled',
    ]

    for (const localeName of ['fr', 'en'] as const) {
      const { statusLabel } = withComposable(localeName)
      for (const status of statuses) {
        const label = statusLabel(status)
        expect(label).toBeTruthy()
        expect(label).not.toBe(status)
        expect(label).not.toMatch(/matchStatus\./)
      }
    }
  })

  it('reads the same for a card status and its detail-view equivalent', () => {
    const { statusLabel } = withComposable()
    expect(statusLabel('finalized')).toBe(fr.matchStatus.finalized)
    expect(statusLabel('ongoing')).toBe(statusLabel('pending_confirmation'))
  })

  it('falls back to the raw value on an unknown status', () => {
    const { statusLabel } = withComposable()
    expect(statusLabel('teleported')).toBe('teleported')
    expect(statusLabel(undefined)).toBe('')
    expect(matchStatusTone('teleported')).toBe('neutral')
  })
})
