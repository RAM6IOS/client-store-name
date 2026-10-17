/**
 * Delivery fees are entered in major units (dinars) in the dashboard, but the
 * API stores money as integer minor units (ADR-0005). This store is
 * Algeria-only with DZD (2 minor digits) as its base currency, so the admin
 * config screens convert with a fixed precision rather than threading the
 * currency's `minor_digits` through every form.
 */
const MINOR_DIGITS = 2

/** Renders integer minor units as a plain decimal string for a form input. */
export function minorToMajorInput(
  minor: string | number | bigint | null | undefined,
  digits = MINOR_DIGITS,
): string {
  if (minor === null || minor === undefined || minor === "") return ""
  let value: bigint
  try {
    value = BigInt(minor)
  } catch {
    return ""
  }
  const negative = value < 0n
  const abs = negative ? -value : value
  const divisor = 10n ** BigInt(digits)
  const whole = abs / divisor
  const fraction = abs % divisor
  const sign = negative ? "-" : ""
  if (digits === 0) return `${sign}${whole}`
  return `${sign}${whole}.${fraction.toString().padStart(digits, "0")}`
}

/**
 * Parses a major-unit input into integer minor units. Returns `null` for an
 * empty value (meaning "not configured") and `undefined` for an invalid or
 * negative value so the caller can reject the whole submission.
 */
export function parseMajorToMinor(
  input: string,
  digits = MINOR_DIGITS,
): string | null | undefined {
  const trimmed = input.trim().replace(/\s/g, "").replace(",", ".")
  if (!trimmed) return null
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return undefined
  const [wholePart, fractionPart = ""] = trimmed.split(".")
  const fraction = (fractionPart + "0".repeat(digits)).slice(0, digits)
  try {
    const minor = BigInt(wholePart) * 10n ** BigInt(digits) + BigInt(fraction || "0")
    return minor.toString()
  } catch {
    return undefined
  }
}
