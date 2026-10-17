import Link from "next/link"
import { redirect } from "next/navigation"
import { Alert, EmptyState, Price } from "@/components/ui"
import { ApiError } from "@/lib/api"
import { listAdminCustomers } from "@/lib/admin/client"
import { formatDateTime } from "@/lib/admin/format"
import { parsePage, parsePageSize } from "@/lib/admin/query"
import { getAdminKey } from "@/lib/admin/session"
import { formatInteger } from "@/lib/money"
import { translate } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/server"

type SearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function AdminCustomersPage({
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
  const page = parsePage(params)
  const pageSize = parsePageSize(params)

  let result
  try {
    result = await listAdminCustomers(key, { search, page, pageSize })
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      redirect("/admin/login")
    }
    return (
      <div className="stack">
        <h1 className="page-title">{t("admin.customers.title")}</h1>
        <Alert tone="error" role="alert">
          {t("admin.customers.error")}
        </Alert>
      </div>
    )
  }

  const query = new URLSearchParams()
  if (search) query.set("search", search)
  query.set("pageSize", String(pageSize))
  const linkForPage = (target: number) => {
    const next = new URLSearchParams(query)
    next.set("page", String(target))
    return `/admin/customers?${next.toString()}`
  }

  return (
    <div className="stack">
      <h1 className="page-title">{t("admin.customers.title")}</h1>

      <form className="card card-pad order-filters" method="get" action="/admin/customers">
        <div className="field-grid">
          <div className="field">
            <label className="label" htmlFor="c-search">
              {t("common.search")}
            </label>
            <input
              id="c-search"
              name="search"
              type="search"
              className="input"
              defaultValue={search ?? ""}
              placeholder={t("admin.customers.searchPlaceholder")}
            />
          </div>
        </div>
        <div className="row">
          <button type="submit" className="btn btn-primary btn-sm">
            {t("admin.common.apply")}
          </button>
          {search ? (
            <Link href="/admin/customers" className="btn btn-outline btn-sm">
              {t("admin.common.reset")}
            </Link>
          ) : null}
        </div>
      </form>

      {result.data.length === 0 ? (
        <EmptyState title={t("admin.customers.empty")} />
      ) : (
        <>
          <p className="muted text-sm">{t("admin.customers.results", { count: result.total })}</p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("admin.customers.name")}</th>
                  <th>{t("admin.customers.orders")}</th>
                  <th>{t("admin.customers.delivered")}</th>
                  <th>{t("admin.customers.cancelled")}</th>
                  <th>{t("admin.customers.returned")}</th>
                  <th>{t("admin.customers.totalSpent")}</th>
                  <th>{t("admin.customers.lastOrder")}</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {result.data.map((customer) => (
                  <tr key={customer.phone}>
                    <td>
                      <div>{customer.name}</div>
                      <div className="muted text-sm" dir="ltr">
                        {customer.phone}
                      </div>
                    </td>
                    <td className="nowrap">{formatInteger(customer.orders_count, locale)}</td>
                    <td className="nowrap">{formatInteger(customer.delivered_count, locale)}</td>
                    <td className="nowrap">{formatInteger(customer.cancelled_count, locale)}</td>
                    <td className="nowrap">{formatInteger(customer.returned_count, locale)}</td>
                    <td className="nowrap">
                      <Price
                        amount={customer.total_spent}
                        currency={result.currency_code}
                        locale={locale}
                      />
                    </td>
                    <td className="nowrap muted text-sm">
                      {formatDateTime(customer.last_order_at, locale)}
                    </td>
                    <td>
                      <Link
                        href={`/admin/customers/${encodeURIComponent(customer.phone)}`}
                        className="btn btn-outline btn-sm"
                      >
                        {t("admin.common.view")}
                      </Link>
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
