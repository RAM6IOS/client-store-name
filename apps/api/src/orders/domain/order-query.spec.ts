import { OrderStatus, ShipmentStatus } from "../../generated/prisma/client"
import { buildOrderOrderBy, buildOrderWhere } from "./order-query"

describe("buildOrderWhere", () => {
  it("is empty when no filters are supplied", () => {
    expect(buildOrderWhere({})).toEqual({})
  })

  it("maps scalar status filters and the wilaya", () => {
    const where = buildOrderWhere({
      status: OrderStatus.confirmed,
      shipment_status: ShipmentStatus.shipped,
      wilaya_code: "16",
    })
    expect(where.status).toBe("confirmed")
    expect(where.shipment_status).toBe("shipped")
    expect(where.wilaya_code).toBe("16")
  })

  it("builds a created_at range for from/to", () => {
    const from = new Date("2026-01-01T00:00:00Z")
    const to = new Date("2026-02-01T00:00:00Z")
    const where = buildOrderWhere({ from, to })
    expect(where.created_at).toEqual({ gte: from, lte: to })
  })

  it("searches name, E.164/local phone and numeric reference together", () => {
    const where = buildOrderWhere({ search: "#1234" })
    const or = where.OR as Array<Record<string, unknown>>
    expect(or).toEqual(
      expect.arrayContaining([
        { customer_name: { contains: "#1234", mode: "insensitive" } },
        { display_id: 1234 },
      ]),
    )
  })

  it("searches the wilaya name", () => {
    const where = buildOrderWhere({ search: "الجزائر" })
    const or = where.OR as Array<Record<string, unknown>>
    expect(or).toEqual(
      expect.arrayContaining([{ wilaya_name: { contains: "الجزائر", mode: "insensitive" } }]),
    )
  })

  it("expands a local phone number to the stored E.164 form", () => {
    const where = buildOrderWhere({ search: "0552345678" })
    const or = where.OR as Array<Record<string, unknown>>
    expect(or).toEqual(
      expect.arrayContaining([
        { customer_phone: { contains: "0552345678" } },
        { customer_phone: { contains: "+213552345678" } },
      ]),
    )
  })

  it("ignores a blank search", () => {
    expect(buildOrderWhere({ search: "   " }).OR).toBeUndefined()
  })
})

describe("buildOrderOrderBy", () => {
  it("uses only created_at when that is the sort field", () => {
    expect(buildOrderOrderBy("created_at", "desc")).toEqual([{ created_at: "desc" }])
  })

  it("adds a created_at tiebreaker for other sorts", () => {
    expect(buildOrderOrderBy("total_amount", "asc")).toEqual([
      { total_amount: "asc" },
      { created_at: "desc" },
    ])
  })
})
