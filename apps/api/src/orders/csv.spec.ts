import { ORDER_EXPORT_COLUMNS, escapeCsvField, toCsv } from "./csv"

describe("escapeCsvField", () => {
  it("returns empty for null/undefined", () => {
    expect(escapeCsvField(null)).toBe("")
    expect(escapeCsvField(undefined)).toBe("")
  })

  it("stringifies bigint minor units without a trailing n", () => {
    expect(escapeCsvField(1500n)).toBe("1500")
  })

  it("quotes and doubles embedded quotes, commas and newlines", () => {
    expect(escapeCsvField('a,"b"')).toBe('"a,""b"""')
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"')
  })
})

describe("toCsv", () => {
  it("emits a stable header and CRLF-separated rows", () => {
    const csv = toCsv(
      [
        { a: 1, b: "x" },
        { a: 2, b: "y,z" },
      ],
      [
        { key: "a", header: "A" },
        { key: "b", header: "B" },
      ],
    )
    expect(csv).toBe('A,B\r\n1,x\r\n2,"y,z"')
  })
})

describe("ORDER_EXPORT_COLUMNS", () => {
  it("never exports tracking credentials or quote snapshots", () => {
    const keys = ORDER_EXPORT_COLUMNS.map((column) => column.key)
    expect(keys).not.toContain("tracking_token")
    expect(keys).not.toContain("delivery_quote_snapshot")
    expect(keys).not.toContain("delivery_quote")
    expect(keys).toContain("collection_status")
  })
})
