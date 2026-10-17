import { DEFAULT_LOCALE, LOCALE_TAG, type Locale } from "./i18n/locales"

/**
 * Money helpers for display only. The API stores money as integer minor units
 * (ADR-0005) and returns them as strings; every total shown here is a
 * convenience preview — the server remains authoritative at checkout.
 */

export function toMinorUnits(value: string | number | bigint): bigint {
  if (typeof value === "bigint") return value
  if (typeof value === "number") {
    return Number.isFinite(value) ? BigInt(Math.trunc(value)) : 0n
  }
  const trimmed = value.trim()
  if (!/^[+-]?\d+$/.test(trimmed)) return 0n
  return BigInt(trimmed)
}

export function sumMinorUnits(values: Array<string | number | bigint>): bigint {
  return values.reduce<bigint>((total, value) => total + toMinorUnits(value), 0n)
}

export function multiplyMinorUnits(value: string | number | bigint, quantity: number): bigint {
  const qty = Math.max(0, Math.trunc(quantity))
  return toMinorUnits(value) * BigInt(qty)
}

function decimalSeparator(locale: Locale): string {
  const parts = new Intl.NumberFormat(LOCALE_TAG[locale]).formatToParts(1.1)
  return parts.find((part) => part.type === "decimal")?.value ?? "."
}

/** Formats an integer (no minor units) with locale-aware grouping. */
export function formatInteger(value: bigint | number, locale: Locale = DEFAULT_LOCALE): string {
  const nf = new Intl.NumberFormat(LOCALE_TAG[locale], { maximumFractionDigits: 0 })
  return nf.format(typeof value === "number" ? Math.trunc(value) : value)
}

/**
 * Formats integer minor units as a localized amount string, e.g. `1 200,00 DZD`.
 * The currency code is appended in Latin uppercase (ISO 4217) for clarity.
 */
export function formatMoney(
  value: string | number | bigint,
  currencyCode: string,
  locale: Locale = DEFAULT_LOCALE,
  minorDigits = 2,
): string {
  const minor = toMinorUnits(value)
  const negative = minor < 0n
  const abs = negative ? -minor : minor
  const digits = Math.max(0, Math.trunc(minorDigits))
  const divisor = 10n ** BigInt(digits)
  const whole = abs / divisor
  const fraction = abs % divisor

  const wholeText = formatInteger(whole, locale)
  const sign = negative ? "−" : ""
  const code = currencyCode.toUpperCase()

  if (digits === 0) return `${sign}${wholeText} ${code}`
  const fractionText = fraction.toString().padStart(digits, "0")
  return `${sign}${wholeText}${decimalSeparator(locale)}${fractionText} ${code}`
}
