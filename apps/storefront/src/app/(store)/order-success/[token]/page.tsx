import Link from "next/link"
import { notFound } from "next/navigation"
import type { OrderPublic, OrderStatus } from "@/lib/api-types"
import { getOrderByToken, isApiError } from "@/lib/api"
import { translate, type TranslationKey } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/server"
import { formatMoney } from "@/lib/money"
import { pageMetadata } from "@/lib/seo"
import { Alert, CtaLink } from "@/components/ui"

const STATUS_KEYS: Record<OrderStatus, TranslationKey> = {
  pending_confirmation: "order.status.pending_confirmation",
  confirmed: "order.status.confirmed",
  preparing: "order.status.preparing",
  dispatched: "order.status.dispatched",
  shipped: "order.status.shipped",
  delivered: "order.status.delivered",
  cancelled: "order.status.cancelled",
  delivery_failed: "order.status.delivery_failed",
  returned: "order.status.returned",
  no_answer: "order.status.no_answer",
  wrong_number: "order.status.wrong_number",
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return pageMetadata({ path: `/order-success/${token}`, noIndex: true })
}

export default async function OrderSuccessPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const locale = await getLocale()

  let order: OrderPublic | null = null
  let failed = false
  try {
    order = await getOrderByToken(token)
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound()
    failed = true
  }

  if (failed || !order) {
    return (
      <div className="page">
        <Alert tone="error" role="alert">
          <p style={{ margin: 0 }}>{translate(locale, "common.errorBody")}</p>
          <CtaLink href="/" variant="outline">
            {translate(locale, "notFound.cta")}
          </CtaLink>
        </Alert>
      </div>
    )
  }

  const statusKey = STATUS_KEYS[order.status] ?? "order.status.unknown"

  return (
    <div className="page stack">
      <div className="card card-pad stack">
        <h1 style={{ margin: 0 }}>{translate(locale, "success.title")}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {translate(locale, "success.subtitle")}
        </p>

        <div>
          <div className="summary-row">
            <span>{translate(locale, "success.orderNumber")}</span>
            <strong>#{order.display_id}</strong>
          </div>
          <div className="summary-row">
            <span>{translate(locale, "success.status")}</span>
            <span>{translate(locale, statusKey)}</span>
          </div>
          <div className="summary-row">
            <span>{translate(locale, "success.delivery")}</span>
            <span>
              {order.delivery_method === "stop_desk"
                ? translate(locale, "success.deliveryStopDesk")
                : translate(locale, "success.deliveryHome")}
            </span>
          </div>
          {order.stop_desk?.name ? (
            <div className="summary-row">
              <span>{translate(locale, "success.stopDesk")}</span>
              <span>
                {order.stop_desk.name}
                {order.stop_desk.address ? ` — ${order.stop_desk.address}` : ""}
              </span>
            </div>
          ) : null}
        </div>

        <div className="stack" style={{ gap: "0.75rem" }}>
          {order.items.map((item) => (
            <div className="summary-row" key={item.id}>
              <span>
                {item.product_title}
                {item.variant_title ? <span className="muted"> · {item.variant_title}</span> : null}
                <span className="muted"> × {item.quantity}</span>
              </span>
              <span>{formatMoney(item.line_amount, item.currency_code, locale)}</span>
            </div>
          ))}
        </div>

        <div>
          <div className="summary-row">
            <span>{translate(locale, "checkout.subtotal")}</span>
            <span>{formatMoney(order.subtotal_amount, order.currency_code, locale)}</span>
          </div>
          <div className="summary-row">
            <span>{translate(locale, "checkout.deliveryFee")}</span>
            <span>{formatMoney(order.shipping_amount, order.currency_code, locale)}</span>
          </div>
          <div className="summary-row summary-total">
            <span>{translate(locale, "success.total")}</span>
            <span>{formatMoney(order.total_amount, order.currency_code, locale)}</span>
          </div>
        </div>

        <p className="muted text-sm">{translate(locale, "success.trackNote")}</p>

        <Link href="/products" className="btn btn-primary">
          {translate(locale, "success.continueShopping")}
        </Link>
      </div>
    </div>
  )
}
