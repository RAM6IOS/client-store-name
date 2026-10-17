import { z } from "zod"

/**
 * Request schemas for the inventory module. Stock quantities are integers;
 * reserve/release must be strictly positive, adjustments must be non-zero.
 */

export const ADJUSTMENT_TYPES = ["receipt", "adjustment", "return"] as const

const referenceSchema = z.string().trim().max(120).optional()
const reasonSchema = z.string().trim().max(500).optional()

export const adjustStockSchema = z
  .object({
    quantity: z
      .number()
      .int({ message: "quantity must be an integer" })
      .refine((value) => value !== 0, { message: "quantity must not be zero" })
      .refine((value) => Math.abs(value) <= 100_000_000, {
        message: "quantity is unreasonably large",
      }),
    type: z.enum(ADJUSTMENT_TYPES).default("adjustment"),
    reason: reasonSchema,
    reference: referenceSchema,
  })
  .superRefine((value, ctx) => {
    if (value.type !== "adjustment" && value.quantity < 0) {
      ctx.addIssue({
        code: "custom",
        message: `quantity must be positive for a ${value.type} movement`,
        path: ["quantity"],
      })
    }
  })

export const reserveStockSchema = z.object({
  quantity: z
    .number()
    .int()
    .positive({ message: "quantity must be a positive integer" })
    .max(100_000_000),
  reason: reasonSchema,
  reference: referenceSchema,
})

export const releaseStockSchema = z.object({
  quantity: z
    .number()
    .int()
    .positive({ message: "quantity must be a positive integer" })
    .max(100_000_000),
  reason: reasonSchema,
  reference: referenceSchema,
})

export const listInventoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  lowStock: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === "true"),
})

export const listMovementsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
})

export type AdjustStockInput = z.infer<typeof adjustStockSchema>
export type ReserveStockInput = z.infer<typeof reserveStockSchema>
export type ReleaseStockInput = z.infer<typeof releaseStockSchema>
export type ListInventoryQuery = z.infer<typeof listInventoryQuerySchema>
export type ListMovementsQuery = z.infer<typeof listMovementsQuerySchema>
