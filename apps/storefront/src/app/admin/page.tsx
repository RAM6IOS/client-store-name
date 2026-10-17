import Link from "next/link"
import { redirect } from "next/navigation"
import { Alert, Badge, EmptyState, Price } from "@/components/ui"
import { ApiError } from "@/lib/api"
import { getAdminDashboard } from "@/lib/admin/client"
import { formatDateTime, toneForStatus } from "@/lib/admin/format"
import { ORDER_STATUS_LABEL } from "@/lib/admin/labels"
import { getAdminKey } from "@/lib/admin/session"
import { formatInteger } from "@/lib/money"
import { translate } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/server"

export default async function AdminOverviewPage() {
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  const locale = await getLocale()
  const t = (k: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, k, vars)

  let data
  try {
    data = await getAdminDashboard(key)
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      redirect("/admin/login")
    }
    return (
      <div className="stack">
        <h1 className="page-title">{t("admin.overview.title")}</h1>
        <Alert tone="error" role="alert">
          {t("admin.overview.error")}
        </Alert>
      </div>
    )
  }

  const byStatus = data.orders.by_status
  const awaiting = (byStatus.confirmed ?? 0) + (byStatus.preparing ?? 0)

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">{t("admin.overview.title")}</h1>
        <p className="muted">{t("admin.overview.subtitle")}</p>
      </div>

      <div className="stat-grid">
        <div className="card card-pad stat">
          <span className="stat-label">{t("admin.overview.newOrders")}</span>
          <span className="stat-value">{formatInteger(byStatus.pending_confirmation ?? 0, locale)}</span>
        </div>
        <div className="card card-pad stat">
          <span className="stat-label">{t("admin.overview.awaiting")}</span>
          <span className="stat-value">{formatInteger(awaiting, locale)}</span>
        </div>
        <div className="card card-pad stat">
          <span className="stat-label">{t("admin.overview.inDelivery")}</span>
          <span className="stat-value">{formatInteger(byStatus.shipped ?? 0, locale)}</span>
        </div>
        <div className="card card-pad stat">
          <span className="stat-label">{t("admin.overview.delivered")}</span>
          <span className="stat-value">{formatInteger(byStatus.delivered ?? 0, locale)}</span>
        </div>
      </div>

      <div className="stat-grid">
        <div className="card card-pad stat">
          <span className="stat-label">{t("admin.overview.placedValue")}</span>
          <span className="stat-value">
            <Price amount={data.orders.placed_value} currency={data.currency_code} locale={locale} />
          </span>
          <span className="stat-hint">{t("admin.overview.placedValueHint")}</span>
        </div>
        <div className="card card-pad stat">
          <span className="stat-label">{t("admin.overview.deliveredValue")}</span>
          <span className="stat-value">
            <Price
              amount={data.orders.delivered_value}
              currency={data.currency_code}
              locale={locale}
            />
          </span>
          <span className="stat-hint">{t("admin.overview.deliveredValueHint")}</span>
        </div>
        <div className="card card-pad stat">
          <span className="stat-label">{t("admin.overview.products")}</span>
          <span className="stat-value">
            {formatInteger(data.catalog.products_total, locale)}
          </span>
          <span className="stat-hint">
            {t("admin.overview.productsHint", {
              published: formatInteger(data.catalog.products_published, locale),
              total: formatInteger(data.catalog.products_total, locale),
            })}
          </span>
        </div>
        <div className="card card-pad stat">
          <span className="stat-label">{t("admin.overview.customers")}</span>
          <span className="stat-value">{formatInteger(data.customers.total, locale)}</span>
          <span className="stat-hint">
            {t("admin.overview.customersHint", {
              returning: formatInteger(data.customers.returning, locale),
            })}
          </span>
        </div>
      </div>

      <section className="stack">
        <div className="spread">
          <h2>{t("admin.overview.recentOrders")}</h2>
          <Link href="/admin/orders" className="btn btn-outline btn-sm">
            {t("admin.overview.viewAll")}
          </Link>
        </div>
        {data.recent_orders.length === 0 ? (
          <EmptyState title={t("admin.orders.empty")} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("admin.orders.reference")}</th>
                  <th>{t("admin.orders.customer")}</th>
                  <th>{t("admin.orders.destination")}</th>
                  <th>{t("admin.common.status")}</th>
                  <th>{t("admin.orders.total")}</th>
                  <th>{t("admin.orders.created")}</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {data.recent_orders.map((order) => (
                  <tr key={order.id}>
                    <td className="nowrap">#{order.display_id}</td>
                    <td>
                      <div>{order.customer_name}</div>
                      <div className="muted text-sm" dir="ltr">
                        {order.customer_phone}
                      </div>
                    </td>
                    <td>{order.wilaya_name}</td>
                    <td>
                      <Badge tone={toneForStatus(order.status)}>
                        {t(ORDER_STATUS_LABEL[order.status])}
                      </Badge>
                    </td>
                    <td className="nowrap">
                      <Price amount={order.total_amount} currency={order.currency_code} locale={locale} />
                    </td>
                    <td className="nowrap muted text-sm">{formatDateTime(order.created_at, locale)}</td>
                    <td>
                      <Link href={`/admin/orders/${order.id}`} className="btn btn-outline btn-sm">
                        {t("admin.common.view")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="stack">
        <h2>{t("admin.overview.lowStock")}</h2>
        {data.low_stock_items.length === 0 ? (
          <EmptyState title={t("admin.overview.noLowStock")} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("admin.products.title")}</th>
                  <th>{t("admin.products.variants")}</th>
                  <th>{t("admin.overview.available")}</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {data.low_stock_items.map((item) => (
                  <tr key={item.variant_id}>
                    <td>{item.product_title}</td>
                    <td>{item.variant_title}</td>
                    <td className="nowrap">
                      <Badge tone={item.available_quantity <= 0 ? "danger" : "default"}>
                        {formatInteger(item.available_quantity, locale)}
                      </Badge>
                    </td>
                    <td>
                      <Link
                        href={`/admin/products/${item.product_id}`}
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
        )}
      </section>
    </div>
  )
}
