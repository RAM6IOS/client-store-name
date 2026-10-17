import { NextResponse, type NextRequest } from "next/server"
import { ADMIN_COOKIE } from "@/lib/admin/constants"
import {
  isLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_QUERY_PARAM,
} from "@/lib/i18n/locales"

/**
 * Two concerns, applied in order:
 *
 * 1. Admin gate — any `/admin` route except the login screen requires the
 *    session cookie. This is a cheap *redirect* for the browser; the API still
 *    enforces `AdminApiKeyGuard` on every admin request, so the cookie is a UX
 *    affordance, not the security boundary.
 * 2. Locale persistence — the storefront switches language via `?lang=ar|fr`
 *    (docs/decisions/0013-storefront-i18n.md); the middleware records the choice
 *    in a cookie and redirects to the same URL so the page re-renders
 *    server-side in the requested language.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/")
  const isAdminLogin = pathname === "/admin/login"

  if (isAdminRoute && !isAdminLogin && !request.cookies.get(ADMIN_COOKIE)?.value) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/admin/login"
    loginUrl.search = ""
    return NextResponse.redirect(loginUrl)
  }

  const requested = request.nextUrl.searchParams.get(LOCALE_QUERY_PARAM)
  if (!isLocale(requested)) {
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()
  url.searchParams.delete(LOCALE_QUERY_PARAM)

  const response = NextResponse.redirect(url)
  response.cookies.set(LOCALE_COOKIE, requested, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
  })
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
