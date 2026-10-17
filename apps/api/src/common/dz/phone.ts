/**
 * Algerian phone number helpers (Phase 3).
 *
 * Basic format validation and E.164 normalisation are kept deliberately
 * separate from phone *verification* (OTP, WhatsApp consent, active-line
 * checks). Verification is out of scope for Phase 3 — the API only validates
 * the format and stores one canonical form; a future `PhoneVerificationService`
 * plugs in behind the same stored number without changing validation.
 *
 * Accepted formats (tolerating spaces, dashes, dots and parentheses):
 *   - National:    0552345678  -> +213552345678
 *   - International:+213552345678 | 213552345678 | 00213552345678
 *   - Local mobile:552345678   -> +213552345678
 *
 * We intentionally accept any national number that is `0` followed by 9 digits
 * (0XXXXXXXXXX for fixed 02/03/04 and mobile 05/06/07/09) rather than
 * over-restricting, so valid Algerian formats are never rejected.
 */

const COUNTRY_CODE = "213"
const E164_PREFIX = `+${COUNTRY_CODE}`
const NATIONAL_DIGITS = 9

/** Strips formatting characters (spaces, dashes, dots, parentheses). */
function stripFormatting(input: string): string {
  return input.replace(/[\s\-().]/g, "")
}

/**
 * Returns the E.164 form (`+213552345678`) of an Algerian phone number, or
 * `null` when the input is not in a recognised format.
 */
export function normalizePhone(input: string): string | null {
  const raw = stripFormatting(input.trim())
  if (!raw) return null

  let national: string

  if (raw.startsWith(`+${COUNTRY_CODE}`)) {
    national = raw.slice(E164_PREFIX.length)
  } else if (raw.startsWith(`00${COUNTRY_CODE}`)) {
    national = raw.slice(5)
  } else if (raw.startsWith(COUNTRY_CODE)) {
    national = raw.slice(COUNTRY_CODE.length)
  } else if (raw.startsWith("0")) {
    national = raw.slice(1)
  } else {
    national = raw
  }

  if (!/^\d+$/.test(national)) return null
  if (national.length !== NATIONAL_DIGITS) return null

  return `${E164_PREFIX}${national}`
}

/** Performs the same checks as `normalizePhone` and returns a boolean. */
export function isValidPhoneFormat(input: string): boolean {
  return normalizePhone(input) !== null
}

/**
 * Masks a stored E.164 number for privacy-safe display, keeping the country
 * code, the first subscriber digit and the last two digits:
 *    +213552345678 -> +2135••••••78
 */
export function maskPhone(phone: string): string {
  const normalized = normalizePhone(phone)
  const value = normalized ?? phone
  const national = value.replace(E164_PREFIX, "")
  if (national.length < 4) return `${E164_PREFIX}••••`
  const first = national.slice(0, 1)
  const last = national.slice(-2)
  const middle = "•".repeat(national.length - 3)
  return `${E164_PREFIX}${first}${middle}${last}`
}