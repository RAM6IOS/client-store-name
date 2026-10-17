/**
 * Typed domain errors. Services throw these; the global
 * `DomainExceptionFilter` maps them to HTTP responses with a stable machine
 * `code`. Controllers and repositories never construct HTTP exceptions.
 */
export type DomainErrorCode =
  | "NOT_FOUND"
  | "CONFLICT"
  | "HISTORY_EXISTS"
  | "DUPLICATE_SKU"
  | "DUPLICATE_HANDLE"
  | "DUPLICATE_SLUG"
  | "UNKNOWN_CURRENCY"
  | "INVALID_PRICE"
  | "INVALID_STOCK"
  | "INSUFFICIENT_STOCK"
  | "VALIDATION_ERROR"
  | "INVALID_TRANSITION"
  | "INVALID_LOCATION"
  | "DELIVERY_UNAVAILABLE"
  | "SHIPPING_PROVIDER_NOT_CONFIGURED"
  | "SHIPPING_PROVIDER_ERROR"
  | "INVALID_IMAGE"
  | "IMAGE_COUNT_EXCEEDED"
  | "FILE_TOO_LARGE"
  | "FILE_COUNT_EXCEEDED"

export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: DomainErrorCode,
    readonly httpStatus: number,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Resource not found", details?: unknown) {
    super(message, "NOT_FOUND", 404, details)
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, code: DomainErrorCode = "CONFLICT", details?: unknown) {
    super(message, code, 409, details)
  }
}

export class DuplicateSkuError extends ConflictError {
  constructor(sku: string) {
    super(`SKU "${sku}" is already in use`, "DUPLICATE_SKU", { sku })
  }
}

/** A catalog row is referenced by order history and cannot be deleted without
 * destroying the historical record; the operator is expected to archive it
 * instead. */
export class HistoryExistsError extends ConflictError {
  constructor(message: string, details?: unknown) {
    super(message, "HISTORY_EXISTS", details)
  }
}

export class DuplicateHandleError extends ConflictError {
  constructor(handle: string) {
    super(`Product handle "${handle}" is already in use`, "DUPLICATE_HANDLE", { handle })
  }
}

export class DuplicateSlugError extends ConflictError {
  constructor(slug: string) {
    super(`Category slug "${slug}" is already in use`, "DUPLICATE_SLUG", { slug })
  }
}

export class UnknownCurrencyError extends DomainError {
  constructor(currency: string) {
    super(`Unknown or inactive currency "${currency}"`, "UNKNOWN_CURRENCY", 400, { currency })
  }
}

export class InvalidPriceError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, "INVALID_PRICE", 400, details)
  }
}

export class InvalidStockError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, "INVALID_STOCK", 400, details)
  }
}

export class InsufficientStockError extends DomainError {
  constructor(
    readonly available: number,
    readonly requested: number,
    details?: unknown,
  ) {
    super(
      `Insufficient stock: requested ${requested}, available ${available}`,
      "INSUFFICIENT_STOCK",
      409,
      { available, requested, ...(details as object | undefined) },
    )
  }
}

/** Unknown/invalid wilaya or commune, or a commune that does not belong to the
 * selected wilaya. */
export class InvalidLocationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, "INVALID_LOCATION", 400, details)
  }
}

/** The destination is valid but cannot be served (no active rate, disabled
 * destination, or unsupported delivery method). */
export class DeliveryUnavailableError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, "DELIVERY_UNAVAILABLE", 422, details)
  }
}

/** An uploaded file does not look like a supported image or exceeds bounds.
 * Thrown by the media store before anything is persisted so a rejected batch
 * never leaves orphan files behind. */
export class InvalidImageError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, "INVALID_IMAGE", 400, details)
  }
}

/** A shipping provider operation was attempted while no real provider is
 * configured. Never leaks credentials. */
export class ShippingProviderNotConfiguredError extends DomainError {
  constructor(provider?: string) {
    super(
      provider
        ? `Shipping provider "${provider}" is not configured`
        : "No shipping provider is configured for this store",
      "SHIPPING_PROVIDER_NOT_CONFIGURED",
      503,
      provider ? { provider } : undefined,
    )
  }
}

/** Normalized carrier/provider failure. `retryable` tells callers whether a
 * retry may succeed (network/timeout/5xx) versus a permanent rejection. */
export class ShippingProviderError extends DomainError {
  constructor(
    message: string,
    readonly retryable: boolean,
    details?: unknown,
  ) {
    super(message, "SHIPPING_PROVIDER_ERROR", 502, { retryable, ...(details as object | undefined) })
  }
}
