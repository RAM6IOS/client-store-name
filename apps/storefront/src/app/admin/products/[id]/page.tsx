import Link from "next/link"
import { redirect } from "next/navigation"
import { Alert, Badge } from "@/components/ui"
import { ProductDetailClient } from "@/components/admin/product-detail"
import { ApiError, listCategories } from "@/lib/api"
import type { Category } from "@/lib/api-types"
import { getAdminProduct, getAdminSettings } from "@/lib/admin/client"
import { PRODUCT_STATUS_LABEL } from "@/lib/admin/labels"
import { getAdminKey } from "@/lib/admin/session"
import { translate } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/server"

type SearchParams = Record<string, string | string[] | undefined>

function flag(params: SearchParams, name: string): string | undefined {
  const value = params[name]
  return Array.isArray(value) ? value[0] : value
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<SearchParams>
}) {
  const { id } = await params
  const query = await searchParams
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  const locale = await getLocale()
  const t = (k: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, k, vars)

  let product
  try {
    product = await getAdminProduct(key, id)
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      redirect("/admin/login")
    }
    if (error instanceof ApiError && error.status === 404) {
      redirect("/admin/products")
    }
    return (
      <div className="stack">
        <h1 className="page-title">{t("admin.products.editTitle")}</h1>
        <Alert tone="error" role="alert">
          {t("admin.products.error")}
        </Alert>
      </div>
    )
  }

  let currencyCode = "DZD"
  try {
    const settings = await getAdminSettings(key)
    currencyCode = settings.base_currency
  } catch {
    // Non-fatal: fall back to DZD for the currency labels.
  }

  const categories = await listCategories().catch(() => [] as Category[])

  const created = flag(query, "created")
  const saved = flag(query, "saved")
  const updated = flag(query, "updated")
  const error = flag(query, "error")
  const errorMessage =
    error === "history"
      ? t("admin.products.deleteHistory")
      : error === "image"
        ? t("admin.products.image.errors.upload")
        : error === "delete"
          ? t("admin.common.error")
          : error
            ? t("admin.products.errors.save")
            : null

  return (
    <div className="stack">
      <div className="spread">
        <div>
          <h1 className="page-title">{t("admin.products.editTitle")}</h1>
          <p className="muted" dir="ltr">
            {product.handle}
          </p>
        </div>
        <div className="row">
          <Badge tone={product.status === "published" ? "success" : "default"}>
            {t(PRODUCT_STATUS_LABEL[product.status])}
          </Badge>
          <Link href="/admin/products" className="btn btn-outline btn-sm">
            {t("admin.products.back")}
          </Link>
        </div>
      </div>

      {errorMessage ? (
        <Alert tone="error" role="alert">
          {errorMessage}
        </Alert>
      ) : null}
      {saved ? (
        <Alert tone="info" role="status">
          {t("admin.products.saved")}
        </Alert>
      ) : null}
      {created ? (
        <Alert tone="info" role="status">
          {t("admin.products.created")}
        </Alert>
      ) : null}
      {updated ? (
        <Alert tone="info" role="status">
          {t("admin.common.saved")}
        </Alert>
      ) : null}

      <ProductDetailClient
        product={product}
        currencyCode={currencyCode}
        locale={locale}
        categories={categories}
      />
    </div>
  )
}