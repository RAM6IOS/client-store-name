/**
 * Admin session constants. Kept free of any server-only imports so the edge
 * middleware can read the cookie name without pulling in `next/headers`.
 */
export const ADMIN_COOKIE = "bita_admin_key"

/** Header the API expects for administrative requests (`AdminApiKeyGuard`). */
export const ADMIN_API_KEY_HEADER = "x-admin-api-key"

/** Working session length: one operator shift. */
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12
