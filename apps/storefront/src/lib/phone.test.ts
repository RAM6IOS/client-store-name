import { describe, expect, it } from "vitest"
import { isValidPhoneFormat, normalizePhone } from "./phone"

describe("normalizePhone", () => {
  it("normalizes national, local, and international formats to E.164", () => {
    const expected = "+213551234567"
    expect(normalizePhone("0551234567")).toBe(expected)
    expect(normalizePhone("551234567")).toBe(expected)
    expect(normalizePhone("+213551234567")).toBe(expected)
    expect(normalizePhone("00213551234567")).toBe(expected)
    expect(normalizePhone("213551234567")).toBe(expected)
  })

  it("strips spaces, dashes, dots, and parentheses", () => {
    expect(normalizePhone("05 51-23.45(67)")).toBe("+213551234567")
  })

  it("rejects malformed numbers", () => {
    expect(normalizePhone("")).toBeNull()
    expect(normalizePhone("   ")).toBeNull()
    expect(normalizePhone("+21355123456")).toBeNull()
    expect(normalizePhone("+2135512345678")).toBeNull()
    expect(normalizePhone("05123abc7")).toBeNull()
  })
})

describe("isValidPhoneFormat", () => {
  it("mirrors normalizePhone success", () => {
    expect(isValidPhoneFormat("0551234567")).toBe(true)
    expect(isValidPhoneFormat("123")).toBe(false)
  })
})
