import Link from "next/link"
import { redirect } from "next/navigation"
import { Alert, Badge, EmptyState } from "@/components/ui"
import { ConfirmSubmit } from "@/components/admin/confirm-submit"
import { deleteListedProductAction } from "@/app/admin/actions"
import { ApiError } from "@/lib/api"
import { listAdminProducts } from "@/lib/admin/client"
import { formatDateTime } from "@/lib/admin/format"
import { PRODUCT_STATUS_LABEL } from "@/lib/admin/labels"
import { parsePage, parsePageSize } from "@/lib/admin/query"
import { getAdminKey } from "@/lib/admin/session"
import type { ProductStatus } from "@/lib/api-types"
import { translate } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/server"

type SearchParams = Record<string, string | string[] | undefined>

const STATUSES: ProductStatus[] = ["draft", "published", "archived"]

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function parseStatus(value: string | undefined): ProductStatus | undefined {
  return value && (STATUSES as string[]).includes(value) ? (value as ProductStatus) : undefined
}

export default async function AdminProductsPage({
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

  const search = first(params.search)?.trim() || undefined
  const status = parseStatus(first(params.status))
  const page = parsePage(params)
  const pageSize = parsePageSize(params)

  let result
  try {
    result = await listAdminProducts(key, { search, status, page, pageSize })
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      redirect("/admin/login")
    }
    return (
      <div className="stack">
        <h1 className="page-title">{t("admin.products.title")}</h1>
        <Alert tone="error" role="alert">
          {t("admin.products.error")}
        </Alert>
      </div>
    )
  }

  const deleted = first(params.deleted)
  const error = first(params.error)
  const errorMessage =
    error === "history"
      ? t("admin.products.deleteHistory")
      : error === "delete"
        ? t("admin.common.error")
        : null

  const query = new URLSearchParams()
  if (search) query.set("search", search)
  if (status) query.set("status", status)
  query.set("pageSize", String(pageSize))
  const linkForPage = (target: number) => {
    const next = new URLSearchParams(query)
    next.set("page", String(target))
    return `/admin/products?${next.toString()}`
  }

  // After a deletion the current page can fall past the end of the list; send
  // the operator to the last valid page instead of showing a misleading empty
  // state.
  if (result.data.length === 0 && result.total > 0 && result.page > 1) {
    const next = new URLSearchParams(query)
    next.set("page", String(Math.max(1, result.totalPages)))
    redirect(`/admin/products?${next.toString()}`)
  }

  // Preserve the active filters/page so a delete returns to the same view.
  const backParams = new URLSearchParams()
  if (search) backParams.set("search", search)
  if (status) backParams.set("status", status)
  if (page > 1) backParams.set("page", String(page))
  backParams.set("pageSize", String(pageSize))
  const back = `?${backParams.toString()}`

  const deletedFlag = first(params.deleted)
  const errorFlag = first(params.error)

  return (
    <div className="stack">
      <div className="spread">
        <h1 className="page-title">{t("admin.products.title")}</h1>
        <Link href="/admin/products/new" className="btn btn-primary btn-sm">
          {t("admin.products.new")}
        </Link>
      </div>

      {deleted || deletedFlag ? (
        <Alert tone="info" role="status">
          {t("admin.products.deleted")}
        </Alert>
      ) : null}
      {errorFlag === "history" ? (
        <Alert tone="error" role="alert">
          {t("admin.products.deleteHistory")}
        </Alert>
      ) : errorFlag ? (
        <Alert tone="error" role="alert">
          {t("admin.products.deleteError")}
        </Alert>
      ) : null}

      <form className="card card-pad order-filters" method="get" action="/admin/products">
        <div className="field-grid">
          <div className="field">
            <label className="label" htmlFor="p-search">
              {t("common.search")}
            </label>
            <input
              id="p-search"
              name="search"
              type="search"
              className="input"
              defaultValue={search ?? ""}
              placeholder={t("admin.products.searchPlaceholder")}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="p-status">
              {t("admin.common.status")}
            </label>
            <select id="p-status" name="status" className="select" defaultValue={status ?? ""}>
              <option value="">{t("common.all")}</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(PRODUCT_STATUS_LABEL[value])}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row">
          <button type="submit" className="btn btn-primary btn-sm">
            {t("admin.common.apply")}
          </button>
          {search || status ? (
            <Link href="/admin/products" className="btn btn-outline btn-sm">
              {t("admin.common.reset")}
            </Link>
          ) : null}
        </div>
      </form>

      {result.data.length === 0 ? (
        <EmptyState title={t("admin.products.empty")} />
      ) : (
        <>
          <p className="muted text-sm">{t("admin.products.results", { count: result.total })}</p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("admin.products.name")}</th>
                  <th>{t("admin.common.status")}</th>
                  <th>{t("admin.products.variants")}</th>
                  <th>{t("admin.products.images")}</th>
                  <th>{t("admin.products.updated")}</th>
                  <th>{t("admin.common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div>{product.title}</div>
                      <div className="muted text-sm" dir="ltr">
                        {product.handle}
                      </div>
                    </td>
                    <td>
                      <Badge tone={product.status === "published" ? "success" : "default"}>
                        {t(PRODUCT_STATUS_LABEL[product.status])}
                      </Badge>
                    </td>
                    <td className="nowrap">{product.variants.length}</td>
                    <td className="nowrap">{product.images.length}</td>
                    <td className="nowrap muted text-sm">
                      {formatDateTime(product.updated_at, locale)}
                    </td>
                    <td>
                      <div className="row">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="btn btn-outline btn-sm"
                        >
                          {t("admin.common.edit")}
                        </Link>
                        <form action={deleteListedProductAction} className="inline-form">
                          <input type="hidden" name="id" value={product.id} />
                          <input type="hidden" name="back" value={back} />
                          <ConfirmSubmit
                            message={t("admin.products.deleteConfirmNamed", { name: product.title })}
                            className="btn btn-outline btn-sm btn-danger"
                          >
                            {t("admin.common.delete")}
                          </ConfirmSubmit>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="spread">
            <span className="muted text-sm">
              {t("admin.common.page", { page: result.page, total: result.totalPages })}
            </span>
            <div className="row">
              {result.page > 1 ? (
                <Link href={linkForPage(result.page - 1)} className="btn btn-outline btn-sm">
                  {t("admin.common.prev")}
                </Link>
              ) : null}
              {result.page < result.totalPages ? (
                <Link href={linkForPage(result.page + 1)} className="btn btn-outline btn-sm">
                  {t("admin.common.next")}
                </Link>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
