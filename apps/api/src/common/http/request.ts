/**
 * Minimal structural type for the underlying HTTP request. Avoids a hard
 * dependency on `@types/express` while covering what filters and guards need.
 */
export interface HttpRequestLike {
  method?: string
  url?: string
  header(name: string): string | undefined
}

/** Minimal structural type for the underlying HTTP response. */
export interface HttpResponseLike {
  status(code: number): { json(body: unknown): void }
}
