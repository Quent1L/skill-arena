import { createI18n } from 'vue-i18n'
import fr from './messages/fr.json'
import en from './messages/en.json'

export const SUPPORTED_LOCALES = ['fr', 'en'] as const
export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: LocaleCode = 'fr'
export const LOCALE_STORAGE_KEY = 'locale'

export function isSupportedLocale(value: unknown): value is LocaleCode {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export function getInitialLocale(): LocaleCode {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
  return isSupportedLocale(stored) ? stored : DEFAULT_LOCALE
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: getInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: { fr, en },
})
