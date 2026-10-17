import { z } from "zod"
import { CollectionStatus, DeliveryMethod, OrderStatus, ShipmentStatus } from "../../generated/prisma/client"
import { normalizePhone, isValidPhoneFormat } from "../../common/dz/phone"
import { isWilayaCode } from "../../common/dz/wilayas"

const idSchema = z.string().trim().min(1).max(64)

const nonEmptyString = z.string().trim().min(1, { message: "required" }).max(200)

const optionalText = z.string().trim().max(2000).optional()

const quantitySchema = z
  .number()
  .int({ message: "quantity must be an integer" })
  .min(1, { message: "quantity must be at least 1" })
  .max(1000, { message: "quantity is too large" })

const currencySchema = z
  .string()
  .trim()
  .length(3, { message: "currency_code must be 3 letters" })
  .regex(/^[A-Za-z]{3}$/)

export const orderItemInputSchema = z.object({
  variant_id: idSchema,
  quantity: quantitySchema,
})

export const checkoutSchema = z.object({
  idempotency_key: z
    .string()
    .trim()
    .min(16, { message: "idempotency_key must be at least 16 characters" })
    .max(120),
  currency_code: currencySchema,
  customer_name: nonEmptyString,
  customer_phone: z
    .string()
    .trim()
    .min(6)
    .max(20)
    .refine((value) => isValidPhoneFormat(value), {
      message: "Invalid Algerian phone number format",
    }),
  email: z.string().trim().email().max(160).optional().or(z.literal("").transform(() => undefined)),
  delivery_method: z.enum([DeliveryMethod.home, DeliveryMethod.stop_desk]),
  wilaya_code: z
    .string()
    .trim()
    .length(2)
    .refine((value) => isWilayaCode(value), { message: "Unknown wilaya code" }),
  commune: nonEmptyString,
  /** Optional stable commune/postal code from the location dataset. */
  commune_code: z.string().trim().min(1).max(20).optional(),
  address_line: optionalText,
  nearby_landmark: optionalText,
  notes: optionalText,
  /** Stop-desk details (only meaningful for `stop_desk` delivery). */
  stop_desk_id: z.string().trim().min(1).max(160).optional(),
  stop_desk_name: z.string().trim().min(1).max(200).optional(),
  stop_desk_address: z.string().trim().min(1).max(500).optional(),
  items: z
    .array(orderItemInputSchema)
    .min(1, { message: "At least one item is required" })
    .max(100, { message: "Too many items" }),
})

/**
 * Every administrative mutation must name its actor. The actor is written to
 * the append-only `OrderStatusHistory` so each transition is attributable. It
 * is a free-form operator label in this phase (see ADR-0007 / Phase 6 gap
 * report); it is *not* an authenticated identity until JWT+RBAC lands.
 */
const actorSchema = z.string().trim().min(1, { message: "actor is required" }).max(120)

const noteSchema = z.string().trim().max(500).optional()

export const confirmOrderSchema = z.object({
  actor: actorSchema,
  note: noteSchema,
})

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(1).max(500),
  actor: actorSchema,
  note: noteSchema,
})

export const transitionOrderSchema = z.object({
  to_status: z.enum(Object.values(OrderStatus) as [OrderStatus, ...OrderStatus[]]),
  note: noteSchema,
  actor: actorSchema,
})

/** Shared body for the named operational actions (prepare/dispatch/…). */
export const orderActionSchema = z.object({
  actor: actorSchema,
  note: noteSchema,
})

/**
 * Filters shared by the admin order list and the CSV export.
 *
 * `search` matches a customer name substring, a wilaya name substring, an
 * order reference (`123` or `#123`), or a phone number (stored E.164 `+213…`,
 * or a raw local number).
 */
const orderFiltersShape = {
  search: z.string().trim().min(1).max(120).optional(),
  status: z.enum(Object.values(OrderStatus) as [OrderStatus, ...OrderStatus[]]).optional(),
  shipment_status: z
    .enum(Object.values(ShipmentStatus) as [ShipmentStatus, ...ShipmentStatus[]])
    .optional(),
  collection_status: z
    .enum(Object.values(CollectionStatus) as [CollectionStatus, ...CollectionStatus[]])
    .optional(),
  wilaya_code: z
    .string()
    .trim()
    .length(2)
    .refine((value) => isWilayaCode(value), { message: "Unknown wilaya code" })
    .optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}

const sortShape = {
  sort: z.enum(["created_at", "updated_at", "total_amount", "display_id"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
}

export const listOrdersQuerySchema = z.object({
  ...orderFiltersShape,
  ...sortShape,
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
})

export const exportOrdersQuerySchema = z.object({
  ...orderFiltersShape,
  ...sortShape,
})

export type CheckoutInput = z.infer<typeof checkoutSchema>
export type ConfirmOrderInput = z.infer<typeof confirmOrderSchema>
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>
export type TransitionOrderInput = z.infer<typeof transitionOrderSchema>
export type OrderActionInput = z.infer<typeof orderActionSchema>
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>
export type ExportOrdersQuery = z.infer<typeof exportOrdersQuerySchema>