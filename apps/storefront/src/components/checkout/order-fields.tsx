"use client"

import type { DeliveryMethodOption, Wilaya } from "@/lib/api-types"
import { useI18n } from "@/lib/i18n/context"
import type { Locale } from "@/lib/i18n/locales"
import { formatMoney } from "@/lib/money"
import type { OrderForm } from "./use-order-form"

/**
 * The recipient + delivery fields shared by the cart checkout and the inline
 * product-page order form. Purely presentational: all state lives in
 * `useOrderForm` so the two entry points stay behaviourally identical.
 */
export function OrderFields({
  form,
  wilayas,
  idPrefix = "order",
}: {
  form: OrderForm
  wilayas: Wilaya[]
  idPrefix?: string
}) {
  const { t, locale } = useI18n()
  const id = (suffix: string) => `${idPrefix}-${suffix}`
  const { errors } = form

  return (
    <>
      <section className="card card-pad stack" aria-labelledby={id("customer")}>
        <h2 id={id("customer")} className="card-title">
          {t("checkout.customerTitle")}
        </h2>
        <div className="field">
          <label className="label" htmlFor={id("name")}>
            {t("checkout.name")}
          </label>
          <input
            id={id("name")}
            className="input"
            value={form.name}
            onChange={(event) => form.setName(event.target.value)}
            aria-invalid={Boolean(errors.name)}
            autoComplete="name"
            placeholder={t("checkout.namePlaceholder")}
          />
          {errors.name ? <span className="error-text">{errors.name}</span> : null}
        </div>
        <div className="field">
          <label className="label" htmlFor={id("phone")}>
            {t("checkout.phone")}
          </label>
          <input
            id={id("phone")}
            className="input"
            value={form.phone}
            onChange={(event) => form.setPhone(event.target.value)}
            aria-invalid={Boolean(errors.phone)}
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t("checkout.phonePlaceholder")}
          />
          {errors.phone ? (
            <span className="error-text">{errors.phone}</span>
          ) : (
            <span className="hint">{t("checkout.phoneHint")}</span>
          )}
        </div>
      </section>

      <div className="card card-pad stack">
        <h2 className="card-title">{t("checkout.deliveryTitle")}</h2>

        <div className="field-grid field-grid-2">
          <div className="field">
            <label className="label" htmlFor={id("wilaya")}>
              {t("checkout.wilaya")}
            </label>
            <select
              id={id("wilaya")}
              className="select"
              value={form.wilayaCode}
              onChange={(event) => form.setWilayaCode(event.target.value)}
              aria-invalid={Boolean(errors.wilaya)}
            >
              <option value="">{t("checkout.wilayaPlaceholder")}</option>
              {wilayas.map((wilaya) => (
                <option key={wilaya.code} value={wilaya.code}>
                  {wilaya.code} — {locale === "ar" ? wilaya.name_ar : wilaya.name_fr}
                </option>
              ))}
            </select>
            {errors.wilaya ? <span className="error-text">{errors.wilaya}</span> : null}
          </div>

          <div className="field">
            <label className="label" htmlFor={id("commune")}>
              {t("checkout.commune")}
            </label>
            <select
              id={id("commune")}
              className="select"
              value={form.communeCode}
              disabled={!form.wilayaCode || form.loadingDestination}
              onChange={(event) => form.setCommuneCode(event.target.value)}
              aria-invalid={Boolean(errors.commune)}
            >
              <option value="">
                {form.wilayaCode
                  ? t("checkout.communePlaceholder")
                  : t("checkout.communeSelectFirst")}
              </option>
              {form.communes.map((commune) => (
                <option key={commune.code} value={commune.post_code}>
                  {locale === "ar" ? commune.name_ar : commune.name_fr}
                </option>
              ))}
            </select>
            {errors.commune ? <span className="error-text">{errors.commune}</span> : null}
          </div>
        </div>

        {form.wilayaCode ? (
          <div className="field">
            <span className="label">{t("checkout.method")}</span>
            {form.loadingDestination ? (
              <span className="hint">
                <span className="spinner" /> {t("common.loading")}
              </span>
            ) : form.anyMethodAvailable ? (
              <div className="radio-cards">
                {form.homeAvailable ? (
                  <label className="radio-card" data-checked={form.method === "home"}>
                    <input
                      type="radio"
                      name={id("method")}
                      value="home"
                      checked={form.method === "home"}
                      onChange={() => form.setMethod("home")}
                    />
                    <span className="radio-card-body">
                      <span className="radio-card-title">{t("checkout.methodHome")}</span>
                      <MethodFee
                        option={form.methods.find((item) => item.method === "home")}
                        locale={locale}
                      />
                    </span>
                  </label>
                ) : null}
                {form.stopDeskAvailable ? (
                  <label className="radio-card" data-checked={form.method === "stop_desk"}>
                    <input
                      type="radio"
                      name={id("method")}
                      value="stop_desk"
                      checked={form.method === "stop_desk"}
                      onChange={() => form.setMethod("stop_desk")}
                    />
                    <span className="radio-card-body">
                      <span className="radio-card-title">{t("checkout.methodStopDesk")}</span>
                      <MethodFee
                        option={form.methods.find((item) => item.method === "stop_desk")}
                        locale={locale}
                      />
                    </span>
                  </label>
                ) : null}
              </div>
            ) : (
              <span className="alert alert-error" role="alert">
                {t("checkout.methodUnavailable")}
              </span>
            )}
          </div>
        ) : null}

        {form.method === "home" ? (
          <>
            <div className="field">
              <label className="label" htmlFor={id("address")}>
                {t("checkout.address")}
              </label>
              <input
                id={id("address")}
                className="input"
                value={form.addressLine}
                onChange={(event) => form.setAddressLine(event.target.value)}
                aria-invalid={Boolean(errors.address)}
                autoComplete="street-address"
                placeholder={t("checkout.addressPlaceholder")}
              />
              {errors.address ? <span className="error-text">{errors.address}</span> : null}
            </div>
            <div className="field">
              <label className="label" htmlFor={id("landmark")}>
                {t("checkout.landmark")}{" "}
                <span className="muted text-sm">({t("common.optional")})</span>
              </label>
              <input
                id={id("landmark")}
                className="input"
                value={form.landmark}
                onChange={(event) => form.setLandmark(event.target.value)}
                placeholder={t("checkout.landmarkPlaceholder")}
              />
            </div>
          </>
        ) : null}

        {form.method === "stop_desk" ? (
          <div className="field">
            <label className="label" htmlFor={id("stop-desk")}>
              {t("checkout.stopDesk")}
            </label>
            {form.desks.length > 0 ? (
              <select
                id={id("stop-desk")}
                className="select"
                value={form.stopDeskId}
                onChange={(event) => form.setStopDeskId(event.target.value)}
                aria-invalid={Boolean(errors.stopDesk)}
              >
                <option value="">{t("checkout.stopDeskSelect")}</option>
                {form.desks.map((desk) => (
                  <option key={desk.id} value={desk.id}>
                    {desk.name}
                    {desk.address ? ` — ${desk.address}` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id("stop-desk-name")}
                className="input"
                value={form.stopDeskName}
                onChange={(event) => form.setStopDeskName(event.target.value)}
                aria-invalid={Boolean(errors.stopDesk)}
                placeholder={t("checkout.stopDeskNamePlaceholder")}
              />
            )}
            {errors.stopDesk ? <span className="error-text">{errors.stopDesk}</span> : null}
          </div>
        ) : null}

        <div className="field">
          <label className="label" htmlFor={id("notes")}>
            {t("checkout.notes")} <span className="muted text-sm">({t("common.optional")})</span>
          </label>
          <input
            id={id("notes")}
            className="input"
            value={form.notes}
            onChange={(event) => form.setNotes(event.target.value)}
            placeholder={t("checkout.notesPlaceholder")}
          />
        </div>
      </div>
    </>
  )
}

export function MethodFee({
  option,
  locale,
}: {
  option: DeliveryMethodOption | undefined
  locale: Locale
}) {
  if (!option || option.feeAmount === null) {
    return <span className="muted text-sm">—</span>
  }
  return (
    <span className="muted text-sm">
      {formatMoney(option.feeAmount, option.currencyCode, locale)}
    </span>
  )
}
