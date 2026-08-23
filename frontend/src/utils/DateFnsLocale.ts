import { enGB, fr } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import { DEFAULT_LOCALE, isSupportedLocale, type LocaleCode } from '@/i18n'

const LOCALES: Record<LocaleCode, Locale> = {
  fr,
  en: enGB,
}

/**
 * date-fns locale matching the active interface language.
 *
 * Relative dates ("in 2 days") come from date-fns, which needs its own locale
 * object: passing none, or hardcoding `fr`, leaves French wording inside an
 * otherwise English page.
 */
export function dateFnsLocaleFor(code: string): Locale {
  return LOCALES[isSupportedLocale(code) ? code : DEFAULT_LOCALE]
}
