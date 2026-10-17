import { describe, expect, it } from "vitest"
import { isQuoteExpired, quoteTimeRemaining, totalMinor } from "./quote"

const NOW = Date.parse("2026-01-01T12:00:00.000Z")

describe("isQuoteExpired", () => {
  it("treats a missing or unparsable expiry as expired", () => {
    expect(isQuoteExpired(null, NOW)).toBe(true)
    expect(isQuoteExpired(undefined, NOW)).toBe(true)
    expect(isQuoteExpired("not-a-date", NOW)).toBe(true)
  })

  it("compares the expiry against now", () => {
    expect(isQuoteExpired("2026-01-01T12:05:00.000Z", NOW)).toBe(false)
    expect(isQuoteExpired("2026-01-01T11:59:59.000Z", NOW)).toBe(true)
    expect(isQuoteExpired("2026-01-01T12:00:00.000Z", NOW)).toBe(true)
  })
})

describe("quoteTimeRemaining", () => {
  it("returns the remaining milliseconds", () => {
    expect(quoteTimeRemaining("2026-01-01T12:05:00.000Z", NOW)).toBe(5 * 60 * 1000)
  })

  it("returns zero for expired or invalid quotes", () => {
    expect(quoteTimeRemaining("2026-01-01T11:00:00.000Z", NOW)).toBeLessThanOrEqual(0)
    expect(quoteTimeRemaining(null, NOW)).toBe(0)
    expect(quoteTimeRemaining("nope", NOW)).toBe(0)
  })
})

describe("totalMinor", () => {
  it("adds the delivery fee and subtracts discounts", () => {
    expect(totalMinor(120000n, "50000")).toBe(170000n)
    expect(totalMinor(120000n, 50000, "2000")).toBe(168000n)
    expect(totalMinor(120000n, 0)).toBe(120000n)
  })

  it("accepts bigint inputs", () => {
    expect(totalMinor(1n, 2n, 0n)).toBe(3n)
  })
})
