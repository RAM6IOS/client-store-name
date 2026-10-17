import Link from "next/link"
import { Suspense } from "react"
import { storeBranding } from "@/config/store"
import { translate } from "@/lib/i18n"
import { type Locale } from "@/lib/i18n/locales"
import { CartButton } from "./cart-button"
import { LocaleSwitcher } from "./locale-switcher"

export function SiteHeader({ locale }: { locale: Locale }) {
  const navItems = [
    { href: "/", label: translate(locale, "nav.home") },
    { href: "/products", label: translate(locale, "nav.products") },
    { href: "/#categories", label: translate(locale, "nav.categories") },
    { href: "/products", label: translate(locale, "nav.offers") },
  ]

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <a href="#main" className="skip-link">
          {translate(locale, "a11y.skipToContent")}
        </a>

        <div className="header-top">
          <Link href="/" className="brand">
            {storeBranding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={storeBranding.logoUrl} alt="" />
            ) : null}
            <span>{storeBranding.name}</span>
          </Link>

          <form action="/products" method="get" className="header-search-form" role="search">
            <input
              type="search"
              name="q"
              placeholder={translate(locale, "common.searchPlaceholder")}
              aria-label={translate(locale, "common.search")}
              className="input header-search-input"
            />
            <button
              type="submit"
              className="header-search-btn"
              aria-label={translate(locale, "common.search")}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </form>

          <div className="header-actions">
            <Suspense fallback={<span className="locale-switch" aria-hidden="true" />}>
              <LocaleSwitcher locale={locale} />
            </Suspense>
            <CartButton />
          </div>
        </div>

        <nav className="site-nav" aria-label={translate(locale, "nav.menu")}>
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} className="site-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
