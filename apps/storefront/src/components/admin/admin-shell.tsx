"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Suspense, type ReactNode } from "react"
import { logoutAction } from "@/app/admin/actions"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { createTranslator } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/locales"
import type { TranslationKey } from "@/lib/i18n/dictionaries"

interface NavItem {
  href: string
  label: TranslationKey
}

const NAV: NavItem[] = [
  { href: "/admin", label: "admin.nav.overview" },
  { href: "/admin/orders", label: "admin.nav.orders" },
  { href: "/admin/products", label: "admin.nav.products" },
  { href: "/admin/customers", label: "admin.nav.customers" },
  { href: "/admin/settings/delivery", label: "admin.nav.delivery" },
]

/** True when `pathname` is inside `href` (with `/admin` only matching exactly). */
function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin"
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Chrome for the operations admin. Renders bare on the login screen and the
 * printable slip (no nav/logout), and the full header+main otherwise.
 */
export function AdminShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const pathname = usePathname()
  const t = createTranslator(locale)
  const bare = pathname === "/admin/login" || pathname.endsWith("/print")

  if (bare) return <>{children}</>

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="container admin-header-inner">
          <Link href="/admin" className="admin-brand">
            {t("admin.title")}
          </Link>
          <nav className="admin-nav" aria-label={t("admin.title")}>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
              >
                {t(item.label)}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <Suspense fallback={<span className="locale-switch" aria-hidden="true" />}>
              <LocaleSwitcher locale={locale} />
            </Suspense>
            <form action={logoutAction}>
              <button type="submit" className="btn btn-outline btn-sm">
                {t("admin.logout")}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="container admin-main">
        {children}
      </main>
    </div>
  )
}
