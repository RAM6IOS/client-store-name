import { notFound, redirect } from "next/navigation"
import { Price } from "@/components/ui"
import { ApiError } from "@/lib/api"
import { getAdminOrder } from "@/lib/admin/client"
import { formatDateTime } from "@/lib/admin/format"
import { getAdminKey } from "@/lib/admin/session"
import { storeBranding } from "@/config/store"
import { translate } from "@/lib/i18n"
import type { TranslationKey } from "@/lib/i18n/dictionaries"
import { getLocale } from "@/lib/i18n/server"

/**
 * Printer-friendly packing/delivery slip. Rendered without the admin chrome
 * (see `AdminShell`) so printing produces only the slip.
 */
export default async function AdminOrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  const { id } = await params
  const locale = await getLocale()
  const t = (k: TranslationKey) => translate(locale, k)

  let order
  try {
    order = await getAdminOrder(key, id)
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      redirect("/admin/login")
    }
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  return (
    <div className="print-page">
      <header className="print-header">
        <div>
          <h1>{storeBranding.name}</h1>
          <p className="muted">{t("admin.print.title")}</p>
        </div>
        <div className="print-ref">
          <strong>
            {t("admin.print.reference")}: #{order.display_id}
          </strong>
          <span className="muted text-sm">
            {t("admin.print.date")}: {formatDateTime(order.placed_at, locale)}
          </span>
        </div>
      </header>

      <section className="print-section">
        <h2>{t("admin.detail.customer")}</h2>
        <p>{order.customer_name}</p>
        <p dir="ltr">{order.customer_phone}</p>
      </section>

      <section className="print-section">
        <h2>{t("admin.print.destination")}</h2>
        <p>
          {order.wilaya_name} — {order.commune}
          {order.commune_code ? ` (${order.commune_code})` : ""}
        </p>
        {order.delivery_label ? <p>{order.delivery_label}</p> : null}
        {order.address_line ? <p>{order.address_line}</p> : null}
        {order.nearby_landmark ? (
          <p>
            {t("admin.detail.landmark")}: {order.nearby_landmark}
          </p>
        ) : null}
        {order.stop_desk ? (
          <p>
            {t("admin.detail.stopDesk")}: {order.stop_desk.name ?? "—"}
          </p>
        ) : null}
      </section>

      <section className="print-section">
        <h2>{t("admin.detail.items")}</h2>
        <table className="table print-table">
          <thead>
            <tr>
              <th>{t("admin.detail.items")}</th>
              <th>SKU</th>
              <th>{t("admin.detail.quantity")}</th>
              <th>{t("admin.detail.line")}</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((line) => (
              <tr key={line.id}>
                <td>
                  {line.product_title}
                  {line.variant_title ? ` — ${line.variant_title}` : ""}
                </td>
                <td dir="ltr">{line.sku ?? "—"}</td>
                <td>{line.quantity}</td>
                <td className="nowrap">
                  <Price amount={line.line_amount} currency={line.currency_code} locale={locale} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="print-section print-total">
        <span>{t("admin.detail.total")}</span>
        <strong>
          <Price amount={order.total_amount} currency={order.currency_code} locale={locale} />
        </strong>
      </section>

      <footer className="print-footer muted text-sm">{t("admin.detail.collectionNote")}</footer>
    </div>
  )
}
