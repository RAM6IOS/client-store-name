import type {
  Category,
  CheckoutInput,
  Commune,
  DeliveryMethod,
  DeliveryMethodOption,
  DeliveryQuote,
  OrderPublic,
  Product,
  PublicStoreSettings,
  StopDesk,
  Wilaya,
} from "./api-types"

/**
 * Server components prefer the internal `API_BASE_URL` (no CORS hop); the
 * browser uses `NEXT_PUBLIC_API_URL`. Both include the `/api` global prefix.
 */
const serverBaseUrl = typeof window === "undefined" ? process.env.API_BASE_URL : undefined

export const API_BASE_URL =
  serverBaseUrl ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"

/** Join the configured API base URL with a path, normalizing slashes. */
export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${API_BASE_URL.replace(/\/+$/, "")}${normalizedPath}`
}

export interface HealthResponse {
  status: string
  service: string
  uptime: number
  timestamp: string
}

/** Fetch the API liveness endpoint. Throws on non-2xx responses. */
export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(apiUrl("/health"), { signal, cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`)
  }
  return (await response.json()) as HealthResponse
}

// ───────────────────────────────── Errors ──────────────────────────────────

export interface ApiErrorInit {
  status: number
  code: string
  details?: unknown
}

export const API_ERROR_CODES = {
  VALIDATION: "VALIDATION_ERROR",
  DELIVERY_UNAVAILABLE: "DELIVERY_UNAVAILABLE",
  INVALID_LOCATION: "INVALID_LOCATION",
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  NOT_FOUND: "NOT_FOUND",
  NETWORK: "NETWORK_ERROR",
} as const

/** A structured API failure carrying the backend's machine-readable `code`. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown

  constructor(message: string, init: ApiErrorInit) {
    super(message)
    this.name = "ApiError"
    this.status = init.status
    this.code = init.code
    this.details = init.details
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

// ─────────────────────────────── Core fetch ────────────────────────────────

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown
  /** Defaults to true (never cached); set false to opt into Next fetch cache. */
  noStore?: boolean
}

/**
 * Performs a JSON request against the API and unwraps the response. Failures
 * (including network failures) are thrown as `ApiError` so callers branch on
 * `code` rather than parsing message strings.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, noStore = true, headers, ...rest } = options

  let response: Response
  try {
    response = await fetch(apiUrl(path), {
      ...rest,
      cache: noStore ? "no-store" : rest.cache,
      headers: {
        accept: "application/json",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(headers as Record<string, string> | undefined),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch (cause) {
    throw new ApiError("Network request failed", {
      status: 0,
      code: API_ERROR_CODES.NETWORK,
      details: cause instanceof Error ? cause.message : cause,
    })
  }

  if (response.status === 204) return undefined as T

  let payload: unknown
  const text = await response.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    const envelope = isRecord(payload) ? payload : {}
    const rawMessage = envelope.message
    const message =
      typeof rawMessage === "string"
        ? rawMessage
        : Array.isArray(rawMessage)
          ? rawMessage.join(", ")
          : `Request failed with status ${response.status}`
    const code = typeof envelope.code === "string" ? envelope.code : `HTTP_${response.status}`
    throw new ApiError(message, { status: response.status, code, details: envelope.details ?? envelope })
  }

  return payload as T
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ""
}

// ───────────────────────────────── Store ───────────────────────────────────

export async function getStoreSettings(): Promise<PublicStoreSettings> {
  return apiFetch<PublicStoreSettings>("/store/settings")
}

export async function getStoreSettingsSafe(): Promise<PublicStoreSettings | null> {
  try {
    return await getStoreSettings()
  } catch {
    return null
  }
}

// ──────────────────────────────── Catalog ──────────────────────────────────

export interface ListProductsParams {
  page?: number
  pageSize?: number
  status?: string
  /** Category id or slug (the API accepts both). */
  category?: string
  search?: string
  /** Only products flagged for the homepage featured row. */
  featured?: boolean
}

export interface Paginated<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export async function listProducts(params: ListProductsParams = {}): Promise<Paginated<Product>> {
  const { featured, ...rest } = params
  return apiFetch<Paginated<Product>>(
    `/catalog/products${buildQuery({
      ...rest,
      featured: featured === undefined ? undefined : String(featured),
    })}`,
  )
}

export async function getProductByHandle(handle: string): Promise<Product> {
  return apiFetch<Product>(`/catalog/products/by-handle/${encodeURIComponent(handle)}`)
}

export async function getProductByHandleSafe(handle: string): Promise<Product | null> {
  try {
    return await getProductByHandle(handle)
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null
    throw error
  }
}

export async function listCategories(): Promise<Category[]> {
  return apiFetch<Category[]>("/catalog/categories")
}

// ─────────────────────────────── Locations ─────────────────────────────────

export async function listWilayas(): Promise<Wilaya[]> {
  const result = await apiFetch<{ data: Wilaya[] }>("/locations/wilayas", { noStore: false })
  return result.data
}

export async function listCommunes(
  wilayaCode: string,
  params: { q?: string; page?: number; pageSize?: number } = {},
): Promise<Paginated<Commune>> {
  const path = `/locations/wilayas/${encodeURIComponent(wilayaCode)}/communes${buildQuery({
    q: params.q,
    page: params.page,
    pageSize: params.pageSize,
  })}`
  return apiFetch<Paginated<Commune>>(path)
}

// ──────────────────────── Delivery (quote / methods) ───────────────────────

export async function deliveryMethods(
  wilayaCode: string,
  currencyCode: string,
): Promise<DeliveryMethodOption[]> {
  const path = `/delivery/methods${buildQuery({
    wilaya_code: wilayaCode,
    currency_code: currencyCode,
  })}`
  const result = await apiFetch<{ data: DeliveryMethodOption[] }>(path)
  return result.data
}

export async function deliveryQuote(input: {
  wilaya_code: string
  method: DeliveryMethod
  currency_code: string
}): Promise<DeliveryQuote> {
  return apiFetch<DeliveryQuote>("/delivery/quote", { method: "POST", body: input })
}

export async function stopDesks(wilayaCode: string): Promise<{
  data: StopDesk[]
  total: number
  provider_configured: boolean
}> {
  return apiFetch(`/delivery/stop-desks${buildQuery({ wilaya_code: wilayaCode })}`)
}

// ──────────────────────────────── Checkout ─────────────────────────────────

export async function createCheckout(input: CheckoutInput): Promise<OrderPublic> {
  return apiFetch<OrderPublic>("/checkout", { method: "POST", body: input })
}

export async function getOrderByToken(token: string): Promise<OrderPublic> {
  return apiFetch<OrderPublic>(`/orders/track/${encodeURIComponent(token)}`)
}
