import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { getLocale } from "@/lib/i18n/server"

/** Customer-facing storefront chrome (header, main container, footer). */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  return (
    <>
      <SiteHeader locale={locale} />
      <main id="main" className="container">
        {children}
      </main>
      <SiteFooter locale={locale} />
    </>
  )
}
