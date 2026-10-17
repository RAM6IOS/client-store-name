import type { Wilaya } from "@/lib/api-types"
import { getStoreSettingsSafe, listWilayas } from "@/lib/api"
import { translate } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/server"
import { pageMetadata } from "@/lib/seo"
import { CheckoutView } from "@/components/checkout/checkout-view"
import { Alert, CtaLink } from "@/components/ui"

export async function generateMetadata() {
  const locale = await getLocale()
  return pageMetadata({
    path: "/checkout",
    title: translate(locale, "checkout.title"),
    noIndex: true,
  })
}

export default async function CheckoutPage() {
  const locale = await getLocale()

  let wilayas: Wilaya[] = []
  let failed = false
  try {
    wilayas = await listWilayas()
  } catch {
    failed = true
  }

  const settings = await getStoreSettingsSafe()

  if (failed) {
    return (
      <div className="page">
        <h1 className="page-title">{translate(locale, "checkout.title")}</h1>
        <Alert tone="error" role="alert">
          <p style={{ margin: 0 }}>{translate(locale, "checkout.settingsUnavailable")}</p>
          <CtaLink href="/checkout" variant="outline">
            {translate(locale, "common.retry")}
          </CtaLink>
        </Alert>
      </div>
    )
  }

  return <CheckoutView wilayas={wilayas} baseCurrency={settings?.base_currency ?? "DZD"} />
}
