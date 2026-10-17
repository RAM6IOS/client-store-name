import { Prisma, OrderStatus, ShipmentStatus, CollectionStatus } from "../../generated/prisma/client"

/**
 * Server-side filtering and sorting for the admin order list / export.
 *
 * Kept as pure functions (no DB access) so the behaviour — especially the
 * search heuristics — is unit-testable and shared by the paginated list and
 * the CSV export (they must select the same set of orders).
 */

export type OrderSortField = "created_at" | "updated_at" | "total_amount" | "display_id"
export type OrderSortDirection = "asc" | "desc"

export interface OrderFilterInput {
  /** Order reference (`123` / `#123`), customer name, or phone number. */
  search?: string
  status?: OrderStatus
  shipment_status?: ShipmentStatus
  collection_status?: CollectionStatus
  wilaya_code?: string
  from?: Date
  to?: Date
}

/**
 * Builds a Prisma `where` clause. `search` is OR-combined across:
 *   - the customer name (case-insensitive substring),
 *   - the wilaya name (case-insensitive substring),
 *   - the stored E.164 phone (`+213…`) as well as a raw local `0…` number,
 *   - the numeric order reference (`123` or `#123`).
 */
export function buildOrderWhere(filter: OrderFilterInput): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {}

  if (filter.status) where.status = filter.status
  if (filter.shipment_status) where.shipment_status = filter.shipment_status
  if (filter.collection_status) where.collection_status = filter.collection_status
  if (filter.wilaya_code) where.wilaya_code = filter.wilaya_code

  if (filter.from || filter.to) {
    where.created_at = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    }
  }

  const search = filter.search?.trim()
  if (search) {
    const or: Prisma.OrderWhereInput[] = [
      { customer_name: { contains: search, mode: "insensitive" } },
      { wilaya_name: { contains: search, mode: "insensitive" } },
    ]

    const digits = search.replace(/[^\d]/g, "")
    if (digits) {
      or.push({ customer_phone: { contains: digits } })
      // Local format `0XXXXXXXXX` -> stored E.164 `+213XXXXXXXXX`.
      if (digits.startsWith("0") && digits.length === 10) {
        or.push({ customer_phone: { contains: `+213${digits.slice(1)}` } })
      }
    }

    const reference = /^#?(\d+)$/.exec(search)
    if (reference) or.push({ display_id: Number(reference[1]) })

    where.OR = or
  }

  return where
}

/** Deterministic ordering with a `created_at desc` tiebreaker. */
export function buildOrderOrderBy(
  sort: OrderSortField,
  order: OrderSortDirection,
): Prisma.OrderOrderByWithRelationInput[] {
  const primary: Prisma.OrderOrderByWithRelationInput = { [sort]: order }
  if (sort === "created_at") return [primary]
  return [primary, { created_at: "desc" }]
}

export function parsePositiveInt(value: unknown, fallback: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const truncated = Math.trunc(parsed)
  if (truncated < 1) return fallback
  return Math.min(truncated, max)
}
