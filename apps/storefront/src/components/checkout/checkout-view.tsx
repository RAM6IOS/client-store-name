"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { useState, type FormEvent } from "react"
import type { OrderPublic, Wilaya } from "@/lib/api-types"
import { useI18n } from "@/lib/i18n/context"
import { formatMoney } from "@/lib/money"
import { useCart } from "@/components/cart-provider"
import { ProductImage } from "@/components/product-image"
import { OrderFields } from "./order-fields"
import { useOrderForm } from "./use-order-form"

export function CheckoutView({
  wilayas,
  baseCurrency,
}: {
  wilayas: Wilaya[]
  baseCurrency: string
}) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const cart = useCart()

  const [placed, setPlaced] = useState<OrderPublic | null>(null)

  const currency = cart.currency ?? baseCurrency
  const form = useOrderForm({
    lines: cart.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
    subtotal: cart.subtotal,
    currency,
    ready: cart.ready,
  })

  if (cart.ready && cart.items.length === 0 && !placed) {
    return (
      <div className="page">
        <h1 className="page-title">{t("checkout.title")}</h1>
        <div className="card card-pad text-center">
          <p>{t("checkout.emptyCart")}</p>
          <Link href="/products" className="btn btn-primary">
            {t("checkout.emptyCartCta")}
          </Link>
        </div>
      </div>
    )
  }

  if (placed) {
    return (
      <div className="page">
        <h1 className="page-title">{t("success.title")}</h1>
        <div className="card card-pad stack">
          <p>{t("success.subtitle")}</p>
          <div className="summary-row">
            <span>{t("success.orderNumber")}</span>
            <strong>#{placed.display_id}</strong>
          </div>
          <div className="summary-row summary-total">
            <span>{t("success.total")}</span>
            <span>{formatMoney(placed.total_amount, placed.currency_code, locale)}</span>
          </div>
          <Link href="/products" className="btn btn-primary">
            {t("success.continueShopping")}
          </Link>
        </div>
      </div>
    )
  }

  async function handleSubmit(event: FormEvent) {
    const order = await form.submit(event)
    if (!order) return
    cart.clear()
    if (order.tracking_token) {
      router.push(`/order-success/${order.tracking_token}`)
    } else {
      setPlaced(order)
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">{t("checkout.title")}</h1>

      <form className="checkout-layout" onSubmit={handleSubmit} noValidate>
        <div className="stack">
          <OrderFields form={form} wilayas={wilayas} />
        </div>

        <aside className="card card-pad stack summary-sticky">
          <h2 className="card-title">{t("checkout.summary")}</h2>

          <div className="stack" style={{ gap: "0.75rem" }}>
            {cart.items.map((item) => (
              <div className="line-item" key={item.variantId}>
                <div className="line-item-media">
                  <ProductImage src={item.image} alt={item.productTitle} sizes="48px" />
                </div>
                <div className="line-item-body">
                  <div style={{ fontWeight: 600 }}>{item.productTitle}</div>
                  {item.variantTitle ? (
                    <div className="muted text-sm">{item.variantTitle}</div>
                  ) : null}
                  <div className="muted text-sm">
                    {item.quantity} × {formatMoney(item.unitAmount, item.currencyCode, locale)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="summary-row">
              <span>{t("checkout.subtotal")}</span>
              <span>{formatMoney(form.subtotal, currency, locale)}</span>
            </div>
            <div className="summary-row">
              <span>{t("checkout.deliveryFee")}</span>
              <span>
                {form.quoteState === "loading" ? (
                  <span className="spinner" aria-label={t("checkout.quoteLoading")} />
                ) : form.quoteState === "ready" && form.quote ? (
                  formatMoney(form.quote.feeAmount, form.quote.currencyCode, locale)
                ) : form.quoteState === "unavailable" ? (
                  t("checkout.quoteUnavailable")
                ) : (
                  <span className="muted text-sm">{t("checkout.quoteSelectDestination")}</span>
                )}
              </span>
            </div>
            <div className="summary-row summary-total">
              <span>{t("checkout.total")}</span>
              <span>{formatMoney(form.total, currency, locale)}</span>
            </div>
          </div>

          <p className="muted text-sm" style={{ margin: 0 }}>
            {t("checkout.codNote")}
          </p>

          {form.submitError ? (
            <div className="alert alert-error" role="alert">
              <strong>{t("checkout.formErrorTitle")}</strong>
              <p style={{ margin: "0.25rem 0 0" }}>{form.submitError}</p>
            </div>
          ) : null}

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-block"
            disabled={form.submitting || !form.anyMethodAvailable || form.quoteState !== "ready"}
          >
            {form.submitting ? (
              <>
                <span className="spinner" /> {t("checkout.submitting")}
              </>
            ) : (
              t("checkout.submit")
            )}
          </button>
        </aside>
      </form>
    </div>
  )
}
