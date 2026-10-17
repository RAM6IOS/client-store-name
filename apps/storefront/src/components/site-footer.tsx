import Link from "next/link"
import { storeBranding } from "@/config/store"
import { translate } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/locales"

export function SiteFooter({ locale }: { locale: Locale }) {
  const { support, tagline } = storeBranding
  const hasContact = Boolean(support.phone || support.email || support.address)

  const links = [
    { href: "/", label: translate(locale, "nav.home") },
    { href: "/products", label: translate(locale, "nav.products") },
    { href: "/#categories", label: translate(locale, "nav.categories") },
    { href: "/products", label: translate(locale, "nav.offers") },
  ]

  return (
    <footer className="site-footer" id="footer-contact">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col footer-col-brand">
            <Link href="/" className="brand">
              {storeBranding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={storeBranding.logoUrl} alt="" />
              ) : null}
              <span>{storeBranding.name}</span>
            </Link>
            {tagline ? <p className="footer-text">{tagline}</p> : null}
            <ul className="footer-badges">
              <li className="badge badge-success">{translate(locale, "footer.paymentNote")}</li>
              <li className="badge badge-info">{translate(locale, "home.benefits.shipping")}</li>
            </ul>
          </div>

          <nav className="footer-col" aria-labelledby="footer-nav-title">
            <h2 id="footer-nav-title" className="footer-title">
              {translate(locale, "nav.menu")}
            </h2>
            <ul className="footer-links">
              {links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          {hasContact ? (
            <div className="footer-col">
              <h2 className="footer-title">{translate(locale, "footer.contact")}</h2>
              <ul className="footer-links">
                {support.phone ? (
                  <li>
                    <span className="muted">{translate(locale, "footer.phone")}: </span>
                    <a href={`tel:${support.phone}`} dir="ltr">
                      {support.phone}
                    </a>
                  </li>
                ) : null}
                {support.email ? (
                  <li>
                    <span className="muted">{translate(locale, "footer.email")}: </span>
                    <a href={`mailto:${support.email}`}>{support.email}</a>
                  </li>
                ) : null}
                {support.address ? (
                  <li>
                    <span className="muted">{translate(locale, "footer.address")}: </span>
                    {support.address}
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} {storeBranding.name}. {translate(locale, "footer.rights")}
          </p>
        </div>
      </div>
    </footer>
  )
}
