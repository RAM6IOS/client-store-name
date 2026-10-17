/**
 * Response shapes returned by the BITA COD API, mirrored for the storefront.
 * Money fields are integer minor units serialised as strings (ADR-0005); the
 * server is always authoritative for totals.
 */

export type ProductStatus = "draft" | "published" | "archived"
export type DeliveryMethod = "home" | "stop_desk"

export interface Paginated<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ProductImage {
  id: string
  product_id: string
  url: string
  alt: string | null
  rank: number
  created_at: string
}

export interface InventoryItem {
  id: string
  variant_id: string
  stocked_quantity: number
  reserved_quantity: number
}

export interface ProductOptionValue {
  id: string
  option_id: string
  value: string
  position: number
}

export interface ProductOption {
  id: string
  product_id: string
  title: string
  position: number
  values: ProductOptionValue[]
}

export interface VariantOptionValue {
  variant_id: string
  option_id: string
  option_value_id: string
  option: ProductOption
  option_value: ProductOptionValue
}

export interface ProductVariant {
  id: string
  product_id: string
  title: string
  sku: string | null
  position: number
  is_default: boolean
  /** Integer minor units, serialised as a string. */
  price_amount: string
  compare_at_amount: string | null
  currency_code: string
  manage_inventory: boolean
  allow_backorder: boolean
  image: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  inventory_item: InventoryItem | null
  option_values: VariantOptionValue[]
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  parent_id: string | null
  position: number
  is_active: boolean
  created_at: string
  updated_at: string
  _count?: { products: number; children?: number }
}

export interface ProductCategoryLink {
  product_id: string
  category_id: string
  position: number
  category: Category
}

export interface Product {
  id: string
  title: string
  handle: string
  description: string | null
  status: ProductStatus
  thumbnail: string | null
  is_featured: boolean
  created_at: string
  updated_at: string
  images: ProductImage[]
  variants: ProductVariant[]
  categories: ProductCategoryLink[]
  options: ProductOption[]
}

export interface Wilaya {
  code: string
  name_ar: string
  name_fr: string
  latitude: number | null
  longitude: number | null
}

export interface Commune {
  code: string
  /** Algerian postal code; used as `commune_code` at checkout. */
  post_code: string
  name_fr: string
  name_ar: string
  daira: string | null
  daira_ar: string | null
  wilaya_code: string
  latitude: number | null
  longitude: number | null
  verification_status: "verified" | "spelling_variant" | "unmatched" | "unchecked"
  verification_note: string | null
}

/** Note: the delivery API returns these in camelCase. */
export interface DeliveryMethodOption {
  method: DeliveryMethod
  available: boolean
  currencyCode: string
  feeAmount: string | null
  label: string | null
  provider: string
}

export interface DeliveryQuote {
  deliveryRateId: string
  method: DeliveryMethod
  currencyCode: string
  feeAmount: string
  label: string | null
  provider: string
  wilayaCode: string
  wilayaName: string
  wilayaNameFr: string
  issuedAt: string
  expiresAt: string
}

export interface StopDesk {
  id: string
  provider: string
  name: string
  wilaya_code: string
  commune_code: string | null
  commune_name: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
}

export interface PublicStoreSettings {
  name: string
  default_locale: string
  base_currency: string
  cod_enabled: boolean
}

export interface CheckoutItemInput {
  variant_id: string
  quantity: number
}

export interface CheckoutInput {
  idempotency_key: string
  currency_code: string
  customer_name: string
  customer_phone: string
  email?: string
  delivery_method: DeliveryMethod
  wilaya_code: string
  commune: string
  commune_code?: string
  address_line?: string
  nearby_landmark?: string
  notes?: string
  stop_desk_id?: string
  stop_desk_name?: string
  stop_desk_address?: string
  items: CheckoutItemInput[]
}

export type OrderStatus =
  | "pending_confirmation"
  | "confirmed"
  | "preparing"
  | "dispatched"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "delivery_failed"
  | "returned"
  | "no_answer"
  | "wrong_number"

export interface OrderItemPublic {
  id: string
  variant_id: string
  product_title: string
  variant_title: string
  sku: string | null
  options: unknown
  quantity: number
  unit_amount: string
  line_amount: string
  currency_code: string
}

export interface OrderPublic {
  id: string
  display_id: number
  status: OrderStatus
  shipment_status: string
  collection_status: string
  currency_code: string
  subtotal_amount: string
  shipping_amount: string
  discount_amount: string
  total_amount: string
  customer_name: string
  customer_phone: string
  email: string | null
  delivery_method: DeliveryMethod
  delivery_label: string | null
  delivery_provider: string | null
  wilaya_code: string
  wilaya_name: string
  commune: string
  commune_code: string | null
  address_line: string | null
  nearby_landmark: string | null
  notes: string | null
  delivery_quote: Record<string, unknown> | null
  stop_desk: { id: string | null; name: string | null; provider: string | null; address: string | null } | null
  tracking_token: string | null
  confirmed_at: string | null
  /** Present on admin responses only. */
  confirmed_by?: string | null
  placed_at: string
  created_at: string
  updated_at: string
  items: OrderItemPublic[]
}
