import type { OrderPublic, OrderStatus } from "@/lib/api-types"

export type ShipmentStatus = "pending" | "shipped" | "delivered" | "failed" | "returned"

export type CollectionStatus = "cod_pending" | "cod_collected" | "cod_remitted"

export type ReservationStatus = "held" | "released" | "committed"

export interface OrderStatusHistoryEntry {
  id: string
  from_status: OrderStatus | null
  to_status: OrderStatus
  shipment_status: ShipmentStatus | null
  note: string | null
  changed_by: string | null
  created_at: string
}

export interface OrderReservation {
  id: string
  order_item_id: string
  inventory_item_id: string
  variant_id: string
  quantity: number
  status: ReservationStatus
  expires_at: string | null
  released_at: string | null
  committed_at: string | null
  created_at: string
}

/** `GET /orders/:id` returns the public view plus the operational detail. */
export interface AdminOrderDetail extends OrderPublic {
  shipment_status: ShipmentStatus
  collection_status: CollectionStatus
  status_history: OrderStatusHistoryEntry[]
  reservations: OrderReservation[]
}

export interface AdminOrderSummary extends OrderPublic {
  shipment_status: ShipmentStatus
  collection_status: CollectionStatus
}

export interface AdminOrderList {
  data: AdminOrderSummary[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** Shared filters for the list and the CSV export (mirrors the API query). */
export interface AdminOrderFilters {
  search?: string
  status?: OrderStatus
  shipment_status?: ShipmentStatus
  collection_status?: CollectionStatus
  wilaya_code?: string
  from?: string
  to?: string
}

export interface AdminOrderQuery extends AdminOrderFilters {
  sort?: "created_at" | "updated_at" | "total_amount" | "display_id"
  order?: "asc" | "desc"
  page?: number
  pageSize?: number
}

export type AdminOrderAction =
  | "confirm"
  | "prepare"
  | "dispatch"
  | "transit"
  | "deliver"
  | "delivery-failed"
  | "return"
  | "cancel"
  | "no-answer"
  | "wrong-number"

export interface OrderActionPayload {
  actor: string
  note?: string
  reason?: string
}

// ─────────────────────────── Phase 7: dashboard ────────────────────────────

export interface DashboardRecentOrder {
  id: string
  display_id: number
  status: OrderStatus
  customer_name: string
  customer_phone: string
  wilaya_name: string
  total_amount: string
  currency_code: string
  created_at: string
}

export interface DashboardLowStockItem {
  variant_id: string
  variant_title: string
  product_id: string
  product_title: string
  stocked_quantity: number
  reserved_quantity: number
  available_quantity: number
}

export interface DashboardOverview {
  generated_at: string
  currency_code: string
  orders: {
    total: number
    by_status: Record<OrderStatus, number>
    placed_value: string
    delivered_value: string
  }
  customers: { total: number; returning: number }
  catalog: { products_total: number; products_published: number; low_stock: number }
  recent_orders: DashboardRecentOrder[]
  low_stock_items: DashboardLowStockItem[]
}

// ─────────────────────────── Phase 7: customers ────────────────────────────

export interface CustomerSummary {
  phone: string
  name: string
  orders_count: number
  delivered_count: number
  cancelled_count: number
  returned_count: number
  total_spent: string
  first_order_at: string
  last_order_at: string
  last_wilaya_name: string
}

export interface CustomerDetail extends CustomerSummary {
  currency_code: string
  orders: OrderPublic[]
}

export interface CustomerList {
  currency_code: string
  data: CustomerSummary[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

// ──────────────────────── Phase 7: store / delivery ────────────────────────

export interface AdminStoreSettings {
  name: string
  default_locale: string
  base_currency: string
  cod_enabled: boolean
  reservation_ttl_minutes: number
  created_at: string
  updated_at: string
}

export interface DeliveryRate {
  id: string
  wilaya_code: string
  method: "home" | "stop_desk"
  currency_code: string
  provider: string
  fee_amount: string
  label: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
