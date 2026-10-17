"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import type { OrderPublic, Product, ProductVariant, Wilaya } from "@/lib/api-types"
import { useI18n } from "@/lib/i18n/context"
import { formatMoney } from "@/lib/money"
import { ProductImage } from "./product-image"
import type { OrderForm } from "./checkout/use-order-form"

export function CodOrderCard({
  form,
  wilayas,
  product,
  variant,
  quantity,
  subtotal,
  currency,
  placed,
  onResetPlaced,
  onSubmit,
}: {
  form: OrderForm
  wilayas: Wilaya[]
  product: Product
  variant: ProductVariant | undefined
  quantity: number
  subtotal: bigint
  currency: string
  placed: OrderPublic | null
  onResetPlaced: () => void
  onSubmit: (e: FormEvent) => void
}) {
  const { t, locale } = useI18n()
  const { errors } = form
  const [showOptionalFields, setShowOptionalFields] = useState(false)

  const available = variant ? form.anyMethodAvailable : false
  const image = product.thumbnail ?? product.images[0]?.url ?? null

  if (placed) {
    return (
      <div className="cod-card cod-card-success stack" role="status" aria-live="polite">
        <div className="cod-success-icon-wrap" aria-hidden="true">
          <svg className="cod-success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>

        <div className="text-center stack-sm">
          <h2 className="cod-success-title">{t("success.title")}</h2>
          <p className="cod-success-subtitle">{t("success.subtitle")}</p>
        </div>

        <div className="cod-success-details stack-sm">
          <div className="cod-success-row">
            <span>{t("success.orderNumber")}</span>
            <strong className="cod-order-badge">#{placed.display_id}</strong>
          </div>
          <div className="cod-success-row cod-success-total">
            <span>{t("success.total")}</span>
            <span className="cod-total-amount">
              {formatMoney(placed.total_amount, placed.currency_code, locale)}
            </span>
          </div>
        </div>

        <div className="cod-confirmation-reminder">
          <svg className="cod-reminder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <span>{t("product.confirmationBanner")}</span>
        </div>

        <div className="stack-sm">
          {placed.tracking_token ? (
            <Link href={`/order-success/${placed.tracking_token}`} className="btn btn-outline btn-block">
              {t("success.trackOrder")}
            </Link>
          ) : null}
          <button type="button" onClick={onResetPlaced} className="btn btn-primary btn-block">
            {t("product.orderAgain")}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="cod-card" onSubmit={onSubmit} noValidate aria-labelledby="cod-form-title">
      {/* 1. Header with Lock Badge */}
      <div className="cod-card-header">
        <div className="cod-card-header-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div>
          <h2 id="cod-form-title" className="cod-card-title">
            {t("checkout.formTitle")}
          </h2>
          <p className="cod-card-subtitle">{t("checkout.formSubtitle")}</p>
        </div>
      </div>

      <div className="cod-card-body stack">
        {/* Section 1: Customer Info */}
        <section className="cod-section" aria-labelledby="cod-step-customer">
          <h3 id="cod-step-customer" className="cod-section-heading">
            {t("checkout.stepCustomer")}
          </h3>

          <div className="stack-sm">
            <div className="field">
              <label className="label" htmlFor="cod-customer-name">
                {t("checkout.name")} <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <input
                id="cod-customer-name"
                className={`input ${errors.name ? "input-error" : ""}`}
                value={form.name}
                onChange={(e) => form.setName(e.target.value)}
                placeholder={t("checkout.namePlaceholder")}
                autoComplete="name"
                aria-invalid={Boolean(errors.name)}
                required
              />
              {errors.name ? (
                <span className="error-text">
                  <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {errors.name}
                </span>
              ) : null}
            </div>

            <div className="field">
              <label className="label" htmlFor="cod-customer-phone">
                {t("checkout.phone")} <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <div className={`cod-phone-group ${errors.phone ? "input-error" : ""}`}>
                <div className="cod-phone-prefix" aria-hidden="true">
                  <span className="cod-phone-flag" role="img" aria-label="Algeria">🇩🇿</span>
                  <svg className="cod-phone-chevron" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                  <span className="cod-phone-dial" dir="ltr">+213</span>
                </div>
                <input
                  id="cod-customer-phone"
                  className="cod-phone-input"
                  value={form.phone}
                  onChange={(e) => form.setPhone(e.target.value)}
                  placeholder={t("checkout.phonePlaceholder")}
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  autoComplete="tel"
                  aria-invalid={Boolean(errors.phone)}
                  required
                />
              </div>
              {errors.phone ? (
                <span className="error-text">
                  <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {errors.phone}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        {/* Section 2: Address */}
        <section className="cod-section" aria-labelledby="cod-step-address">
          <h3 id="cod-step-address" className="cod-section-heading">
            {t("checkout.stepAddress")}
          </h3>

          <div className="stack-sm">
            <div className="field">
              <label className="label" htmlFor="cod-wilaya">
                {t("checkout.wilaya")} <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <div className="select-wrap">
                <select
                  id="cod-wilaya"
                  className={`select ${errors.wilaya ? "input-error" : ""}`}
                  value={form.wilayaCode}
                  onChange={(e) => form.setWilayaCode(e.target.value)}
                  aria-invalid={Boolean(errors.wilaya)}
                  required
                >
                  <option value="">{t("checkout.wilayaPlaceholder")}</option>
                  {wilayas.map((wilaya) => (
                    <option key={wilaya.code} value={wilaya.code}>
                      {wilaya.code} — {locale === "ar" ? wilaya.name_ar : wilaya.name_fr}
                    </option>
                  ))}
                </select>
                <span className="select-arrow" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                </span>
              </div>
              {errors.wilaya ? (
                <span className="error-text">
                  <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {errors.wilaya}
                </span>
              ) : null}
            </div>

            <div className="field">
              <label className="label" htmlFor="cod-commune">
                {t("checkout.commune")} <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <div className="select-wrap">
                <select
                  id="cod-commune"
                  className={`select ${errors.commune ? "input-error" : ""}`}
                  value={form.communeCode}
                  disabled={!form.wilayaCode || form.loadingDestination}
                  onChange={(e) => form.setCommuneCode(e.target.value)}
                  aria-invalid={Boolean(errors.commune)}
                  required
                >
                  <option value="">
                    {form.loadingDestination
                      ? t("common.loading")
                      : form.wilayaCode
                        ? t("checkout.communePlaceholder")
                        : t("checkout.communeSelectFirst")}
                  </option>
                  {form.communes.map((commune) => (
                    <option key={commune.code} value={commune.post_code}>
                      {locale === "ar" ? commune.name_ar : commune.name_fr}
                    </option>
                  ))}
                </select>
                <span className="select-arrow" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                </span>
              </div>
              {errors.commune ? (
                <span className="error-text">
                  <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {errors.commune}
                </span>
              ) : null}
            </div>

            <div className="field">
              <label className="label" htmlFor="cod-address">
                {t("checkout.detailedAddress")} <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <input
                id="cod-address"
                className={`input ${errors.address ? "input-error" : ""}`}
                value={form.addressLine}
                onChange={(e) => form.setAddressLine(e.target.value)}
                placeholder={t("checkout.detailedAddressPlaceholder")}
                autoComplete="street-address"
                aria-invalid={Boolean(errors.address)}
                required
              />
              {errors.address ? (
                <span className="error-text">
                  <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {errors.address}
                </span>
              ) : null}
            </div>

            {/* Optional landmark & notes toggle for clean interface */}
            <div className="cod-optional-trigger">
              <button
                type="button"
                className="cod-link-btn"
                onClick={() => setShowOptionalFields(!showOptionalFields)}
              >
                <span>{showOptionalFields ? "− إخفاء الملاحظات الإضافية" : "+ إضافة نقطة استدلال أو ملاحظات (اختياري)"}</span>
              </button>
            </div>

            {showOptionalFields ? (
              <div className="cod-optional-stack stack-sm">
                <div className="field">
                  <label className="label" htmlFor="cod-landmark">
                    {t("checkout.landmark")} <span className="muted text-sm">({t("common.optional")})</span>
                  </label>
                  <input
                    id="cod-landmark"
                    className="input"
                    value={form.landmark}
                    onChange={(e) => form.setLandmark(e.target.value)}
                    placeholder={t("checkout.landmarkPlaceholder")}
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="cod-notes">
                    {t("checkout.notes")} <span className="muted text-sm">({t("common.optional")})</span>
                  </label>
                  <input
                    id="cod-notes"
                    className="input"
                    value={form.notes}
                    onChange={(e) => form.setNotes(e.target.value)}
                    placeholder={t("checkout.notesPlaceholder")}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* Section 3: Delivery Method */}
        <section className="cod-section" aria-labelledby="cod-step-method">
          <h3 id="cod-step-method" className="cod-section-heading">
            {t("checkout.stepMethod")}
          </h3>

          <div className="cod-methods-grid">
            {/* Home Delivery Card */}
            <button
              type="button"
              className={`cod-method-card ${form.method === "home" ? "active" : ""}`}
              onClick={() => form.setMethod("home")}
              disabled={!form.homeAvailable && form.wilayaCode !== ""}
            >
              <div className="cod-method-icon-wrap" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <div className="cod-method-info">
                <div className="cod-method-title">{t("checkout.methodHome")}</div>
                <div className="cod-method-desc">{t("checkout.methodHomeDesc")}</div>
                <div className="cod-method-fee">
                  {form.quoteState === "loading" && form.method === "home" ? (
                    <span className="spinner-inline" />
                  ) : (
                    form.methods.find((m) => m.method === "home")?.feeAmount !== null &&
                    form.methods.find((m) => m.method === "home")?.feeAmount !== undefined
                      ? formatMoney(form.methods.find((m) => m.method === "home")!.feeAmount!, currency, locale)
                      : "—"
                  )}
                </div>
              </div>
              {form.method === "home" ? (
                <div className="cod-check-indicator" aria-hidden="true">✓</div>
              ) : null}
            </button>

            {/* Stop Desk Card (Only when genuinely available) */}
            {form.stopDeskAvailable ? (
              <button
                type="button"
                className={`cod-method-card ${form.method === "stop_desk" ? "active" : ""}`}
                onClick={() => form.setMethod("stop_desk")}
              >
                <div className="cod-method-icon-wrap" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <div className="cod-method-info">
                  <div className="cod-method-title">{t("checkout.methodStopDesk")}</div>
                  <div className="cod-method-desc">{t("checkout.methodStopDeskDesc")}</div>
                  <div className="cod-method-fee">
                    {form.quoteState === "loading" && form.method === "stop_desk" ? (
                      <span className="spinner-inline" />
                    ) : (
                      form.methods.find((m) => m.method === "stop_desk")?.feeAmount !== null &&
                      form.methods.find((m) => m.method === "stop_desk")?.feeAmount !== undefined
                        ? formatMoney(form.methods.find((m) => m.method === "stop_desk")!.feeAmount!, currency, locale)
                        : "—"
                    )}
                  </div>
                </div>
                {form.method === "stop_desk" ? (
                  <div className="cod-check-indicator" aria-hidden="true">✓</div>
                ) : null}
              </button>
            ) : null}
          </div>

          {/* Stop Desk Office Picker or Input */}
          {form.method === "stop_desk" ? (
            <div className="field" style={{ marginTop: "0.75rem" }}>
              <label className="label" htmlFor="cod-stop-desk">
                {t("checkout.stopDesk")} <span className="text-danger">*</span>
              </label>
              {form.desks.length > 0 ? (
                <div className="select-wrap">
                  <select
                    id="cod-stop-desk"
                    className={`select ${errors.stopDesk ? "input-error" : ""}`}
                    value={form.stopDeskId}
                    onChange={(e) => form.setStopDeskId(e.target.value)}
                    aria-invalid={Boolean(errors.stopDesk)}
                    required
                  >
                    <option value="">{t("checkout.stopDeskSelect")}</option>
                    {form.desks.map((desk) => (
                      <option key={desk.id} value={desk.id}>
                        {desk.name} {desk.address ? `— ${desk.address}` : ""}
                      </option>
                    ))}
                  </select>
                  <span className="select-arrow" aria-hidden="true">
                    <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                  </span>
                </div>
              ) : (
                <input
                  id="cod-stop-desk-name"
                  className={`input ${errors.stopDesk ? "input-error" : ""}`}
                  value={form.stopDeskName}
                  onChange={(e) => form.setStopDeskName(e.target.value)}
                  placeholder={t("checkout.stopDeskNamePlaceholder")}
                  aria-invalid={Boolean(errors.stopDesk)}
                  required
                />
              )}
              {errors.stopDesk ? (
                <span className="error-text">{errors.stopDesk}</span>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* Section 4: Payment Method */}
        <section className="cod-section" aria-labelledby="cod-step-payment">
          <h3 id="cod-step-payment" className="cod-section-heading">
            {t("checkout.stepPayment")}
          </h3>

          <div className="cod-payment-card active">
            <div className="cod-radio-dot" aria-hidden="true">
              <span className="cod-radio-inner" />
            </div>
            <div className="cod-payment-info">
              <div className="cod-payment-title">{t("checkout.paymentCod")}</div>
              <div className="cod-payment-desc">{t("checkout.paymentCodDesc")}</div>
            </div>
            <div className="cod-payment-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <circle cx="12" cy="12" r="2" />
                <path d="M6 12h.01M18 12h.01" />
              </svg>
            </div>
          </div>
        </section>

        {/* Selected Product Line Summary & Totals */}
        <div className="cod-summary-box">
          <div className="cod-line-item">
            <div className="cod-line-media">
              <ProductImage src={image} alt={product.title} sizes="48px" />
            </div>
            <div className="cod-line-content">
              <div className="cod-line-title">{product.title}</div>
              {product.variants.length > 1 && variant ? (
                <div className="cod-line-variant muted text-sm">{variant.title}</div>
              ) : null}
              <div className="cod-line-calc muted text-sm">
                {quantity} × {variant ? formatMoney(variant.price_amount, variant.currency_code, locale) : "—"}
              </div>
            </div>
          </div>

          <div className="cod-summary-rows">
            <div className="cod-summary-row">
              <span className="muted">{t("checkout.subtotal")}</span>
              <span className="font-semibold">{formatMoney(subtotal, currency, locale)}</span>
            </div>
            <div className="cod-summary-row">
              <span className="muted">{t("checkout.deliveryFee")}</span>
              <span className="font-semibold">
                {form.quoteState === "loading" ? (
                  <span className="spinner-inline" aria-label={t("checkout.quoteLoading")} />
                ) : form.quoteState === "ready" && form.quote ? (
                  formatMoney(form.quote.feeAmount, form.quote.currencyCode, locale)
                ) : form.quoteState === "unavailable" ? (
                  <span className="text-danger text-sm">{t("checkout.quoteUnavailable")}</span>
                ) : (
                  <span className="muted text-sm">{t("checkout.quoteSelectDestination")}</span>
                )}
              </span>
            </div>
            <div className="cod-summary-row cod-total-row">
              <span>{t("checkout.total")}</span>
              <span className="cod-total-price">
                {formatMoney(form.total, currency, locale)}
              </span>
            </div>
          </div>
        </div>

        {form.submitError ? (
          <div className="alert alert-error" role="alert">
            <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div>
              <strong>{t("checkout.formErrorTitle")}</strong>
              <p style={{ margin: "0.2rem 0 0" }}>{form.submitError}</p>
            </div>
          </div>
        ) : null}

        {/* Submit Button */}
        <button
          type="submit"
          className="btn btn-primary btn-lg btn-block cod-submit-btn"
          disabled={form.submitting || (variant ? !available : true)}
        >
          {form.submitting ? (
            <>
              <span className="spinner" aria-hidden="true" />
              <span>{t("checkout.submitting")}</span>
            </>
          ) : (
            <>
              <svg className="cod-btn-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>{t("product.codSubmit")}</span>
            </>
          )}
        </button>

        <p className="cod-terms-note">
          {t("checkout.termsAgreement")}
        </p>
      </div>
    </form>
  )
}
