import { describe, expect, it } from "vitest"
import { collectRateDrafts, initialRateValues, parseRatesCsv } from "./delivery-rates"

function entries(data: Record<string, string>): Array<[string, string]> {
  return Object.entries(data)
}

describe("collectRateDrafts", () => {
  it("collects configured home and stop-desk rows with valid fees", () => {
    const result = collectRateDrafts(
      entries({
        home_fee_16: "800.00",
        home_active_16: "on",
        stop_fee_16: "500",
        stop_active_16: "on",
      }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rates).toHaveLength(2)
    expect(result.rates[0]).toMatchObject({ code: "16", method: "home" })
    expect(result.rates[0].draft.fee).toBe("80000")
    expect(result.rates[0].draft.active).toBe(true)
    expect(result.rates[1]).toMatchObject({ code: "16", method: "stop_desk" })
    expect(result.rates[1].draft.fee).toBe("50000")
  })

  it("skips rows left empty (not configured)", () => {
    const result = collectRateDrafts(
      entries({
        home_fee_16: "",
        home_active_16: "",
        stop_fee_16: "250",
        stop_active_16: "on",
      }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rates).toHaveLength(1)
    expect(result.rates[0].method).toBe("stop_desk")
  })

  it("rejects a row enabled with no fee", () => {
    const result = collectRateDrafts(
      entries({
        home_fee_16: "",
        home_active_16: "on",
      }),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toBe("activeWithoutFee")
    expect(result.errors).toMatchObject({ home_active_16: "feeRequired" })
  })

  it("flags an invalid fee on its row and preserves every raw value", () => {
    const submitted = {
      home_fee_16: "abc",
      home_active_16: "on",
      stop_fee_16: "100",
      stop_active_16: "on",
    }
    const result = collectRateDrafts(entries(submitted))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toBe("invalid")
    expect(result.errors).toMatchObject({ home_fee_16: "invalidFee" })
    expect(result.values).toMatchObject(submitted)
  })

  it("records the unchecked state for rows that have a fee but no checkbox", () => {
    const result = collectRateDrafts(
      entries({
        home_fee_16: "800",
        stop_fee_16: "500",
        stop_active_16: "on",
      }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.values.home_active_16).toBe("")
    expect(result.values.stop_active_16).toBe("on")
  })

  it("treats an all-empty submission as an empty batch", () => {
    const result = collectRateDrafts(entries({ home_fee_16: "", stop_fee_16: "" }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toBe("empty")
  })
})

describe("parseRatesCsv", () => {
  it("parses valid rows and ignores comments", () => {
    const rows = parseRatesCsv("# comment\n16,home,800.00,1,Alger Centre\n31,stop_desk,250,0, ")
    expect(rows).not.toBeNull()
    expect(rows).toHaveLength(2)
    expect(rows?.[0]).toMatchObject({ wilaya_code: "16", method: "home", fee_amount: "80000", is_active: true, label: "Alger Centre" })
    expect(rows?.[1]).toMatchObject({ wilaya_code: "31", method: "stop_desk", fee_amount: "25000", is_active: false })
  })

  it("rejects malformed rows", () => {
    expect(parseRatesCsv("16,bogus,10")).toBeNull()
    expect(parseRatesCsv("016,home,10")).toBeNull()
    expect(parseRatesCsv("16,home,abc")).toBeNull()
    expect(parseRatesCsv("16,home")).toBeNull()
    expect(parseRatesCsv("")).toBeNull()
  })

  it("rejoins labels containing commas", () => {
    const rows = parseRatesCsv("16,home,800.00,1,Centre, Ville")
    expect(rows?.[0].label).toBe("Centre,Ville")
  })
})

describe("initialRateValues", () => {
  it("serialises persisted rates into the editor field map", () => {
    const values = initialRateValues([
      {
        wilaya_code: "16",
        method: "home",
        fee_amount: "80000",
        is_active: true,
        label: "Alger",
      },
      {
        wilaya_code: "16",
        method: "stop_desk",
        fee_amount: 50000n as unknown as string,
        is_active: false,
      },
    ])
    expect(values.home_fee_16).toBe("800.00")
    expect(values.home_active_16).toBe("on")
    expect(values.home_label_16).toBe("Alger")
    expect(values.stop_fee_16).toBe("500.00")
    expect(values.stop_active_16).toBe("")
  })
})