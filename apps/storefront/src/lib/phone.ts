/**
 * Client-side Algerian phone format check, mirroring the API rules
 * (`apps/api/src/common/dz/phone.ts`) so the shopper gets immediate feedback.
 * The API re-validates and normalises the number — it stays authoritative.
 */

const COUNTRY_CODE = "213"
const E164_PREFIX = `+${COUNTRY_CODE}`
const NATIONAL_DIGITS = 9

function stripFormatting(input: string): string {
  return input.replace(/[\s\-().]/g, "")
}

export function normalizePhone(input: string): string | null {
  const raw = stripFormatting(input.trim())
  if (!raw) return null

  let national: string
  if (raw.startsWith(E164_PREFIX)) {
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

export function isValidPhoneFormat(input: string): boolean {
  return normalizePhone(input) !== null
}
