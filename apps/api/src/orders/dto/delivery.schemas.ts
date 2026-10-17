import { z } from "zod"
import { isWilayaCode } from "../../common/dz/wilayas"

const wilayaCode = z
  .string()
  .trim()
  .length(2, { message: "wilaya_code must be 2 characters" })
  .refine((value) => isWilayaCode(value), { message: "Unknown wilaya code" })

const currencyCode = z
  .string()
  .trim()
  .length(3, { message: "currency_code must be 3 letters" })
  .regex(/^[A-Za-z]{3}$/)

const deliveryMethod = z.enum(["home", "stop_desk"])

export const deliveryQuoteRequestSchema = z.object({
  wilaya_code: wilayaCode,
  method: deliveryMethod,
  currency_code: currencyCode,
})

export const deliveryMethodsQuerySchema = z.object({
  wilaya_code: wilayaCode,
  currency_code: currencyCode,
})

export const stopDesksQuerySchema = z.object({
  wilaya_code: wilayaCode,
})

export const createDeliveryRateSchema = z.object({
  wilaya_code: wilayaCode,
  method: deliveryMethod,
  currency_code: currencyCode,
  provider: z.string().trim().max(60).optional(),
  fee_amount: z
    .string()
    .trim()
    .regex(/^\d+$/, { message: "fee_amount must be a non-negative integer string (minor units)" }),
  label: z.string().trim().max(120).optional(),
  is_active: z.boolean().optional(),
})

export const updateDeliveryRateSchema = z
  .object({
    fee_amount: z
      .string()
      .trim()
      .regex(/^\d+$/, { message: "fee_amount must be a non-negative integer string (minor units)" })
      .optional(),
    label: z.string().trim().max(120).nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" })

export const listDeliveryRatesQuerySchema = z.object({
  wilaya_code: z.string().trim().length(2).optional(),
  method: deliveryMethod.optional(),
  provider: z.string().trim().max(60).optional(),
  active_only: z.coerce.boolean().optional(),
})

/**
 * Batch form of the delivery-rate upsert. The storefront lets an operator edit
 * many wilaya/method rows and save them together; each row is validated with the
 * same single-row schema, and the whole set is persisted in one transaction so a
 * partially applied batch is impossible.
 */
export const batchUpsertDeliveryRatesSchema = z.object({
  rates: z.array(createDeliveryRateSchema).min(1).max(200),
})

export type DeliveryQuoteRequest = z.infer<typeof deliveryQuoteRequestSchema>
export type DeliveryMethodsQuery = z.infer<typeof deliveryMethodsQuerySchema>
export type StopDesksQuery = z.infer<typeof stopDesksQuerySchema>
export type CreateDeliveryRateInput = z.infer<typeof createDeliveryRateSchema>
export type UpdateDeliveryRateInput = z.infer<typeof updateDeliveryRateSchema>
export type ListDeliveryRatesQuery = z.infer<typeof listDeliveryRatesQuerySchema>
export type BatchUpsertDeliveryRatesInput = z.infer<typeof batchUpsertDeliveryRatesSchema>
