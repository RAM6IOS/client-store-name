import { ApiError, apiFetch, apiUrl } from "@/lib/api"
import type { Category, Paginated, Product, ProductImage, ProductStatus, OrderStatus, Wilaya } from "@/lib/api-types"
import { ADMIN_API_KEY_HEADER } from "./constants"
import type {
  AdminOrderAction,
  AdminOrderDetail,
  AdminOrderFilters,
  AdminOrderList,
  AdminOrderQuery,
  AdminStoreSettings,
  CustomerDetail,
  CustomerList,
  DashboardOverview,
  DeliveryRate,
  OrderActionPayload,
} from "./types"

export type VerifyAdminKeyResult = "ok" | "invalid" | "unavailable"

type QueryValue = string | number | undefined

function toQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ""
}

function adminHeaders(key: string): Record<string, string> {
  return { [ADMIN_API_KEY_HEADER]: key }
}

/**
 * Confirms the operator-supplied key against the API before persisting it.
 * `invalid` (401/403) is distinct from `unavailable` so the login page can tell
 * a wrong key from an API that is down.
 */
export async function verifyAdminKey(key: string): Promise<VerifyAdminKeyResult> {
  try {
    await apiFetch("/orders?page=1&pageSize=1", { headers: adminHeaders(key) })
    return "ok"
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return "invalid"
    }
    return "unavailable"
  }
}

export async function listAdminOrders(
  key: string,
  query: AdminOrderQuery = {},
): Promise<AdminOrderList> {
  const qs = toQuery({
    ...(query as AdminOrderFilters),
    sort: query.sort,
    order: query.order,
    page: query.page,
    pageSize: query.pageSize,
  })
  return apiFetch<AdminOrderList>(`/orders${qs}`, { headers: adminHeaders(key) })
}

export async function getAdminOrder(key: string, id: string): Promise<AdminOrderDetail> {
  return apiFetch<AdminOrderDetail>(`/orders/${encodeURIComponent(id)}`, {
    headers: adminHeaders(key),
  })
}

export async function adminOrderAction(
  key: string,
  id: string,
  action: AdminOrderAction,
  payload: OrderActionPayload,
): Promise<AdminOrderDetail> {
  const path = `/orders/${encodeURIComponent(id)}/${action}`
  const body =
    action === "cancel"
      ? { actor: payload.actor, reason: payload.reason ?? "operator_cancelled", note: payload.note }
      : { actor: payload.actor, note: payload.note }
  return apiFetch<AdminOrderDetail>(path, { method: "POST", headers: adminHeaders(key), body })
}

/**
 * Sets an arbitrary allowed target status through the generic endpoint. Used by
 * the inline status dropdown in the orders list, which can jump to any status
 * the state machine allows from the current one.
 */
export async function setAdminOrderStatus(
  key: string,
  id: string,
  toStatus: OrderStatus,
  payload: OrderActionPayload,
): Promise<AdminOrderDetail> {
  return apiFetch<AdminOrderDetail>(`/orders/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    headers: adminHeaders(key),
    body: { to_status: toStatus, actor: payload.actor, note: payload.note },
  })
}

/** Fetches the CSV export bytes for the active filter set (server-only). */
export async function exportAdminOrdersCsv(
  key: string,
  query: AdminOrderQuery = {},
): Promise<string> {
  return apiFetch<string>(`/orders/export${toQuery(query as Record<string, QueryValue>)}`, {
    headers: adminHeaders(key),
  })
}

// ───────────────────────────── Phase 7: dashboard ──────────────────────────

export async function getAdminDashboard(key: string): Promise<DashboardOverview> {
  return apiFetch<DashboardOverview>("/admin/dashboard", { headers: adminHeaders(key) })
}

// ───────────────────────────── Phase 7: customers ──────────────────────────

export interface AdminCustomerQuery {
  search?: string
  page?: number
  pageSize?: number
}

export async function listAdminCustomers(
  key: string,
  query: AdminCustomerQuery = {},
): Promise<CustomerList> {
  return apiFetch<CustomerList>(
    `/admin/customers${toQuery(query as Record<string, QueryValue>)}`,
    { headers: adminHeaders(key) },
  )
}

export async function getAdminCustomer(key: string, phone: string): Promise<CustomerDetail> {
  return apiFetch<CustomerDetail>(`/admin/customers/${encodeURIComponent(phone)}`, {
    headers: adminHeaders(key),
  })
}

// ────────────────────────── Phase 7: store settings ────────────────────────

export interface StoreSettingsInput {
  name?: string
  default_locale?: string
  base_currency?: string
  cod_enabled?: boolean
  reservation_ttl_minutes?: number
}

export async function getAdminSettings(key: string): Promise<AdminStoreSettings> {
  return apiFetch<AdminStoreSettings>("/admin/store/settings", { headers: adminHeaders(key) })
}

export async function updateAdminSettings(
  key: string,
  input: StoreSettingsInput,
): Promise<AdminStoreSettings> {
  return apiFetch<AdminStoreSettings>("/admin/store/settings", {
    method: "PATCH",
    headers: adminHeaders(key),
    body: input,
  })
}

// ───────────────────────── Phase 7: delivery rates ─────────────────────────

export interface DeliveryRateQuery {
  wilaya_code?: string
  method?: string
  active_only?: boolean
}

export async function listAdminDeliveryRates(
  key: string,
  query: DeliveryRateQuery = {},
): Promise<{ data: DeliveryRate[]; total: number }> {
  return apiFetch(`/admin/delivery-rates${toQuery(query as Record<string, QueryValue>)}`, {
    headers: adminHeaders(key),
  })
}

export interface UpsertDeliveryRateInput {
  wilaya_code: string
  method: "home" | "stop_desk"
  currency_code: string
  provider?: string
  fee_amount: string
  label?: string
  is_active?: boolean
}

export async function upsertAdminDeliveryRate(
  key: string,
  input: UpsertDeliveryRateInput,
): Promise<DeliveryRate> {
  return apiFetch<DeliveryRate>("/admin/delivery-rates", {
    method: "POST",
    headers: adminHeaders(key),
    body: input,
  })
}

export async function upsertAdminDeliveryRatesBatch(
  key: string,
  rates: UpsertDeliveryRateInput[],
): Promise<{ data: DeliveryRate[]; total: number }> {
  return apiFetch("/admin/delivery-rates/batch", {
    method: "POST",
    headers: adminHeaders(key),
    body: { rates },
  })
}

export async function updateAdminDeliveryRate(
  key: string,
  id: string,
  input: { fee_amount?: string; label?: string | null; is_active?: boolean },
): Promise<DeliveryRate> {
  return apiFetch<DeliveryRate>(`/admin/delivery-rates/${id}`, {
    method: "PATCH",
    headers: adminHeaders(key),
    body: input,
  })
}

// ─────────────────────────── Phase 7: catalog admin ────────────────────────

export interface AdminProductQuery {
  page?: number
  pageSize?: number
  status?: ProductStatus
  search?: string
}

export async function listAdminProducts(
  key: string,
  query: AdminProductQuery = {},
): Promise<Paginated<Product>> {
  return apiFetch<Paginated<Product>>(
    `/catalog/products${toQuery(query as Record<string, QueryValue>)}`,
    { headers: adminHeaders(key) },
  )
}

export async function getAdminProduct(key: string, id: string): Promise<Product> {
  return apiFetch<Product>(`/catalog/products/${id}`, { headers: adminHeaders(key) })
}

export interface CreateProductPayload {
  title: string
  handle?: string
  description?: string
  status?: ProductStatus
  thumbnail?: string
  currency_code: string
  price: string
  compare_at_price?: string
  sku?: string
  initial_stock?: number
  categories?: { category_id: string; position?: number }[]
  is_featured?: boolean
  variants?: VariantInput[]
  options?: { title: string; values: { value: string }[] }[]
}

export async function createAdminProduct(
  key: string,
  input: CreateProductPayload,
): Promise<Product> {
  return apiFetch<Product>("/catalog/products", {
    method: "POST",
    headers: adminHeaders(key),
    body: input,
  })
}

export interface ProductUpdatePayload {
  title?: string
  description?: string | null
  handle?: string
  status?: ProductStatus
  thumbnail?: string | null
  compare_at_price?: string | null
  categories?: { category_id: string; position?: number }[]
  is_featured?: boolean
  options?: { title: string; values: { value: string }[] }[]
  variants?: VariantInput[]
}

export async function updateAdminProduct(
  key: string,
  id: string,
  input: ProductUpdatePayload,
): Promise<Product> {
  return apiFetch<Product>(`/catalog/products/${id}`, {
    method: "PATCH",
    headers: adminHeaders(key),
    body: input,
  })
}

export async function deleteAdminProduct(key: string, id: string): Promise<void> {
  await apiFetch(`/catalog/products/${id}`, { method: "DELETE", headers: adminHeaders(key) })
}

export async function uploadAdminProductImages(
  key: string,
  productId: string,
  files: File[],
): Promise<ProductImage[]> {
  const form = new FormData()
  for (const file of files) form.append("files", file, file.name)
  const url = apiUrl(`/catalog/products/${encodeURIComponent(productId)}/images/upload`)
  const res = await fetch(url, { method: "POST", headers: adminHeaders(key), body: form })
  if (res.status === 204) return []
  const text = await res.text()
  let payload: unknown
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }
  if (!res.ok) {
    const envelope = payload && typeof payload === "object" ? (payload as any) : {}
    const message =
      typeof envelope.message === "string"
        ? envelope.message
        : Array.isArray(envelope.message)
          ? envelope.message.join(", ")
          : `Request failed with status ${res.status}`
    throw new ApiError(message, {
      status: res.status,
      code: typeof envelope.code === "string" ? envelope.code : `HTTP_${res.status}`,
      details: envelope.details ?? envelope,
    })
  }
  return Array.isArray(payload) ? (payload as ProductImage[]) : []
}

export interface VariantInput {
  title: string
  sku?: string
  price?: string
  compare_at_price?: string | null
  currency_code?: string
  initial_stock?: number
  manage_inventory?: boolean
  allow_backorder?: boolean
}

export async function addAdminVariant(
  key: string,
  productId: string,
  input: VariantInput,
): Promise<Product> {
  return apiFetch(`/catalog/products/${productId}/variants`, {
    method: "POST",
    headers: adminHeaders(key),
    body: input,
  })
}

export interface UpdateVariantInput {
  title?: string
  sku?: string | null
  price?: string
  currency_code?: string
  manage_inventory?: boolean
  allow_backorder?: boolean
  is_default?: boolean
  position?: number
}

export async function updateAdminVariant(
  key: string,
  variantId: string,
  input: UpdateVariantInput,
): Promise<Product> {
  return apiFetch(`/catalog/variants/${variantId}`, {
    method: "PATCH",
    headers: adminHeaders(key),
    body: input,
  })
}

export async function deleteAdminVariant(
  key: string,
  variantId: string,
): Promise<{ id: string; deleted: boolean; productId: string }> {
  return apiFetch(`/catalog/variants/${variantId}`, {
    method: "DELETE",
    headers: adminHeaders(key),
  })
}

export async function addAdminProductImage(
  key: string,
  productId: string,
  input: { url: string; alt?: string; rank?: number },
): Promise<unknown> {
  return apiFetch(`/catalog/products/${productId}/images`, {
    method: "POST",
    headers: adminHeaders(key),
    body: input,
  })
}

export async function deleteAdminProductImage(
  key: string,
  imageId: string,
): Promise<{ id: string; deleted: boolean; productId: string }> {
  return apiFetch(`/catalog/images/${imageId}`, {
    method: "DELETE",
    headers: adminHeaders(key),
  })
}

export async function listAdminCategories(): Promise<Category[]> {
  return apiFetch<Category[]>("/catalog/categories?includeInactive=true")
}

export async function listWilayas(): Promise<Wilaya[]> {
  return apiFetch<{ data?: Wilaya[] } | Wilaya[]>("/locations/wilayas").then((res) =>
    Array.isArray(res) ? res : (res.data ?? []),
  )
}

// ───────────────────────── Phase 7: inventory admin ────────────────────────

export interface StockAdjustInput {
  quantity: number
  type: "receipt" | "adjustment" | "return"
  reason?: string
  reference?: string
}

export async function adjustAdminStock(
  key: string,
  variantId: string,
  input: StockAdjustInput,
): Promise<unknown> {
  return apiFetch(`/inventory/variants/${variantId}/adjust`, {
    method: "POST",
    headers: adminHeaders(key),
    body: input,
  })
}
