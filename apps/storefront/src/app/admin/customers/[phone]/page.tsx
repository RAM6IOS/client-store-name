import Link from "next/link"
import { redirect } from "next/navigation"
import { Alert, Badge, EmptyState, Price } from "@/components/ui"
import { ApiError } from "@/lib/api"
import { getAdminCustomer } from "@/lib/admin/client"
import { formatDateTime, toneForStatus } from "@/lib/admin/format"
import { ORDER_STATUS_LABEL } from "@/lib/admin/labels"
import { getAdminKey } from "@/lib/admin/session"
import { formatInteger } from "@/lib/money"
import { translate } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/server"

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ phone: string }>
}) {
  const { phone: rawPhone } = await params
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  const locale = await getLocale()
  const t = (k: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, k, vars)

  let phone = rawPhone
  try {
    phone = decodeURIComponent(rawPhone)
  } catch {
    phone = rawPhone
  }

  let customer
  try {
    customer = await getAdminCustomer(key, phone)
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      redirect("/admin/login")
    }
    if (error instanceof ApiError && error.status === 404) {
      redirect("/admin/customers")
    }
    return (
      <div className="stack">
        <h1 className="page-title">{t("admin.customers.detailTitle")}</h1>
        <Alert tone="error" role="alert">
          {t("admin.customers.error")}
        </Alert>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="spread">
        <div>
          <h1 className="page-title">{customer.name}</h1>
          <p className="muted" dir="ltr">
            {customer.phone}
          </p>
        </div>
        <Link href="/admin/customers" className="btn btn-outline btn-sm">
          {t("admin.customers.back")}
        </Link>
      </div>

      <div className="stat-grid">
        <div className="card card-pad stat">
          <span className="stat-label">{t("admin.customers.orders")}</span>
          <span className="stat-value">{formatInteger(customer.orders_count, locale)}</span>
        </div>
        <div className="card card-pad stat">
          <span className="stat-label">{t("admin.customers.delivered")}</span>
          <span className="stat-value">{formatInteger(customer.delivered_count, locale)}</span>
        </div>
        <div className="card card-pad stat">
          <span className="stat-label">{t("admin.customers.cancelled")}</span>
          <span className="stat-value">{formatInteger(customer.cancelled_count, locale)}</span>
        </div>
        <div className="card card-pad stat">
          <span className="stat-label">{t("admin.customers.returned")}</span>
          <span className="stat-value">{formatInteger(customer.returned_count, locale)}</span>
        </div>
        <div className="card card-pad stat">
          <span className="stat-label">{t("admin.customers.totalSpent")}</span>
          <span className="stat-value">
            <Price amount={customer.total_spent} currency={customer.currency_code} locale={locale} />
          </span>
        </div>
      </div>

      <section className="card card-pad">
        <dl className="facts">
          <dt>{t("admin.customers.firstOrder")}</dt>
          <dd>{formatDateTime(customer.first_order_at, locale)}</dd>
          <dt>{t("admin.customers.lastOrder")}</dt>
          <dd>{formatDateTime(customer.last_order_at, locale)}</dd>
          <dt>{t("admin.customers.wilaya")}</dt>
          <dd>{customer.last_wilaya_name || t("admin.common.none")}</dd>
        </dl>
      </section>

      <section className="stack">
        <h2>{t("admin.customers.history")}</h2>
        {customer.orders.length === 0 ? (
          <EmptyState title={t("admin.customers.noHistory")} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("admin.orders.reference")}</th>
                  <th>{t("admin.orders.status")}</th>
                  <th>{t("admin.orders.destination")}</th>
                  <th>{t("admin.orders.total")}</th>
                  <th>{t("admin.orders.created")}</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {customer.orders.map((order) => (
                  <tr key={order.id}>
                    <td className="nowrap">#{order.display_id}</td>
                    <td>
                      <Badge tone={toneForStatus(order.status)}>
                        {t(ORDER_STATUS_LABEL[order.status])}
                      </Badge>
                    </td>
                    <td>
                      <div>{order.wilaya_name}</div>
                      <div className="muted text-sm">{order.commune}</div>
                    </td>
                    <td className="nowrap">
                      <Price
                        amount={order.total_amount}
                        currency={order.currency_code}
                        locale={locale}
                      />
                    </td>
                    <td className="nowrap muted text-sm">
                      {formatDateTime(order.created_at, locale)}
                    </td>
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
    </div>
  )
}
