import { describe, expect, it } from "vitest"
import { defaultVariantIndex, isVariantAvailable, maxOrderableQuantity } from "./inventory"
import { MAX_LINE_QUANTITY } from "./cart"

function variant(overrides: Partial<Parameters<typeof isVariantAvailable>[0]> = {}) {
  return {
    manage_inventory: true,
    allow_backorder: false,
    inventory_item: { stocked_quantity: 10, reserved_quantity: 2 },
    ...overrides,
  }
}

describe("isVariantAvailable", () => {
  it("is available when inventory is not managed", () => {
    expect(isVariantAvailable(variant({ manage_inventory: false }))).toBe(true)
  })

  it("is available when backorders are allowed", () => {
    expect(isVariantAvailable(variant({ allow_backorder: true }))).toBe(true)
  })

  it("is unavailable when there is no inventory item", () => {
    expect(isVariantAvailable(variant({ inventory_item: null }))).toBe(false)
  })

  it("requires stock above reservations", () => {
    expect(isVariantAvailable(variant())).toBe(true)
    expect(
      isVariantAvailable(
        variant({ inventory_item: { stocked_quantity: 2, reserved_quantity: 2 } }),
      ),
    ).toBe(false)
    expect(
      isVariantAvailable(
        variant({ inventory_item: { stocked_quantity: 1, reserved_quantity: 5 } }),
      ),
    ).toBe(false)
  })
})

describe("maxOrderableQuantity", () => {
  it("returns the schema maximum when inventory is not gating", () => {
    expect(maxOrderableQuantity(variant({ manage_inventory: false }))).toBe(MAX_LINE_QUANTITY)
    expect(maxOrderableQuantity(variant({ allow_backorder: true }))).toBe(MAX_LINE_QUANTITY)
  })

  it("is bounded by available stock", () => {
    expect(
      maxOrderableQuantity(
        variant({ inventory_item: { stocked_quantity: 7, reserved_quantity: 2 } }),
      ),
    ).toBe(5)
  })

  it("never returns a negative quantity", () => {
    expect(
      maxOrderableQuantity(
        variant({ inventory_item: { stocked_quantity: 1, reserved_quantity: 9 } }),
      ),
    ).toBe(0)
    expect(maxOrderableQuantity(variant({ inventory_item: null }))).toBe(0)
  })

  it("caps at the schema maximum", () => {
    expect(
      maxOrderableQuantity(
        variant({
          inventory_item: { stocked_quantity: MAX_LINE_QUANTITY + 50, reserved_quantity: 0 },
        }),
      ),
    ).toBe(MAX_LINE_QUANTITY)
  })
})

describe("defaultVariantIndex", () => {
  it("finds the default variant", () => {
    const product = { variants: [{ is_default: false }, { is_default: true }] }
    expect(defaultVariantIndex(product)).toBe(1)
  })

  it("falls back to the first variant", () => {
    expect(defaultVariantIndex({ variants: [{ is_default: false }] })).toBe(0)
    expect(defaultVariantIndex({ variants: [] })).toBe(0)
  })
})
