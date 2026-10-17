import Link from "next/link"
import { redirect } from "next/navigation"
import { Alert } from "@/components/ui"
import { DeliveryImportForm, DeliveryRatesForm } from "@/components/admin/delivery-settings"
import { ApiError } from "@/lib/api"
import { getAdminSettings, listAdminDeliveryRates, listWilayas } from "@/lib/admin/client"
import { initialRateValues } from "@/lib/admin/delivery-rates"
import { getAdminKey } from "@/lib/admin/session"
import type { Wilaya } from "@/lib/api-types"
import type { DeliveryRate } from "@/lib/admin/types"
import { translate } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/server"
import type { Locale } from "@/lib/i18n/locales"

type SearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function wilayaName(wilaya: Wilaya, locale: Locale): string {
  return locale === "fr" ? wilaya.name_fr : wilaya.name_ar
}

export default async function DeliverySettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  const locale = await getLocale()
  const t = (k: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, k, vars)

  let wilayas: Wilaya[]
  let rates: DeliveryRate[]
  let currencyCode = "DZD"
  try {
    const [wilayaList, rateList, settings] = await Promise.all([
      listWilayas(),
      listAdminDeliveryRates(key),
      getAdminSettings(key),
    ])
    wilayas = wilayaList
    rates = rateList.data
    currencyCode = settings.base_currency
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      redirect("/admin/login")
    }
    return (
      <div className="stack">
        <h1 className="page-title">{t("admin.delivery.title")}</h1>
        <Alert tone="error" role="alert">
          {t("admin.delivery.error")}
        </Alert>
      </div>
    )
  }

  const q = first(params.q)?.trim().toLowerCase() ?? ""
  const visible = q
    ? wilayas.filter(
        (wilaya) =>
          wilaya.code.includes(q) ||
          wilaya.name_fr.toLowerCase().includes(q) ||
          wilaya.name_ar.includes(q),
      )
    : wilayas

  const saved = first(params.saved)
  const imported = first(params.imported)
  const error = first(params.error)

  return (
    <div className="stack">
      <div className="spread">
        <div>
          <h1 className="page-title">{t("admin.delivery.title")}</h1>
          <p className="muted">{t("admin.delivery.subtitle")}</p>
        </div>
        <Link
          href="/admin/settings/delivery/export"
          className="btn btn-outline btn-sm"
          prefetch={false}
        >
          {t("admin.delivery.export")}
        </Link>
      </div>

      <p className="muted text-sm">{t("admin.delivery.baseCurrency", { currency: currencyCode })}</p>

      {error ? (
        <Alert tone="error" role="alert">
          {t("admin.delivery.error")}
        </Alert>
      ) : null}
      {saved ? (
        <Alert tone="info" role="status">
          {t("admin.delivery.saved")}
        </Alert>
      ) : null}
      {imported ? (
        <Alert tone="info" role="status">
          {t("admin.delivery.imported", { count: imported })}
        </Alert>
      ) : null}

      <form className="card card-pad order-filters" method="get" action="/admin/settings/delivery">
        <div className="field">
          <label className="label" htmlFor="d-search">
            {t("common.search")}
          </label>
          <input
            id="d-search"
            name="q"
            type="search"
            className="input"
            defaultValue={q}
            placeholder={t("admin.delivery.searchPlaceholder")}
          />
        </div>
        <div className="row">
          <button type="submit" className="btn btn-primary btn-sm">
            {t("admin.common.apply")}
          </button>
          {q ? (
            <Link href="/admin/settings/delivery" className="btn btn-outline btn-sm">
              {t("admin.common.reset")}
            </Link>
          ) : null}
        </div>
      </form>

      <p className="muted text-sm">{t("admin.delivery.results", { count: visible.length })}</p>

      <DeliveryRatesForm
        wilayas={visible.map((wilaya) => ({ code: wilaya.code, name: wilayaName(wilaya, locale) }))}
        initial={initialRateValues(rates)}
        currencyCode={currencyCode}
        locale={locale}
      />

      <DeliveryImportForm currencyCode={currencyCode} locale={locale} />
    </div>
  )
}