"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import type { OrderPublic, Product, Wilaya } from "@/lib/api-types"
import { useI18n } from "@/lib/i18n/context"
import { defaultVariantIndex, isVariantAvailable, maxOrderableQuantity } from "@/lib/inventory"
import { formatMoney, multiplyMinorUnits, toMinorUnits } from "@/lib/money"
import { OrderFields } from "./checkout/order-fields"
import { useOrderForm } from "./checkout/use-order-form"
import { ProductImage } from "./product-image"
import { QuantityStepper } from "./quantity-stepper"
import { Badge } from "./ui"

export function ProductPurchasePanel({
  product,
  wilayas,
  initialVariantId,
}: {
  product: Product
  wilayas: Wilaya[]
  initialVariantId?: string
}) {
  const { t, locale } = useI18n()

  const [variantId, setVariantId] = useState(
    initialVariantId ?? product.variants[defaultVariantIndex(product)]?.id ?? "",
  )
  const [quantity, setQuantity] = useState(1)
  const [placed, setPlaced] = useState<OrderPublic | null>(null)

  const variant =
    product.variants.find((candidate) => candidate.id === variantId) ?? product.variants[0]

  const image = product.thumbnail ?? product.images[0]?.url ?? null
  const currency = variant?.currency_code ?? "DZD"
  const subtotal = variant ? multiplyMinorUnits(variant.price_amount, quantity) : 0n

  const priceUnits = variant ? toMinorUnits(variant.price_amount) : 0n
  const compareUnits = variant?.compare_at_amount ? toMinorUnits(variant.compare_at_amount) : 0n
  const discountPercent =
    compareUnits > priceUnits && compareUnits > 0n
      ? Math.round(
          Number((compareUnits - priceUnits) * 100n) / Number(compareUnits),
        )
      : null

  const form = useOrderForm({
    lines: variant ? [{ variantId: variant.id, quantity }] : [],
    subtotal,
    currency,
  })

  if (!variant) {
    return (
      <p className="alert alert-error" role="alert" style={{ margin: 0 }}>
        {t("product.unavailable")}
      </p>
    )
  }

  const available = isVariantAvailable(variant)
  const max = Math.max(1, maxOrderableQuantity(variant))

  async function handleSubmit(event: FormEvent) {
    const order = await form.submit(event)
    if (!order) return
    setPlaced(order)
  }

  if (placed) {
    return (
      <div className="card card-pad stack" role="status">
        <h2 className="card-title" style={{ margin: 0 }}>
          {t("success.title")}
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          {t("success.subtitle")}
        </p>
        <div>
          <div className="summary-row">
            <span>{t("success.orderNumber")}</span>
            <strong>#{placed.display_id}</strong>
          </div>
          <div className="summary-row summary-total">
            <span>{t("success.total")}</span>
            <span>{formatMoney(placed.total_amount, placed.currency_code, locale)}</span>
          </div>
        </div>
        {placed.tracking_token ? (
          <Link href={`/order-success/${placed.tracking_token}`} className="btn btn-outline">
            {t("success.trackOrder")}
          </Link>
        ) : null}
        <Link href="/products" className="btn btn-primary">
          {t("success.continueShopping")}
        </Link>
      </div>
    )
  }

  return (
    <form className="checkout-layout" onSubmit={handleSubmit} noValidate>
      <div className="stack">
        <h1 style={{ margin: 0, fontSize: "clamp(1.4rem, 3vw, 1.8rem)" }}>{product.title}</h1>

        <div className="row wrap" style={{ gap: "0.75rem", alignItems: "baseline" }}>
          <span className="price">
            {formatMoney(variant.price_amount, variant.currency_code, locale)}
          </span>
          {discountPercent ? (
            <span className="price-compare">
              {formatMoney(variant.compare_at_amount!, variant.currency_code, locale)}
            </span>
          ) : null}
          {discountPercent ? (
            <Badge tone="danger">{t("product.discountLabel", { percent: discountPercent })}</Badge>
          ) : null}
          <Badge tone={available ? "success" : "danger"}>
            {available ? t("product.inStock") : t("product.outOfStock")}
          </Badge>
        </div>

        {product.variants.length > 1 ? (
          <div className="field">
            <span className="label" id="variant-label">
              {t("product.variant")}
            </span>
            <div className="options" role="group" aria-labelledby="variant-label">
              {product.variants.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className="option"
                  aria-pressed={candidate.id === variant.id}
                  disabled={!isVariantAvailable(candidate)}
                  onClick={() => {
                    setVariantId(candidate.id)
                    setQuantity(1)
                  }}
                >
                  {candidate.title}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="field">
          <span className="label">{t("product.quantity")}</span>
          <QuantityStepper
            value={quantity}
            onChange={(next) => {
              setQuantity(next)
            }}
            max={max}
            label={t("product.quantity")}
          />
        </div>

        <div className="card card-pad" style={{ background: "var(--color-surface)", fontSize: "0.9rem" }}>
          <div className="stack-sm">
            <div className="row-tight">✓ {t("product.trustShipping")}</div>
            <div className="row-tight">✓ {t("product.trustCod")}</div>
            <div className="row-tight">✓ {t("product.trustReturn")}</div>
          </div>
        </div>

        <OrderFields form={form} wilayas={wilayas} idPrefix="product-order" />
      </div>

      <aside className="card card-pad stack summary-sticky">
        <h2 className="card-title">{t("checkout.summary")}</h2>

        <div className="line-item">
          <div className="line-item-media">
            <ProductImage src={image} alt={product.title} sizes="48px" />
          </div>
          <div className="line-item-body">
            <div style={{ fontWeight: 600 }}>{product.title}</div>
            {product.variants.length > 1 ? (
              <div className="muted text-sm">{variant.title}</div>
            ) : null}
            <div className="muted text-sm">
              {quantity} × {formatMoney(variant.price_amount, variant.currency_code, locale)}
            </div>
          </div>
        </div>

        <div>
          <div className="summary-row">
            <span>{t("checkout.subtotal")}</span>
            <span>{formatMoney(subtotal, currency, locale)}</span>
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
          disabled={
            !available || form.submitting || !form.anyMethodAvailable || form.quoteState !== "ready"
          }
        >
          {form.submitting ? (
            <>
              <span className="spinner" /> {t("checkout.submitting")}
            </>
          ) : (
            t("product.codSubmit")
          )}
        </button>
      </aside>
    </form>
  )
}
