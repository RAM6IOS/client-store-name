import { describe, expect, it } from "vitest"
import { cartSignature, createIdempotencyKey, isIdempotencyKey } from "./idempotency"

describe("createIdempotencyKey", () => {
  it("produces valid keys of a bounded length", () => {
    const key = createIdempotencyKey()
    expect(isIdempotencyKey(key)).toBe(true)
    expect(key.startsWith("chk_")).toBe(true)
    expect(key.length).toBeLessThanOrEqual(128)
  })

  it("does not repeat across calls", () => {
    expect(createIdempotencyKey()).not.toBe(createIdempotencyKey())
  })
})

describe("isIdempotencyKey", () => {
  it("rejects short, long, and non-string values", () => {
    expect(isIdempotencyKey("abc")).toBe(false)
    expect(isIdempotencyKey("a".repeat(129))).toBe(false)
    expect(isIdempotencyKey(42)).toBe(false)
    expect(isIdempotencyKey("has space here 12345")).toBe(false)
  })
})

describe("cartSignature", () => {
  it("is independent of line order", () => {
    const a = cartSignature([
      { variantId: "v1", quantity: 1 },
      { variantId: "v2", quantity: 3 },
    ])
    const b = cartSignature([
      { variantId: "v2", quantity: 3 },
      { variantId: "v1", quantity: 1 },
    ])
    expect(a).toBe(b)
  })

  it("changes when quantities or variants change", () => {
    const base = cartSignature([{ variantId: "v1", quantity: 1 }])
    expect(cartSignature([{ variantId: "v1", quantity: 2 }])).not.toBe(base)
    expect(cartSignature([{ variantId: "v2", quantity: 1 }])).not.toBe(base)
  })

  it("ignores non-positive lines", () => {
    expect(cartSignature([{ variantId: "v1", quantity: 0 }])).toBe(cartSignature([]))
  })

  it("distinguishes different line combinations", () => {
    const a = cartSignature([
      { variantId: "v1", quantity: 1 },
      { variantId: "v2", quantity: 1 },
    ])
    const b = cartSignature([{ variantId: "v1", quantity: 2 }])
    expect(a).not.toBe(b)
  })
})
