"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useI18n } from "@/lib/i18n/context"
import { formatMoney } from "@/lib/money"
import { useCart } from "./cart-provider"
import { ProductImage } from "./product-image"
import { QuantityStepper } from "./quantity-stepper"

export function CartButton() {
  const { t } = useI18n()
  const { count } = useCart()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="btn btn-outline cart-link"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <span>{t("nav.cart")}</span>
        <span className="cart-count" aria-hidden="true">
          {count}
        </span>
        <span className="sr-only">{t("cart.items", { count })}</span>
      </button>
      {open ? <CartPanel onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function CartPanel({ onClose }: { onClose: () => void }) {
  const { t, locale } = useI18n()
  const { items, subtotal, currency, setQuantity, removeItem } = useCart()

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose])

  return (
    <div
      className="overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="drawer" role="dialog" aria-modal="true" aria-label={t("cart.title")}>
        <div className="drawer-header">
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{t("cart.title")}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <div className="drawer-body">
          {items.length === 0 ? (
            <div className="stack">
              <p className="muted">{t("cart.empty")}</p>
              <Link href="/products" className="btn btn-primary" onClick={onClose}>
                {t("cart.emptyCta")}
              </Link>
            </div>
          ) : (
            items.map((line) => (
              <div className="line-item" key={line.variantId}>
                <div className="line-item-media">
                  <ProductImage src={line.image} alt={line.productTitle} sizes="64px" />
                </div>
                <div className="line-item-body stack" style={{ gap: "0.35rem" }}>
                  <div className="stack" style={{ gap: "0.15rem" }}>
                    <Link href={`/products/${line.productHandle}`} onClick={onClose} style={{ fontWeight: 600 }}>
                      {line.productTitle}
                    </Link>
                    {line.variantTitle ? (
                      <span className="muted text-sm">{line.variantTitle}</span>
                    ) : null}
                  </div>
                  <div className="sw" style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                    <QuantityStepper
                      value={line.quantity}
                      onChange={(quantity) => setQuantity(line.variantId, quantity)}
                      label={t("cart.quantity")}
                    />
                    <span style={{ fontWeight: 700 }}>
                      {formatMoney(
                        BigInt(line.unitAmount) * BigInt(line.quantity),
                        line.currencyCode,
                        locale,
                      )}
                    </span>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeItem(line.variantId)}
                    >
                      {t("cart.remove")}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 ? (
          <div className="drawer-footer stack">
            <div className="summary-row">
              <span>{t("cart.subtotal")}</span>
              <strong>{formatMoney(subtotal, currency ?? "DZD", locale)}</strong>
            </div>
            <Link href="/checkout" className="btn btn-primary btn-block" onClick={onClose}>
              {t("cart.checkout")}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}
