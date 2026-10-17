import { OrderStatus, ShipmentStatus } from "../../generated/prisma/client"

type Status = OrderStatus

type Transition =
  | "pending_confirmation->confirmed"
  | "pending_confirmation->cancelled"
  | "pending_confirmation->delivery_failed"
  | "pending_confirmation->no_answer"
  | "pending_confirmation->wrong_number"
  | "confirmed->preparing"
  | "confirmed->cancelled"
  | "confirmed->delivery_failed"
  | "confirmed->no_answer"
  | "confirmed->wrong_number"
  | "preparing->dispatched"
  | "preparing->cancelled"
  | "preparing->delivery_failed"
  | "dispatched->shipped"
  | "dispatched->cancelled"
  | "dispatched->delivery_failed"
  | "shipped->delivered"
  | "shipped->returned"
  | "shipped->delivery_failed"
  | "delivered->returned"
  | "delivery_failed->cancelled"
  | "delivery_failed->preparing"
  | "delivery_failed->dispatched"
  | "delivery_failed->shipped"
  | "no_answer->pending_confirmation"
  | "no_answer->confirmed"
  | "no_answer->cancelled"
  | "no_answer->wrong_number"
  | "wrong_number->pending_confirmation"
  | "wrong_number->cancelled"
  | "wrong_number->no_answer"

export const ORDER_TRANSITIONS: Record<Status, ReadonlyArray<Status>> = {
  pending_confirmation: ["confirmed", "cancelled", "delivery_failed", "no_answer", "wrong_number"],
  confirmed: ["preparing", "cancelled", "delivery_failed", "no_answer", "wrong_number"],
  preparing: ["dispatched", "cancelled", "delivery_failed"],
  dispatched: ["shipped", "cancelled", "delivery_failed"],
  shipped: ["delivered", "returned", "delivery_failed"],
  delivered: ["returned"],
  delivery_failed: ["cancelled", "preparing", "dispatched", "shipped"],
  returned: [],
  cancelled: [],
  no_answer: ["pending_confirmation", "confirmed", "cancelled", "wrong_number"],
  wrong_number: ["pending_confirmation", "cancelled", "no_answer"],
} as const

export function canTransition(from: Status, to: Status): boolean {
  return ORDER_TRANSITIONS[from].includes(to)
}

export function describeTransition(from: Status, to: Status): Transition {
  const key = `${from}->${to}` as Transition
  return key
}

/**
 * Shipment status implied by an order transition. A shipment status only exists
 * operationally once an order is handed to delivery, so earlier transitions
 * (confirm, preparing) leave it untouched. Delivery success/failure and returns
 * mirror the order lifecycle. `collection_status` is deliberately NOT derived
 * here: delivered does not mean paid, nor remitted (see ADR-0006 / Phase 6).
 */
export const SHIPMENT_STATUS_BY_TRANSITION: Record<Status, ShipmentStatus | null> = {
  pending_confirmation: null,
  confirmed: null,
  preparing: null,
  dispatched: ShipmentStatus.shipped,
  shipped: ShipmentStatus.shipped,
  delivered: ShipmentStatus.delivered,
  cancelled: null,
  delivery_failed: ShipmentStatus.failed,
  returned: ShipmentStatus.returned,
  no_answer: null,
  wrong_number: null,
} as const

export function shipmentStatusFor(target: Status): ShipmentStatus | null {
  return SHIPMENT_STATUS_BY_TRANSITION[target] ?? null
}

/**
 * Transitions that must return the order's outstanding stock reservation to
 * availability. Cancellation before dispatch and a returned delivery both free
 * the stock again; a failed delivery attempt does not (it may be retried).
 */
export const RELEASING_TRANSITIONS: ReadonlyArray<Status> = [
  OrderStatus.cancelled,
  OrderStatus.returned,
] as const

export function releasesReservations(target: Status): boolean {
  return RELEASING_TRANSITIONS.includes(target)
}