import { describe, expect, it } from "vitest"
import {
  formatInteger,
  formatMoney,
  multiplyMinorUnits,
  sumMinorUnits,
  toMinorUnits,
} from "./money"

describe("toMinorUnits", () => {
  it("parses integer strings returned by the API", () => {
    expect(toMinorUnits("120000")).toBe(120000n)
    expect(toMinorUnits("0")).toBe(0n)
    expect(toMinorUnits("-50")).toBe(-50n)
  })

  it("returns 0n for malformed input instead of throwing", () => {
    expect(toMinorUnits("12.34")).toBe(0n)
    expect(toMinorUnits("abc")).toBe(0n)
    expect(toMinorUnits("")).toBe(0n)
  })
})

describe("formatMoney", () => {
  it("formats minor units with the currency code appended", () => {
    expect(formatMoney("1234", "DZD", "fr")).toBe("12,34 DZD")
  })

  it("groups thousands and keeps two decimals", () => {
    const formatted = formatMoney("120000", "DZD", "fr")
    expect(formatted.endsWith("DZD")).toBe(true)
    expect(formatted).toContain("200,00")
  })

  it("supports zero minor digits", () => {
    expect(formatMoney("500", "JPY", "fr", 0)).toBe("500 JPY")
  })

  it("formats negative amounts with a sign", () => {
    expect(formatMoney("-100", "DZD", "fr")).toContain("1,00 DZD")
  })
})

describe("aggregate helpers", () => {
  it("sums and multiplies in minor units", () => {
    expect(sumMinorUnits(["1000", "250", 50])).toBe(1300n)
    expect(multiplyMinorUnits("120000", 3)).toBe(360000n)
  })

  it("clamps negative quantities to zero", () => {
    expect(multiplyMinorUnits("1000", -2)).toBe(0n)
  })

  it("formats integers with grouping", () => {
    expect(formatInteger(1541n, "fr")).toMatch(/1.?541/)
  })
})
