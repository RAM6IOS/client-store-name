import type { OrderStatus } from "@/lib/api-types"

/**
 * Client-side mirror of the API state machine
 * (`apps/api/src/orders/domain/order-transitions.ts`).
 *
 * It is used only to decide which options the status dropdown offers; the API
 * remains the source of truth and rejects anything illegal with
 * `INVALID_TRANSITION`. Keep the two lists in sync.
 */
export const ORDER_STATUS_TARGETS: Record<OrderStatus, OrderStatus[]> = {
  pending_confirmation: ["confirmed", "cancelled", "delivery_failed", "no_answer", "wrong_number"],
  confirmed: ["preparing", "cancelled", "delivery_failed", "no_answer", "wrong_number"],
  preparing: ["dispatched", "cancelled", "delivery_failed"],
  dispatched: ["shipped", "cancelled", "delivery_failed"],
  shipped: ["delivered", "returned", "delivery_failed"],
  delivered: ["returned"],
  cancelled: [],
  delivery_failed: ["cancelled", "preparing", "dispatched", "shipped"],
  returned: [],
  no_answer: ["pending_confirmation", "confirmed", "cancelled", "wrong_number"],
  wrong_number: ["pending_confirmation", "cancelled", "no_answer"],
}

/**
 * Transitions that warrant a confirmation prompt: they end or lock in the
 * order (a delivery implies COD collection, cancellation and return drop the
 * parcel). Everything else applies immediately.
 */
const CONFIRM_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "delivered",
  "cancelled",
  "returned",
])

export function requiresStatusConfirmation(status: OrderStatus): boolean {
  return CONFIRM_STATUSES.has(status)
}
