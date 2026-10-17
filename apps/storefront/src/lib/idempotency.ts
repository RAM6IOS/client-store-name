/**
 * Idempotency keys prevent duplicate COD orders when a shopper retries a
 * submission (flaky network, double tap, back-and-forward). The server treats
 * a repeated key as the same logical request; we therefore reuse the same key
 * for retries of an unchanged cart and mint a new one whenever the cart changes.
 */

const MIN_LENGTH = 16
const MAX_LENGTH = 128

function randomToken(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID().replace(/-/g, "")
  }
  // Deterministic-free fallback for environments without WebCrypto.
  let out = ""
  for (let i = 0; i < 32; i += 1) {
    out += Math.floor(Math.random() * 16).toString(16)
  }
  return out
}

export function createIdempotencyKey(prefix = "chk"): string {
  const key = `${prefix}_${randomToken()}`
  return key.length > MAX_LENGTH ? key.slice(0, MAX_LENGTH) : key
}

export function isIdempotencyKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= MIN_LENGTH &&
    value.length <= MAX_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(value)
  )
}

/**
 * Stable, non-cryptographic signature of a cart's contents. Two carts with the
 * same lines (variant + quantity, order-independent) produce the same value,
 * which lets checkout reuse an idempotency key only while the order is
 * unchanged.
 */
export function cartSignature(lines: Array<{ variantId: string; quantity: number }>): string {
  const normalized = lines
    .filter((line) => line.quantity > 0)
    .map((line) => `${line.variantId}x${line.quantity}`)
    .sort()
    .join("|")
  let hash = 2166136261
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `${(hash >>> 0).toString(36)}-${normalized.length}`
}
