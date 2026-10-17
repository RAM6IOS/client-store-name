import { z } from "zod"
import { normalizeCurrencyCode } from "../../common/money/money"

/**
 * Request schemas for the administrative store-settings surface. A single
 * `store_settings` row holds the store's identity and COD/reservation policy.
 * `default_locale` is constrained to the locales the storefront actually
 * ships; `base_currency` must reference an existing active currency.
 */

export const STORE_LOCALES = ["ar", "fr"] as const

const localeSchema = z.enum(STORE_LOCALES)

const currencySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, { message: "must be a 3-letter ISO-4217 currency code" })
  .transform(normalizeCurrencyCode)

export const updateStoreSettingsSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    default_locale: localeSchema.optional(),
    base_currency: currencySchema.optional(),
    cod_enabled: z.boolean().optional(),
    reservation_ttl_minutes: z
      .number()
      .int({ message: "must be an integer" })
      .min(0, { message: "must not be negative" })
      .max(1440, { message: "must be at most 24 hours" })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "no fields to update" })

export type UpdateStoreSettingsInput = z.infer<typeof updateStoreSettingsSchema>
