"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  addItem as addItemToCart,
  CART_STORAGE_KEY,
  type CartItem,
  cartCurrency,
  cartItemCount,
  type CartState,
  cartSubtotal,
  clearCart,
  deserializeCart,
  emptyCart,
  removeItem as removeItemFromCart,
  serializeCart,
  setQuantity as setCartQuantity,
} from "@/lib/cart"

interface CartContextValue {
  items: CartItem[]
  /** Total number of units across all lines. */
  count: number
  subtotal: bigint
  currency: string | null
  /** False until the persisted cart has been read on the client. */
  ready: boolean
  addItem: (item: CartItem) => void
  setQuantity: (variantId: string, quantity: number) => void
  removeItem: (variantId: string) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>(emptyCart)
  const [ready, setReady] = useState(false)

  // Hydrate from localStorage after mount (SSR always renders an empty cart,
  // which keeps the markup deterministic).
  useEffect(() => {
    setState(deserializeCart(window.localStorage.getItem(CART_STORAGE_KEY)))
    setReady(true)
  }, [])

  // Persist on change, but never before hydration overwrote the empty default.
  useEffect(() => {
    if (!ready) return
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(state))
  }, [state, ready])

  // Keep multiple tabs in sync.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== CART_STORAGE_KEY) return
      setState(deserializeCart(event.newValue))
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const addItem = useCallback((item: CartItem) => setState((current) => addItemToCart(current, item)), [])
  const setQuantity = useCallback(
    (variantId: string, quantity: number) =>
      setState((current) => setCartQuantity(current, variantId, quantity)),
    [],
  )
  const removeItem = useCallback(
    (variantId: string) => setState((current) => removeItemFromCart(current, variantId)),
    [],
  )
  const clear = useCallback(() => setState(clearCart()), [])

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      count: cartItemCount(state),
      subtotal: cartSubtotal(state),
      currency: cartCurrency(state),
      ready,
      addItem,
      setQuantity,
      removeItem,
      clear,
    }),
    [state, ready, addItem, setQuantity, removeItem, clear],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext)
  if (!value) throw new Error("useCart must be used within a CartProvider")
  return value
}
