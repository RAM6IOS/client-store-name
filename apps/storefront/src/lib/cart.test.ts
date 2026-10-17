import { describe, expect, it } from "vitest"
import {
  addItem,
  type CartItem,
  type CartState,
  cartCurrency,
  cartItemCount,
  cartLines,
  cartSubtotal,
  clearCart,
  deserializeCart,
  emptyCart,
  hasMixedCurrencies,
  MAX_LINE_QUANTITY,
  removeItem,
  serializeCart,
  setQuantity,
} from "./cart"

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    variantId: "v1",
    productHandle: "tee",
    productTitle: "Tee",
    variantTitle: "M",
    unitAmount: "120000",
    currencyCode: "DZD",
    quantity: 1,
    image: null,
    ...overrides,
  }
}

describe("cart transitions", () => {
  it("adds a new line", () => {
    const state = addItem(emptyCart, item())
    expect(state.items).toHaveLength(1)
    expect(state.items[0].quantity).toBe(1)
  })

  it("merges quantities when the variant already exists", () => {
    const state = addItem(addItem(emptyCart, item({ quantity: 1 })), item({ quantity: 2 }))
    expect(state.items).toHaveLength(1)
    expect(state.items[0].quantity).toBe(3)
  })

  it("clamps quantities to the schema maximum", () => {
    const state = addItem(emptyCart, item({ quantity: MAX_LINE_QUANTITY + 500 }))
    expect(state.items[0].quantity).toBe(MAX_LINE_QUANTITY)
  })

  it("removes a line when quantity drops below one", () => {
    const state = addItem(emptyCart, item())
    expect(setQuantity(state, "v1", 0).items).toHaveLength(0)
  })

  it("updates and removes lines", () => {
    const state = addItem(emptyCart, item())
    expect(setQuantity(state, "v1", 5).items[0].quantity).toBe(5)
    expect(removeItem(state, "v1").items).toHaveLength(0)
    expect(clearCart().items).toHaveLength(0)
  })
})

describe("cart aggregates", () => {
  it("counts units and sums the subtotal in minor units", () => {
    const state: CartState = {
      items: [item({ quantity: 2 }), item({ variantId: "v2", unitAmount: "120000", quantity: 3 })],
    }
    expect(cartItemCount(state)).toBe(5)
    expect(cartSubtotal(state)).toBe(120000n * 5n)
    expect(cartLines(state)).toEqual([
      { variantId: "v1", quantity: 2 },
      { variantId: "v2", quantity: 3 },
    ])
  })

  it("tracks currency and mixed-currency carts", () => {
    const single = addItem(emptyCart, item())
    expect(cartCurrency(single)).toBe("DZD")
    expect(hasMixedCurrencies(single)).toBe(false)

    const mixed: CartState = { items: [item(), item({ variantId: "v2", currencyCode: "EUR" })] }
    expect(hasMixedCurrencies(mixed)).toBe(true)
    expect(cartCurrency(mixed)).toBe("DZD")
  })
})

describe("cart persistence", () => {
  it("round-trips through serialization", () => {
    const state = addItem(emptyCart, item({ quantity: 2 }))
    expect(deserializeCart(serializeCart(state))).toEqual(state)
  })

  it("returns an empty cart for malformed or unknown input", () => {
    expect(deserializeCart(null)).toEqual(emptyCart)
    expect(deserializeCart("not json")).toEqual(emptyCart)
    expect(deserializeCart("[]")).toEqual(emptyCart)
    expect(deserializeCart('{"items":"nope"}')).toEqual(emptyCart)
  })

  it("drops invalid lines while keeping valid ones", () => {
    const raw = JSON.stringify({
      items: [item({ quantity: 2 }), { variantId: "broken" }, null],
    })
    const parsed = deserializeCart(raw)
    expect(parsed.items).toHaveLength(1)
    expect(parsed.items[0].variantId).toBe("v1")
    expect(parsed.items[0].quantity).toBe(2)
  })

  it("re-clamps persisted quantities", () => {
    const raw = JSON.stringify({ items: [item({ quantity: 99_999 })] })
    expect(deserializeCart(raw).items[0].quantity).toBe(MAX_LINE_QUANTITY)
  })
})
