export const ORDER_CREATION_SCOPE = "order.create"

export const ORDER_MAX_ITEMS = 100
export const ORDER_MAX_QUANTITY_PER_ITEM = 1000

export type OrderActor = {
  id?: string
  name?: string
} | null | undefined