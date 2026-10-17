import { translate } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/server"
import { CtaLink } from "@/components/ui"

export default async function NotFound() {
  const locale = await getLocale()
  return (
    <main className="container">
      <div className="page text-center">
        <h1>{translate(locale, "notFound.title")}</h1>
        <p className="muted">{translate(locale, "notFound.body")}</p>
        <CtaLink href="/">{translate(locale, "notFound.cta")}</CtaLink>
      </div>
    </main>
  )
}
