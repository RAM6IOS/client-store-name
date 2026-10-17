import { MAX_LINE_QUANTITY } from "./cart"

interface InventoryCarrier {
  manage_inventory: boolean
  allow_backorder: boolean
  inventory_item: { stocked_quantity: number; reserved_quantity: number } | null
}

/**
 * Mirrors the API availability rule: a variant is orderable when it does not
 * manage inventory, allows backorders, or has stock above its reservations.
 * Stock counts are never shown as marketing claims — only used to gate the UI.
 */
export function isVariantAvailable(variant: InventoryCarrier): boolean {
  if (!variant.manage_inventory || variant.allow_backorder) return true
  if (!variant.inventory_item) return false
  return variant.inventory_item.stocked_quantity - variant.inventory_item.reserved_quantity > 0
}

/** Largest orderable quantity for a line, bounded by the schema maximum. */
export function maxOrderableQuantity(variant: InventoryCarrier): number {
  if (!variant.manage_inventory || variant.allow_backorder) return MAX_LINE_QUANTITY
  if (!variant.inventory_item) return 0
  const available = variant.inventory_item.stocked_quantity - variant.inventory_item.reserved_quantity
  return Math.max(0, Math.min(MAX_LINE_QUANTITY, available))
}

/** Index of the default variant (falls back to the first). */
export function defaultVariantIndex(product: { variants: Array<{ is_default: boolean }> }): number {
  const index = product.variants.findIndex((variant) => variant.is_default)
  return index >= 0 ? index : 0
}
