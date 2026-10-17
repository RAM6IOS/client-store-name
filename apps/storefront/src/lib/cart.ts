import { sumMinorUnits, toMinorUnits } from "./money"

/**
 * Shopping cart state and pure transitions. The cart is intentionally a plain,
 * serialisable structure persisted in `localStorage`; all logic lives in pure
 * functions so it can be unit-tested without a DOM.
 *
 * Quantities are clamped to `MAX_LINE_QUANTITY`, matching the API's schema cap.
 */

export const CART_STORAGE_KEY = "bita.cart.v1"
export const MAX_LINE_QUANTITY = 1000

export interface CartItem {
  variantId: string
  productHandle: string
  productTitle: string
  variantTitle: string
  /** Unit price in integer minor units, as returned by the API. */
  unitAmount: string
  currencyCode: string
  quantity: number
  image: string | null
}

export interface CartState {
  items: CartItem[]
}

export const emptyCart: CartState = { items: [] }

export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1
  const truncated = Math.trunc(quantity)
  if (truncated < 1) return 1
  if (truncated > MAX_LINE_QUANTITY) return MAX_LINE_QUANTITY
  return truncated
}

/** Adds a line, merging quantities when the variant is already present. */
export function addItem(state: CartState, item: CartItem): CartState {
  const existing = state.items.find((line) => line.variantId === item.variantId)
  if (!existing) {
    return { items: [...state.items, { ...item, quantity: clampQuantity(item.quantity) }] }
  }
  return {
    items: state.items.map((line) =>
      line.variantId === item.variantId
        ? { ...line, quantity: clampQuantity(line.quantity + item.quantity) }
        : line,
    ),
  }
}

export function setQuantity(state: CartState, variantId: string, quantity: number): CartState {
  if (quantity < 1) return removeItem(state, variantId)
  return {
    items: state.items.map((line) =>
      line.variantId === variantId ? { ...line, quantity: clampQuantity(quantity) } : line,
    ),
  }
}

export function removeItem(state: CartState, variantId: string): CartState {
  return { items: state.items.filter((line) => line.variantId !== variantId) }
}

export function clearCart(): CartState {
  return { items: [] }
}

export function cartItemCount(state: CartState): number {
  return state.items.reduce((count, line) => count + line.quantity, 0)
}

export function cartSubtotal(state: CartState): bigint {
  return sumMinorUnits(state.items.map((line) => toMinorUnits(line.unitAmount) * BigInt(line.quantity)))
}

/** The cart's currency when all lines agree, otherwise the first line's. */
export function cartCurrency(state: CartState): string | null {
  return state.items[0]?.currencyCode ?? null
}

export function hasMixedCurrencies(state: CartState): boolean {
  const currencies = new Set(state.items.map((line) => line.currencyCode))
  return currencies.size > 1
}

export function cartLines(state: CartState): Array<{ variantId: string; quantity: number }> {
  return state.items.map((line) => ({ variantId: line.variantId, quantity: line.quantity }))
}

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== "object" || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.variantId === "string" &&
    typeof item.productHandle === "string" &&
    typeof item.productTitle === "string" &&
    typeof item.variantTitle === "string" &&
    typeof item.unitAmount === "string" &&
    typeof item.currencyCode === "string" &&
    typeof item.quantity === "number" &&
    (item.image === null || typeof item.image === "string")
  )
}

/** Parses persisted JSON defensively; any malformed input yields an empty cart. */
export function deserializeCart(raw: string | null | undefined): CartState {
  if (!raw) return emptyCart
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== "object" || parsed === null) return emptyCart
    const items = (parsed as { items?: unknown }).items
    if (!Array.isArray(items)) return emptyCart
    return { items: items.filter(isCartItem).map((item) => ({ ...item, quantity: clampQuantity(item.quantity) })) }
  } catch {
    return emptyCart
  }
}

export function serializeCart(state: CartState): string {
  return JSON.stringify(state)
}
