import Link from "next/link"
import { redirect } from "next/navigation"
import { Alert, Badge, EmptyState, Price } from "@/components/ui"
import { CopyButton } from "@/components/admin/copy-button"
import {
  OrderStatusMenu,
  type StatusMenuOption,
} from "@/components/admin/order-status-menu"
import { ApiError } from "@/lib/api"
import type { OrderStatus } from "@/lib/api-types"
import { listAdminOrders } from "@/lib/admin/client"
import {
  COLLECTION_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  SHIPMENT_STATUS_LABEL,
} from "@/lib/admin/labels"
import { formatDateTime, toneForStatus } from "@/lib/admin/format"
import {
  ORDER_STATUS_TARGETS,
  requiresStatusConfirmation,
} from "@/lib/admin/order-status"
import {
  COLLECTION_STATUSES,
  ORDER_STATUSES,
  SHIPMENT_STATUSES,
  orderFilterQuery,
  parseOrderFilters,
  parseOrderSort,
  parsePage,
  parsePageSize,
} from "@/lib/admin/query"
import { getAdminKey } from "@/lib/admin/session"
import { translate } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/server"

type SearchParams = Record<string, string | string[] | undefined>

export default async function AdminOrdersPage({
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

  const filters = parseOrderFilters(params)
  const { sort, order } = parseOrderSort(params)
  const page = parsePage(params)
  const pageSize = parsePageSize(params)

  let result
  try {
    result = await listAdminOrders(key, { ...filters, sort, order, page, pageSize })
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      redirect("/admin/login")
    }
    return (
      <div className="stack">
        <h1 className="page-title">{t("admin.orders.title")}</h1>
        <Alert tone="error" role="alert">
          {t("admin.orders.error")}
        </Alert>
      </div>
    )
  }

  const filterQuery = orderFilterQuery(filters)
  const baseQuery = [filterQuery, `sort=${sort}`, `order=${order}`, `pageSize=${pageSize}`]
    .filter(Boolean)
    .join("&")
  const linkForPage = (target: number) => `/admin/orders?${baseQuery}&page=${target}`
  const exportHref = `/admin/orders/export?${[filterQuery, `sort=${sort}`, `order=${order}`].filter(Boolean).join("&")}`
  const hasFilters = Boolean(filterQuery)
  const errorParam = typeof params.error === "string" ? params.error : undefined

  const statusOptions = (status: OrderStatus): StatusMenuOption[] =>
    ORDER_STATUS_TARGETS[status].map((target) => ({
      value: target,
      label: t(ORDER_STATUS_LABEL[target]),
      tone: toneForStatus(target),
      confirmMessage: requiresStatusConfirmation(target)
        ? t("admin.orders.confirmStatus", { status: t(ORDER_STATUS_LABEL[target]) })
        : undefined,
    }))

  const quickTabs: Array<{ status?: OrderStatus; label: string }> = [
    { label: t("common.all") },
    { status: "pending_confirmation", label: t(ORDER_STATUS_LABEL.pending_confirmation) },
    { status: "confirmed", label: t(ORDER_STATUS_LABEL.confirmed) },
    { status: "shipped", label: t(ORDER_STATUS_LABEL.shipped) },
    { status: "returned", label: t(ORDER_STATUS_LABEL.returned) },
  ]
  const tabHref = (status?: OrderStatus) => {
    const q = orderFilterQuery({ ...filters, status })
    const qs = [q, `sort=${sort}`, `order=${order}`, `pageSize=${pageSize}`]
      .filter(Boolean)
      .join("&")
    return qs ? `/admin/orders?${qs}` : "/admin/orders"
  }

  return (
    <div className="stack">
      <div className="spread">
        <h1 className="page-title">{t("admin.orders.title")}</h1>
        <div className="row">
          <Link href={exportHref} className="btn btn-outline btn-sm" prefetch={false}>
            {t("admin.orders.export")}
          </Link>
        </div>
      </div>

      {errorParam ? (
        <Alert tone="error" role="alert">
          {errorParam === "invalidTransition"
            ? t("admin.action.invalidTransition")
            : t("admin.action.error")}
        </Alert>
      ) : null}

      <nav className="tabs" aria-label={t("admin.orders.status")}>
        {quickTabs.map((tab) => {
          const active = filters.status === tab.status
          return (
            <Link
              key={tab.status ?? "all"}
              href={tabHref(tab.status)}
              className={`tab${active ? " tab-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      <form className="card card-pad order-filters stack" method="get" action="/admin/orders">
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="order" value={order} />
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="label" htmlFor="f-search">
            {t("admin.orders.search")}
          </label>
          <input
            id="f-search"
            name="search"
            type="search"
            className="input"
            defaultValue={filters.search ?? ""}
            placeholder={t("admin.orders.searchPlaceholder")}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label" htmlFor="f-status">
              {t("admin.orders.status")}
            </label>
            <select
              id="f-status"
              name="status"
              className="select"
              defaultValue={filters.status ?? ""}
            >
              <option value="">{t("common.all")}</option>
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(ORDER_STATUS_LABEL[status])}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label" htmlFor="f-shipment">
              {t("admin.orders.shipment")}
            </label>
            <select
              id="f-shipment"
              name="shipment_status"
              className="select"
              defaultValue={filters.shipment_status ?? ""}
            >
              <option value="">{t("common.all")}</option>
              {SHIPMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(SHIPMENT_STATUS_LABEL[status])}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label" htmlFor="f-collection">
              {t("admin.orders.collection")}
            </label>
            <select
              id="f-collection"
              name="collection_status"
              className="select"
              defaultValue={filters.collection_status ?? ""}
            >
              <option value="">{t("common.all")}</option>
              {COLLECTION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(COLLECTION_STATUS_LABEL[status])}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label" htmlFor="f-wilaya">
              {t("admin.orders.wilaya")}
            </label>
            <input
              id="f-wilaya"
              name="wilaya_code"
              className="input"
              inputMode="numeric"
              maxLength={2}
              defaultValue={filters.wilaya_code ?? ""}
            />
          </div>
        </div>
        <div className="spread wrap" style={{ gap: "1rem", alignItems: "flex-end" }}>
          <div className="row wrap" style={{ gap: "1rem", flex: "1 1 auto" }}>
            <div className="field" style={{ marginBottom: 0, minWidth: "160px", flex: "1 1 160px" }}>
              <label className="label" htmlFor="f-from">
                {t("admin.orders.from")}
              </label>
              <input
                id="f-from"
                name="from"
                type="date"
                className="input"
                defaultValue={filters.from ?? ""}
              />
            </div>
            <div className="field" style={{ marginBottom: 0, minWidth: "160px", flex: "1 1 160px" }}>
              <label className="label" htmlFor="f-to">
                {t("admin.orders.to")}
              </label>
              <input
                id="f-to"
                name="to"
                type="date"
                className="input"
                defaultValue={filters.to ?? ""}
              />
            </div>
          </div>
          <div className="row" style={{ gap: "0.5rem" }}>
            <button type="submit" className="btn btn-primary btn-sm">
              {t("admin.orders.apply")}
            </button>
            {hasFilters ? (
              <Link href="/admin/orders" className="btn btn-outline btn-sm">
                {t("admin.orders.reset")}
              </Link>
            ) : null}
          </div>
        </div>
      </form>

      {result.data.length === 0 ? (
        <EmptyState title={t("admin.orders.empty")} />
      ) : (
        <>
          <p className="muted text-sm">{t("admin.orders.results", { count: result.total })}</p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("admin.orders.reference")}</th>
                  <th>{t("admin.orders.created")}</th>
                  <th>{t("admin.orders.customer")}</th>
                  <th>{t("admin.orders.destination")}</th>
                  <th>{t("admin.orders.total")}</th>
                  <th>{t("admin.orders.status")}</th>
                  <th>{t("admin.orders.confirmation")}</th>
                  <th>{t("admin.orders.delivery")}</th>
                  <th>{t("admin.orders.tracking")}</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {result.data.map((orderItem) => (
                  <tr key={orderItem.id}>
                    <td className="nowrap">#{orderItem.display_id}</td>
                    <td className="nowrap muted text-sm">
                      {formatDateTime(orderItem.created_at, locale)}
                    </td>
                    <td>
                      <div>{orderItem.customer_name}</div>
                      <div className="row-tight">
                        <a
                          className="muted text-sm"
                          dir="ltr"
                          href={`tel:${orderItem.customer_phone}`}
                        >
                          {orderItem.customer_phone}
                        </a>
                        <CopyButton
                          value={orderItem.customer_phone}
                          label={t("admin.orders.copyPhone")}
                          copiedLabel={t("admin.orders.copied")}
                        />
                      </div>
                    </td>
                    <td>
                      <div>{orderItem.wilaya_name}</div>
                      <div className="muted text-sm">{orderItem.commune}</div>
                    </td>
                    <td className="nowrap">
                      <Price
                        amount={orderItem.total_amount}
                        currency={orderItem.currency_code}
                        locale={locale}
                      />
                    </td>
                    <td>
                      <OrderStatusMenu
                        orderId={orderItem.id}
                        currentLabel={t(ORDER_STATUS_LABEL[orderItem.status])}
                        currentTone={toneForStatus(orderItem.status)}
                        options={statusOptions(orderItem.status)}
                        back={`?${baseQuery}&page=${result.page}`}
                        menuLabel={t("admin.orders.changeStatus")}
                      />
                    </td>
                    <td className="text-sm">
                      {orderItem.confirmed_at ? (
                        <>
                          <Badge tone="success">{t("order.status.confirmed")}</Badge>
                          <div className="muted">
                            {formatDateTime(orderItem.confirmed_at, locale)}
                          </div>
                          {orderItem.confirmed_by ? (
                            <div className="muted">
                              {t("admin.orders.confirmedBy", { actor: orderItem.confirmed_by })}
                            </div>
                          ) : null}
                        </>
                      ) : orderItem.status === "pending_confirmation" ? (
                        <Badge tone="warning">{t("order.status.pending_confirmation")}</Badge>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="text-sm">
                      <div>{orderItem.delivery_label ?? orderItem.delivery_method}</div>
                      {orderItem.delivery_provider ? (
                        <div className="muted">{orderItem.delivery_provider}</div>
                      ) : null}
                    </td>
                    <td className="text-sm">
                      {orderItem.tracking_token ? (
                        <a
                          href={`/order-success/${orderItem.tracking_token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="muted"
                        >
                          {t("admin.orders.track")}
                        </a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/admin/orders/${orderItem.id}?back=${encodeURIComponent(`?${baseQuery}&page=${result.page}`)}`}
                        className="btn btn-outline btn-sm"
                      >
                        {t("admin.orders.view")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="spread">
            <span className="muted text-sm">
              {t("admin.orders.page", { page: result.page, total: result.totalPages })}
            </span>
            <div className="row">
              {result.page > 1 ? (
                <Link href={linkForPage(result.page - 1)} className="btn btn-outline btn-sm">
                  {t("admin.orders.prev")}
                </Link>
              ) : null}
              {result.page < result.totalPages ? (
                <Link href={linkForPage(result.page + 1)} className="btn btn-outline btn-sm">
                  {t("admin.orders.next")}
                </Link>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
