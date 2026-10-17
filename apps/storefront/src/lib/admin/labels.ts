import type { OrderStatus, ProductStatus } from "@/lib/api-types"
import type { TranslationKey } from "@/lib/i18n/dictionaries"
import type { CollectionStatus, ReservationStatus, ShipmentStatus } from "./types"

export const ORDER_STATUS_LABEL: Record<OrderStatus, TranslationKey> = {
  pending_confirmation: "order.status.pending_confirmation",
  confirmed: "order.status.confirmed",
  preparing: "order.status.preparing",
  dispatched: "order.status.dispatched",
  shipped: "order.status.shipped",
  delivered: "order.status.delivered",
  cancelled: "order.status.cancelled",
  delivery_failed: "order.status.delivery_failed",
  returned: "order.status.returned",
  no_answer: "order.status.no_answer",
  wrong_number: "order.status.wrong_number",
}

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, TranslationKey> = {
  draft: "admin.products.status.draft",
  published: "admin.products.status.published",
  archived: "admin.products.status.archived",
}

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, TranslationKey> = {
  pending: "admin.shipment.pending",
  shipped: "admin.shipment.shipped",
  delivered: "admin.shipment.delivered",
  failed: "admin.shipment.failed",
  returned: "admin.shipment.returned",
}

export const COLLECTION_STATUS_LABEL: Record<CollectionStatus, TranslationKey> = {
  cod_pending: "admin.collection.cod_pending",
  cod_collected: "admin.collection.cod_collected",
  cod_remitted: "admin.collection.cod_remitted",
}

export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, TranslationKey> = {
  held: "admin.reservation.held",
  released: "admin.reservation.released",
  committed: "admin.reservation.committed",
}
