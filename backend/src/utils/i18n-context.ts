import { AsyncLocalStorage } from "node:async_hooks";
import i18next from "../config/i18n";

/**
 * Request language carried out-of-band. i18next.changeLanguage() mutates the
 * shared singleton, so under concurrency a request could render in the language
 * of whichever request last touched it. The store is per-async-context instead.
 */
const langStorage = new AsyncLocalStorage<{ lng: string }>();

export function runWithLang<T>(lng: string, fn: () => T): T {
  return langStorage.run({ lng }, fn);
}

export function currentLang(): string {
  return langStorage.getStore()?.lng ?? "fr";
}

/** Translates in the current request's language. Outside a request, falls back to "fr". */
export function t(key: string, options?: Record<string, unknown>): string {
  return String(i18next.t(key, { lng: currentLang(), ...options }));
}
