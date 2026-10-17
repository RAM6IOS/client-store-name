/**
 * Money helpers — integer minor units (ADR-0005).
 *
 * Every monetary amount in the system is stored as a signed integer number of
 * minor units (`BIGINT`) together with an ISO-4217 `currency_code`. The
 * currency's exponent (`minor_digits`, stored on the `Currency` model) defines
 * how many minor units make one major unit:
 *
 *   major = minor / 10^minor_digits      e.g. DZD (minor_digits = 2)
 *   1500.00 DZD  ->  150000 minor units
 *
 * Rounding policy (defined once, per ADR-0005 follow-up): **round half up
 * (away from zero at the minor-unit boundary)**. `parseDecimalToMinorUnits`
 * accepts a decimal string and rounds to the currency's exponent; callers that
 * require an exact number of minor units should reject strings with more
 * fractional digits themselves.
 *
 * `BIGINT` values are never serialised as JSON numbers (precision loss); the
 * API serialises them as strings.
 */

export interface Money {
  /** Signed integer number of minor units. */
  readonly amount: bigint
  /** ISO-4217 alpha-3 currency code, upper-case. */
  readonly currency: string
}

const CURRENCY_CODE_PATTERN = /^[A-Za-z]{3}$/
const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:\.(\d+))?$/

/** Upper-cases and validates an ISO-4217 alpha-3 currency code. */
export function normalizeCurrencyCode(code: string): string {
  const normalized = code.trim().toUpperCase()
  if (!CURRENCY_CODE_PATTERN.test(normalized)) {
    throw new Error(`Invalid currency code: "${code}" (expected 3 letters, e.g. "DZD")`)
  }
  return normalized
}

/** Validates a currency exponent (number of minor digits). */
export function assertMinorDigits(minorDigits: number): number {
  if (!Number.isInteger(minorDigits) || minorDigits < 0 || minorDigits > 6) {
    throw new Error(`Invalid minor_digits: ${minorDigits} (expected integer 0..6)`)
  }
  return minorDigits
}

/**
 * Parses a decimal string into integer minor units using round-half-up.
 *
 *   parseDecimalToMinorUnits("1500", 2)     -> 150000n
 *   parseDecimalToMinorUnits("1500.5", 2)   -> 150050n
 *   parseDecimalToMinorUnits("1500.555", 2) -> 150056n
 *   parseDecimalToMinorUnits("-1.005", 2)   -> -101n
 */
export function parseDecimalToMinorUnits(value: string | number, minorDigits: number): bigint {
  assertMinorDigits(minorDigits)

  const raw = typeof value === "number" ? numberToString(value) : value.trim()
  const match = DECIMAL_PATTERN.exec(raw)
  if (!match) {
    throw new Error(`Invalid decimal amount: "${value}"`)
  }

  const [, sign, intPart, fractionPart = ""] = match
  const scale = 10n ** BigInt(minorDigits)
  const keptDigits = fractionPart.slice(0, minorDigits).padEnd(minorDigits, "0")
  const discarded = fractionPart.slice(minorDigits)

  let minorUnits = BigInt(intPart) * scale + BigInt(keptDigits)

  // Half-up: any discarded digit >= 5 rounds the magnitude up.
  if (discarded.length > 0 && discarded[0] >= "5") {
    minorUnits += 1n
  }

  return sign === "-" ? -minorUnits : minorUnits
}

/** Formats integer minor units as a fixed-precision decimal string. */
export function formatMinorUnits(amount: bigint, minorDigits: number): string {
  assertMinorDigits(minorDigits)

  const negative = amount < 0n
  const magnitude = negative ? -amount : amount
  const scale = 10n ** BigInt(minorDigits)
  const whole = magnitude / scale
  const fraction = magnitude % scale

  const fractionText = minorDigits === 0 ? "" : `.${fraction.toString().padStart(minorDigits, "0")}`
  return `${negative ? "-" : ""}${whole.toString()}${fractionText}`
}

/** Asserts a minor-unit amount is a non-negative value. */
export function assertNonNegativeMinorUnits(amount: bigint, label = "amount"): bigint {
  if (amount < 0n) {
    throw new Error(`${label} must not be negative (received ${amount.toString()})`)
  }
  return amount
}

/** Adds two amounts; both must share the same currency. */
export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return { amount: a.amount + b.amount, currency: a.currency }
}

/** Compares two amounts; both must share the same currency. */
export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b)
  if (a.amount === b.amount) return 0
  return a.amount < b.amount ? -1 : 1
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`)
  }
}

/** Renders a `Money` value as a fixed-precision decimal string. */
export function formatMoney(money: Money, minorDigits: number): string {
  return formatMinorUnits(money.amount, minorDigits)
}

function numberToString(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid numeric amount: ${value}`)
  }
  return value.toString()
}
