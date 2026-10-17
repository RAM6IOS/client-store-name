export const LOCALES = ["ar", "fr"] as const

export type Locale = (typeof LOCALES)[number]

/** Arabic is the front-of-store default for the Algerian market. */
export const DEFAULT_LOCALE: Locale = "ar"

/** Cookie that persists the shopper's locale choice across requests. */
export const LOCALE_COOKIE = "locale"

/** Query parameter used for locale switching and hreflang alternates. */
export const LOCALE_QUERY_PARAM = "lang"

/** One year, in seconds. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export const LOCALE_LABELS: Record<Locale, { native: string; english: string }> = {
  ar: { native: "العربية", english: "Arabic" },
  fr: { native: "Français", english: "French" },
}

/** BCP-47 tag for the locale, including a Latin numbering system for clarity. */
export const LOCALE_TAG: Record<Locale, string> = {
  ar: "ar-DZ-u-nu-latn",
  fr: "fr-DZ",
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value)
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

export function directionOf(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr"
}
