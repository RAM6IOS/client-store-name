import { describe, expect, it } from "vitest"
import {
  orderFilterQuery,
  parseOrderFilters,
  parseOrderSort,
  parsePage,
  parsePageSize,
} from "./query"

describe("parseOrderFilters", () => {
  it("keeps recognised values", () => {
    expect(
      parseOrderFilters({
        search: "  sami  ",
        status: "confirmed",
        shipment_status: "shipped",
        collection_status: "cod_pending",
        wilaya_code: "16",
        from: "2026-01-01",
        to: "2026-02-01",
      }),
    ).toEqual({
      search: "sami",
      status: "confirmed",
      shipment_status: "shipped",
      collection_status: "cod_pending",
      wilaya_code: "16",
      from: "2026-01-01",
      to: "2026-02-01",
    })
  })

  it("drops forged/unknown values instead of forwarding them to the API", () => {
    expect(
      parseOrderFilters({
        status: "DROP TABLE",
        shipment_status: "teleported",
        collection_status: "x",
        wilaya_code: "999",
        from: "not-a-date",
        search: "   ",
      }),
    ).toEqual({
      search: undefined,
      status: undefined,
      shipment_status: undefined,
      collection_status: undefined,
      wilaya_code: undefined,
      from: undefined,
      to: undefined,
    })
  })

  it("reads the first value of repeated params", () => {
    expect(parseOrderFilters({ status: ["shipped", "cancelled"] }).status).toBe("shipped")
  })
})

describe("parseOrderSort", () => {
  it("defaults to created_at desc", () => {
    expect(parseOrderSort({})).toEqual({ sort: "created_at", order: "desc" })
  })

  it("accepts known sorts and rejects others", () => {
    expect(parseOrderSort({ sort: "total_amount", order: "asc" })).toEqual({
      sort: "total_amount",
      order: "asc",
    })
    expect(parseOrderSort({ sort: "hacked" })).toEqual({ sort: "created_at", order: "desc" })
  })
})

describe("pagination parsing", () => {
  it("clamps page and pageSize to safe bounds", () => {
    expect(parsePage({ page: "0" })).toBe(1)
    expect(parsePage({ page: "-3" })).toBe(1)
    expect(parsePage({ page: "4" })).toBe(4)
    expect(parsePageSize({ pageSize: "1000" })).toBe(20)
    expect(parsePageSize({ pageSize: "50" })).toBe(50)
  })
})

describe("orderFilterQuery", () => {
  it("serialises only present values", () => {
    expect(orderFilterQuery({ search: "a b", status: "shipped", wilaya_code: undefined })).toBe(
      "search=a+b&status=shipped",
    )
  })
})
