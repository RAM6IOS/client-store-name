import { toMinorUnits } from "./money"

/**
 * Pure helpers around delivery quotes and order totals. A delivery quote has a
 * server-provided expiry; the UI must refresh rather than submit a stale quote.
 */

export interface QuoteLike {
  fee_amount: string
  currency_code: string
  expires_at: string | null
}

export function isQuoteExpired(expiresAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!expiresAt) return true
  const parsed = Date.parse(expiresAt)
  if (Number.isNaN(parsed)) return true
  return parsed <= now
}

/** Milliseconds until a quote expires (<= 0 when expired). */
export function quoteTimeRemaining(
  expiresAt: string | null | undefined,
  now: number = Date.now(),
): number {
  if (!expiresAt) return 0
  const parsed = Date.parse(expiresAt)
  if (Number.isNaN(parsed)) return 0
  return parsed - now
}

export function totalMinor(
  subtotal: bigint,
  deliveryFee: string | number | bigint,
  discount: string | number | bigint = 0n,
): bigint {
  return subtotal + toMinorUnits(deliveryFee) - toMinorUnits(discount)
}
