import { i18n } from '@/i18n'

/** Error shape returned by the Better Auth client on a failed call. */
export interface AuthClientError {
  code?: string
  message?: string
}

/**
 * Better Auth answers with a hardcoded English message (its BASE_ERROR_CODES table)
 * next to a stable `code`. Translate on the code; the raw message is only a last
 * resort so an unmapped code still says something rather than nothing.
 */
export function translateAuthError(
  error: AuthClientError | null | undefined,
  fallbackKey: string,
): string {
  const key = error?.code ? `auth.errors.codes.${error.code}` : null
  if (key && i18n.global.te(key)) {
    return i18n.global.t(key)
  }
  return error?.message || i18n.global.t(fallbackKey)
}
