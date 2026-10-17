import { dictionaries, type Dictionary, type TranslationKey } from "./dictionaries"
import { DEFAULT_LOCALE, resolveLocale, type Locale } from "./locales"

export * from "./locales"
export { dictionaries, type Dictionary, type TranslationKey } from "./dictionaries"

/** Returns the dictionary for a locale, falling back to Arabic. */
export function getDictionary(locale: unknown): Dictionary {
  return dictionaries[resolveLocale(locale ?? DEFAULT_LOCALE)]
}

/**
 * Interpolates `{name}` placeholders. Missing variables are left untouched so
 * a typo is visible in development rather than silently blank.
 */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key]
    return value === undefined ? match : String(value)
  })
}

/** Translates a key for a locale, interpolating any provided variables. */
export function translate(
  locale: unknown,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  return interpolate(getDictionary(locale)[key], vars)
}

export type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string

export function createTranslator(locale: Locale): Translate {
  const dict = getDictionary(locale)
  return (key, vars) => interpolate(dict[key], vars)
}
