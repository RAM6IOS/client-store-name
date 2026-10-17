import { describe, expect, it } from "vitest"
import { minorToMajorInput, parseMajorToMinor } from "./money-input"

describe("minorToMajorInput", () => {
  it("converts minor units to a two-decimal input value", () => {
    expect(minorToMajorInput("800")).toBe("8.00")
    expect(minorToMajorInput("80000")).toBe("800.00")
    expect(minorToMajorInput("5")).toBe("0.05")
  })

  it("renders a blank input for a missing rate", () => {
    expect(minorToMajorInput(null)).toBe("")
    expect(minorToMajorInput(undefined)).toBe("")
    expect(minorToMajorInput("")).toBe("")
  })
})

describe("parseMajorToMinor", () => {
  it("converts a major-unit input to integer minor units", () => {
    expect(parseMajorToMinor("8.00")).toBe("800")
    expect(parseMajorToMinor("8")).toBe("800")
    expect(parseMajorToMinor("800.5")).toBe("80050")
    expect(parseMajorToMinor("8,50")).toBe("850")
  })

  it("round-trips a formatted value", () => {
    const minor = "1450"
    expect(parseMajorToMinor(minorToMajorInput(minor))).toBe(minor)
  })

  it("returns null for an empty input (not configured)", () => {
    expect(parseMajorToMinor("")).toBeNull()
    expect(parseMajorToMinor("   ")).toBeNull()
  })

  it("returns undefined for invalid or negative input", () => {
    expect(parseMajorToMinor("-1")).toBeUndefined()
    expect(parseMajorToMinor("abc")).toBeUndefined()
    expect(parseMajorToMinor("1.2.3")).toBeUndefined()
  })
})