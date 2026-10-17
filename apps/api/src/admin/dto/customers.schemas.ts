import { z } from "zod"

/**
 * Request schema for the derived customer list. Customers are not a stored
 * entity in this starter; they are computed by grouping orders on their
 * normalised phone number (see `CustomersService`).
 */
export const listCustomersQuerySchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
})

export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>
