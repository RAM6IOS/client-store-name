import type { OrderStatus } from "@/lib/api-types"
import type { AdminOrderFilters, CollectionStatus, ShipmentStatus } from "./types"

export const ORDER_STATUSES: OrderStatus[] = [
  "pending_confirmation",
  "confirmed",
  "preparing",
  "dispatched",
  "shipped",
  "delivered",
  "cancelled",
  "delivery_failed",
  "returned",
  "no_answer",
  "wrong_number",
]

export const SHIPMENT_STATUSES: ShipmentStatus[] = [
  "pending",
  "shipped",
  "delivered",
  "failed",
  "returned",
]

export const COLLECTION_STATUSES: CollectionStatus[] = [
  "cod_pending",
  "cod_collected",
  "cod_remitted",
]

export const ORDER_SORTS = ["created_at", "updated_at", "total_amount", "display_id"] as const
export type OrderSort = (typeof ORDER_SORTS)[number]

type RawSearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function coerceEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined
}

function coerceDate(value: string | undefined): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}

/**
 * Reads the filter set from Next's `searchParams`, dropping anything that is not
 * a recognised value. This keeps a mistyped/forged query string from ever
 * reaching the API as a 400 — the page simply falls back to the default filter.
 */
export function parseOrderFilters(params: RawSearchParams): AdminOrderFilters {
  const wilaya = first(params.wilaya_code)
  return {
    search: first(params.search)?.trim() || undefined,
    status: coerceEnum(first(params.status), ORDER_STATUSES),
    shipment_status: coerceEnum(first(params.shipment_status), SHIPMENT_STATUSES),
    collection_status: coerceEnum(first(params.collection_status), COLLECTION_STATUSES),
    wilaya_code: wilaya && /^\d{2}$/.test(wilaya) ? wilaya : undefined,
    from: coerceDate(first(params.from)),
    to: coerceDate(first(params.to)),
  }
}

export function parseOrderSort(params: RawSearchParams): {
  sort: OrderSort
  order: "asc" | "desc"
} {
  return {
    sort: coerceEnum(first(params.sort), ORDER_SORTS) ?? "created_at",
    order: coerceEnum(first(params.order), ["asc", "desc"] as const) ?? "desc",
  }
}

export function parsePage(params: RawSearchParams): number {
  const raw = Number(first(params.page))
  return Number.isInteger(raw) && raw > 0 ? raw : 1
}

export function parsePageSize(params: RawSearchParams): number {
  const raw = Number(first(params.pageSize))
  return Number.isInteger(raw) && raw > 0 && raw <= 100 ? raw : 20
}

/** Serialises the filter set (without pagination) for links and the export. */
export function orderFilterQuery(filters: AdminOrderFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, String(value))
  }
  return params.toString()
}
