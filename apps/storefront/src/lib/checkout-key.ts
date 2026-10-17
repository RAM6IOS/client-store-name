import { createIdempotencyKey } from "./idempotency"

/**
 * Persists the checkout idempotency key per cart signature in `sessionStorage`.
 * Retrying an unchanged order reuses the key (so the server deduplicates),
 * while editing the cart mints a new key for a genuinely new order.
 *
 * All storage access is guarded so the module is safe to import during SSR.
 */

const STORAGE_KEY = "bita.checkout.idempotency"

interface StoredKey {
  signature: string
  key: string
}

function readStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage
  } catch {
    return null
  }
}

function parse(raw: string | null): StoredKey | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as unknown
    if (
      typeof value === "object" &&
      value !== null &&
      typeof (value as StoredKey).signature === "string" &&
      typeof (value as StoredKey).key === "string"
    ) {
      return value as StoredKey
    }
    return null
  } catch {
    return null
  }
}

/** Returns a stable key for the given cart signature, creating one if needed. */
export function getOrCreateCheckoutKey(signature: string): string {
  const storage = readStorage()
  const existing = parse(storage?.getItem(STORAGE_KEY) ?? null)
  if (existing && existing.signature === signature) return existing.key

  const key = createIdempotencyKey("chk")
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ signature, key } satisfies StoredKey))
  } catch {
    // Storage full or unavailable: fall back to an in-memory key for this attempt.
  }
  return key
}

export function clearCheckoutKey(): void {
  try {
    readStorage()?.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
