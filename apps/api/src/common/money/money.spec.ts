import {
  addMoney,
  assertMinorDigits,
  assertNonNegativeMinorUnits,
  compareMoney,
  formatMinorUnits,
  formatMoney,
  normalizeCurrencyCode,
  parseDecimalToMinorUnits,
} from "./money"

describe("money", () => {
  describe("normalizeCurrencyCode", () => {
    it("upper-cases and trims a valid code", () => {
      expect(normalizeCurrencyCode("dzd")).toBe("DZD")
      expect(normalizeCurrencyCode("  eur ")).toBe("EUR")
    })

    it("rejects malformed codes", () => {
      expect(() => normalizeCurrencyCode("DZ")).toThrow(/Invalid currency code/)
      expect(() => normalizeCurrencyCode("DZDX")).toThrow(/Invalid currency code/)
      expect(() => normalizeCurrencyCode("12A")).toThrow(/Invalid currency code/)
    })
  })

  describe("assertMinorDigits", () => {
    it("accepts 0..6 integers", () => {
      expect(assertMinorDigits(0)).toBe(0)
      expect(assertMinorDigits(2)).toBe(2)
      expect(assertMinorDigits(6)).toBe(6)
    })

    it("rejects out-of-range or non-integer exponents", () => {
      expect(() => assertMinorDigits(-1)).toThrow(/Invalid minor_digits/)
      expect(() => assertMinorDigits(1.5)).toThrow(/Invalid minor_digits/)
      expect(() => assertMinorDigits(7)).toThrow(/Invalid minor_digits/)
    })
  })

  describe("parseDecimalToMinorUnits", () => {
    it("converts whole and fractional amounts at the currency exponent", () => {
      expect(parseDecimalToMinorUnits("1500", 2)).toBe(150000n)
      expect(parseDecimalToMinorUnits("1500.00", 2)).toBe(150000n)
      expect(parseDecimalToMinorUnits("1500.5", 2)).toBe(150050n)
      expect(parseDecimalToMinorUnits("0.01", 2)).toBe(1n)
      expect(parseDecimalToMinorUnits("1234.5678", 0)).toBe(1235n)
    })

    it("rounds half up (away from zero)", () => {
      expect(parseDecimalToMinorUnits("1500.555", 2)).toBe(150056n)
      expect(parseDecimalToMinorUnits("0.005", 2)).toBe(1n)
      expect(parseDecimalToMinorUnits("0.004", 2)).toBe(0n)
      expect(parseDecimalToMinorUnits("-1.005", 2)).toBe(-101n)
      expect(parseDecimalToMinorUnits("2.5", 0)).toBe(3n)
      expect(parseDecimalToMinorUnits("-2.5", 0)).toBe(-3n)
    })

    it("preserves the exact value when extra precision rounds to a carry", () => {
      expect(parseDecimalToMinorUnits("9.999", 2)).toBe(1000n)
    })

    it("accepts numbers as well as strings", () => {
      expect(parseDecimalToMinorUnits(1500, 2)).toBe(150000n)
    })

    it("rejects malformed input", () => {
      expect(() => parseDecimalToMinorUnits("abc", 2)).toThrow(/Invalid decimal amount/)
      expect(() => parseDecimalToMinorUnits("1.2.3", 2)).toThrow(/Invalid decimal amount/)
      expect(() => parseDecimalToMinorUnits("", 2)).toThrow(/Invalid decimal amount/)
      expect(() => parseDecimalToMinorUnits(Number.NaN, 2)).toThrow(/Invalid numeric amount/)
      expect(() => parseDecimalToMinorUnits(Number.POSITIVE_INFINITY, 2)).toThrow(
        /Invalid numeric amount/,
      )
    })
  })

  describe("formatMinorUnits", () => {
    it("renders fixed precision", () => {
      expect(formatMinorUnits(150000n, 2)).toBe("1500.00")
      expect(formatMinorUnits(5n, 2)).toBe("0.05")
      expect(formatMinorUnits(0n, 2)).toBe("0.00")
      expect(formatMinorUnits(-101n, 2)).toBe("-1.01")
      expect(formatMinorUnits(1500n, 0)).toBe("1500")
    })

    it("round-trips through parse (for exactly representable values)", () => {
      const amount = 150056n
      expect(parseDecimalToMinorUnits(formatMinorUnits(amount, 2), 2)).toBe(amount)
    })
  })

  describe("assertNonNegativeMinorUnits", () => {
    it("passes non-negative values through", () => {
      expect(assertNonNegativeMinorUnits(0n)).toBe(0n)
      expect(assertNonNegativeMinorUnits(10n, "price")).toBe(10n)
    })

    it("rejects negative values", () => {
      expect(() => assertNonNegativeMinorUnits(-1n, "price")).toThrow(/price must not be negative/)
    })
  })

  describe("Money arithmetic", () => {
    const a = { amount: 100n, currency: "DZD" }
    const b = { amount: 23n, currency: "DZD" }

    it("adds and compares same-currency amounts", () => {
      expect(addMoney(a, b)).toEqual({ amount: 123n, currency: "DZD" })
      expect(compareMoney(a, b)).toBe(1)
      expect(compareMoney(b, a)).toBe(-1)
      expect(compareMoney(a, a)).toBe(0)
      expect(formatMoney(a, 2)).toBe("1.00")
    })

    it("rejects mixed currencies", () => {
      expect(() => addMoney(a, { amount: 1n, currency: "USD" })).toThrow(/Currency mismatch/)
      expect(() => compareMoney(a, { amount: 1n, currency: "USD" })).toThrow(/Currency mismatch/)
    })
  })
})
