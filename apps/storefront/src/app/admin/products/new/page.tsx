import Link from "next/link"
import { redirect } from "next/navigation"
import { NewProductForm } from "@/components/admin/new-product-form"
import { ApiError, listCategories } from "@/lib/api"
import type { Category } from "@/lib/api-types"
import { getAdminSettings } from "@/lib/admin/client"
import { getAdminKey } from "@/lib/admin/session"
import { translate } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/server"

export default async function NewProductPage() {
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  const locale = await getLocale()
  const t = (k: Parameters<typeof translate>[1]) => translate(locale, k)

  let currencyCode = "DZD"
  try {
    const settings = await getAdminSettings(key)
    currencyCode = settings.base_currency
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      redirect("/admin/login")
    }
  }

  const categories = await listCategories().catch(() => [] as Category[])

  return (
    <div className="stack">
      <div className="spread">
        <h1 className="page-title">{t("admin.products.createTitle")}</h1>
        <Link href="/admin/products" className="btn btn-outline btn-sm">
          {t("admin.products.back")}
        </Link>
      </div>
      <NewProductForm locale={locale} currencyCode={currencyCode} categories={categories} />
    </div>
  )
}