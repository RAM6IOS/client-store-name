import { z } from "zod"
import { normalizeCurrencyCode } from "../../common/money/money"

/**
 * Request schemas for the catalog module. Zod is the single source of truth
 * for input validation (see `docs/api/catalog-and-inventory.md`).
 *
 * Money is accepted either as `*_amount` (integer minor units, the storage
 * representation per ADR-0005) or as `price` (a decimal string in major units,
 * converted using the currency's `minor_digits`). Negative amounts and
 * non-integer stock quantities are rejected here.
 */

export const PRODUCT_STATUSES = ["draft", "published", "archived"] as const

/** SKUs are normalised to upper-case so uniqueness is case-insensitive. */
export function normalizeSku(raw: string): string {
  return raw.trim().toUpperCase()
}

const idSchema = z.string().trim().min(1).max(64)
const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "must be a lowercase, hyphen-separated slug" })
const skuSchema = z.string().trim().min(1).max(64).transform(normalizeSku)
const currencySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, { message: "must be a 3-letter ISO-4217 currency code" })
  .transform(normalizeCurrencyCode)
const urlSchema = z.string().trim().url({ message: "must be a valid URL" }).max(2048)
const descriptionSchema = z.string().trim().max(20_000)

/** Integer minor units, accepted as a non-negative integer number or string. */
const minorUnitsSchema = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const raw = typeof value === "number" ? String(value) : value.trim()
  if (!/^\d+$/.test(raw)) {
    ctx.addIssue({
      code: "custom",
      message: "must be a non-negative integer number of minor units",
    })
    return z.NEVER
  }
  const amount = BigInt(raw)
  if (amount > 9_007_199_254_740_991n) {
    ctx.addIssue({ code: "custom", message: "amount is too large" })
    return z.NEVER
  }
  return amount
})

/** Non-negative decimal in major units, e.g. "1500.00". */
const decimalAmountSchema = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d+)?$/, { message: 'must be a non-negative decimal string, e.g. "1500.00"' })

const stockQuantitySchema = z
  .number()
  .int({ message: "must be an integer" })
  .min(0, { message: "must not be negative" })
  .max(100_000_000, { message: "is unreasonably large" })

const positionSchema = z.number().int().min(0).max(1_000_000)

const priceFields = {
  price_amount: minorUnitsSchema.optional(),
  price: decimalAmountSchema.optional(),
  // Compare-at is nullable so a variant can clear its discount (`null`) without
  // touching a sibling variant. Omitting the field leaves the value unchanged.
  compare_at_amount: minorUnitsSchema.nullable().optional(),
  compare_at_price: decimalAmountSchema.nullable().optional(),
  currency_code: currencySchema.optional(),
}

function hasPrice(value: { price_amount?: bigint; price?: string }): boolean {
  return value.price_amount !== undefined || value.price !== undefined
}

export const optionValueInputSchema = z.object({
  id: idSchema.optional(),
  value: z.string().trim().min(1).max(100),
  position: positionSchema.optional(),
})

export const productOptionInputSchema = z.object({
  id: idSchema.optional(),
  title: z.string().trim().min(1).max(100),
  position: positionSchema.optional(),
  values: z.array(optionValueInputSchema).min(1).max(100),
})

export const variantInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    sku: skuSchema.optional(),
    position: positionSchema.optional(),
    is_default: z.boolean().optional(),
    is_active: z.boolean().optional(),
    image: urlSchema.optional(),
    manage_inventory: z.boolean().optional(),
    allow_backorder: z.boolean().optional(),
    initial_stock: stockQuantitySchema.optional(),
    option_value_ids: z.array(idSchema).optional(),
    ...priceFields,
  })
  .refine(hasPrice, {
    message: "provide price_amount (minor units) or price (decimal)",
    path: ["price_amount"],
  })

export const imageInputSchema = z.object({
  url: urlSchema,
  alt: z.string().trim().max(300).optional(),
  rank: positionSchema.optional(),
})

export const categoryRefSchema = z.object({
  category_id: idSchema,
  position: positionSchema.optional(),
})

export const createProductSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: descriptionSchema.optional(),
    handle: slugSchema.optional(),
    status: z.enum(PRODUCT_STATUSES).optional(),
    thumbnail: urlSchema.optional(),
    is_featured: z.boolean().optional(),
    sku: skuSchema.optional(),
    initial_stock: stockQuantitySchema.optional(),
    categories: z.array(categoryRefSchema).max(100).optional(),
    images: z.array(imageInputSchema).max(100).optional(),
    variants: z.array(variantInputSchema).min(1).max(100).optional(),
    options: z.array(productOptionInputSchema).max(20).optional(),
    ...priceFields,
  })
  .superRefine((value, ctx) => {
    if (!value.variants || value.variants.length === 0) {
      if (!hasPrice(value)) {
        ctx.addIssue({
          code: "custom",
          message: "simple products require price_amount (minor units) or price (decimal)",
          path: ["price_amount"],
        })
      }
      if (!value.currency_code) {
        ctx.addIssue({
          code: "custom",
          message: "simple products require currency_code",
          path: ["currency_code"],
        })
      }
      return
    }
    value.variants.forEach((variant, index) => {
      if (!variant.currency_code && !value.currency_code) {
        ctx.addIssue({
          code: "custom",
          message: "variant requires currency_code (or set it on the product)",
          path: ["variants", index, "currency_code"],
        })
      }
    })
  })

export const updateProductSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: descriptionSchema.nullable().optional(),
    handle: slugSchema.optional(),
    status: z.enum(PRODUCT_STATUSES).optional(),
    thumbnail: urlSchema.nullable().optional(),
    is_featured: z.boolean().optional(),
    // Product-level compare-at. `null` clears the value; omitting both fields
    // leaves the current compare-at untouched. Applied to the default variant.
    compare_at_amount: minorUnitsSchema.nullable().optional(),
    compare_at_price: decimalAmountSchema.nullable().optional(),
    categories: z.array(categoryRefSchema).max(100).optional(),
    options: z.array(productOptionInputSchema).max(20).optional(),
    variants: z.array(variantInputSchema).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "no fields to update" })

export const updateVariantSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    sku: skuSchema.nullable().optional(),
    position: positionSchema.optional(),
    is_default: z.boolean().optional(),
    is_active: z.boolean().optional(),
    image: urlSchema.nullable().optional(),
    manage_inventory: z.boolean().optional(),
    allow_backorder: z.boolean().optional(),
    ...priceFields,
  })
  .refine((value) => Object.keys(value).length > 0, { message: "no fields to update" })

export const generateVariantsSchema = z.object({
  options: z.array(productOptionInputSchema).min(1).max(20),
})

export const createVariantSchema = variantInputSchema

export const createImageSchema = imageInputSchema

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: slugSchema.optional(),
  description: descriptionSchema.optional(),
  parent_id: idSchema.nullable().optional(),
  position: positionSchema.optional(),
  is_active: z.boolean().optional(),
})

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    slug: slugSchema.optional(),
    description: descriptionSchema.nullable().optional(),
    parent_id: idSchema.nullable().optional(),
    position: positionSchema.optional(),
    is_active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "no fields to update" })

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  category: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  featured: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === true || value === "true")),
})

export const listCategoriesQuerySchema = z.object({
  includeInactive: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
})

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type CategoryRefInput = z.infer<typeof categoryRefSchema>
export type VariantInput = z.infer<typeof variantInputSchema>
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>
export type ImageInput = z.infer<typeof imageInputSchema>
export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>
export type ProductOptionInput = z.infer<typeof productOptionInputSchema>
export type OptionValueInput = z.infer<typeof optionValueInputSchema>
export type GenerateVariantsInput = z.infer<typeof generateVariantsSchema>
