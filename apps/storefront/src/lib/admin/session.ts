import { cookies } from "next/headers"
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE } from "./constants"

/**
 * The admin API key is held in an httpOnly cookie and only ever read on the
 * server. It is never placed in `NEXT_PUBLIC_*`, never rendered into HTML and
 * never sent to the browser as JavaScript (Phase 6 security requirement).
 *
 * The cookie is scoped to `/admin`. The key itself is verified against the API
 * before the cookie is set, so a forged cookie simply yields 401s downstream.
 * This is a stop-gap until real operator accounts (JWT + RBAC) exist; see
 * docs/decisions/0007-admin-authentication.md and the Phase 6 gap report.
 */
export async function getAdminKey(): Promise<string | null> {
  const store = await cookies()
  const value = store.get(ADMIN_COOKIE)?.value
  return value && value.length > 0 ? value : null
}

export async function setAdminKey(key: string): Promise<void> {
  const store = await cookies()
  store.set(ADMIN_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  })
}

export async function clearAdminKey(): Promise<void> {
  const store = await cookies()
  store.delete(ADMIN_COOKIE)
}
