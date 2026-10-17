import { z } from "zod"

export const listCommunesQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
})

export const searchCommunesQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  wilaya_code: z.string().trim().length(2).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
})

export type ListCommunesQuery = z.infer<typeof listCommunesQuerySchema>
export type SearchCommunesQuery = z.infer<typeof searchCommunesQuerySchema>
