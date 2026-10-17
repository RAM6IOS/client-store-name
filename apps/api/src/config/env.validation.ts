import { z } from "zod"

/**
 * Runtime environment schema. The API refuses to start when required
 * variables are missing or malformed, so misconfiguration fails fast at boot
 * instead of at first request.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  DATABASE_URL: z
    .string({ error: "DATABASE_URL is required" })
    .min(1, "DATABASE_URL is required")
    .refine(
      (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
      "DATABASE_URL must be a postgres:// or postgresql:// connection string",
    ),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  /**
   * Shared key required by administrative mutation endpoints in Phase 2
   * (replaced by JWT + RBAC in Phase 3, ADR-0007). Optional at boot so the API
   * starts without it; when unset, `AdminApiKeyGuard` fails closed and rejects
   * every protected request.
   */
  ADMIN_API_KEY: z.string().min(1).optional(),
  /**
   * Shipping provider integration (Phase 4). All optional: with no provider
   * configured the API serves locations/pricing and returns an empty stop-desk
   * list instead of calling a carrier. Credentials are server-side only and are
   * never exposed through the API, logs or public responses.
   */
  SHIPPING_PROVIDER: z.string().min(1).optional(),
  SHIPPING_PROVIDER_API_KEY: z.string().min(1).optional(),
  SHIPPING_PROVIDER_BASE_URL: z.string().url().optional(),
  SHIPPING_PROVIDER_ACCOUNT_ID: z.string().min(1).optional(),
  /** Lifetime of a server-generated delivery quote, in seconds. */
  DELIVERY_QUOTE_TTL_SECONDS: z.coerce.number().int().positive().max(86_400).default(900),
  /**
   * Durable storage root for uploaded media (product images). Files are
   * validated for their actual content, written here (never a temp dir) and
   * served back from disk, so uploads survive restarts. Defaults to
   * `<cwd>/.bita-media` when unset.
   */
  MEDIA_DIR: z.string().min(1).optional(),
})

export type Env = z.infer<typeof envSchema>

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const parsed = envSchema.safeParse(config)

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ")
    throw new Error(`Invalid environment configuration -> ${issues}`)
  }

  return { ...config, ...parsed.data }
}
