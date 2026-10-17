"use client"

import { useActionState, useEffect, useState } from "react"
import { importDeliveryRatesAction, saveDeliveryRatesAction } from "@/app/admin/actions"
import { Alert, Badge } from "@/components/ui"
import { SubmitButton } from "@/components/admin/submit-button"
import type { ActionState } from "@/lib/admin/action-state"
import { createTranslator } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/locales"

const DELIVERY_FIELD_ERRORS = {
  invalidFee: "admin.delivery.errors.invalidFee",
  feeRequired: "admin.delivery.errors.activeNoFee",
} as const

function WilayaRateRow({
  wilaya,
  values,
  errors,
  t,
  onChange,
}: {
  wilaya: { code: string; name: string }
  values: Record<string, string>
  errors: Record<string, string | undefined>
  t: ReturnType<typeof createTranslator>
  onChange: (name: string, value: string) => void
}) {
  const cell = (token: "home" | "stop") => {
    const feeName = `${token}_fee_${wilaya.code}`
    const activeName = `${token}_active_${wilaya.code}`
    const labelName = `${token}_label_${wilaya.code}`
    const error = errors[feeName] ?? errors[activeName]
    const fieldError = error ? " field-error" : ""
    const errorText = error
      ? t(DELIVERY_FIELD_ERRORS[error as keyof typeof DELIVERY_FIELD_ERRORS])
      : null
    return (
      <div className="rate-cell">
        <input
          type="text"
          inputMode="decimal"
          className={`input fee-input${fieldError}`}
          name={feeName}
          aria-label={`${wilaya.name} — ${t("admin.delivery.fee")}`}
          value={values[feeName] ?? ""}
          onChange={(e) => onChange(feeName, e.target.value)}
          placeholder={t("admin.delivery.notConfigured")}
          aria-invalid={error ? true : undefined}
        />
        <label className="rate-toggle">
          <input
            type="checkbox"
            name={activeName}
            checked={(values[activeName] ?? "") === "on"}
            onChange={(e) => onChange(activeName, e.target.checked ? "on" : "")}
            aria-invalid={error ? true : undefined}
          />
          <span className="text-sm">{t("admin.common.enabled")}</span>
        </label>
        {errorText ? <span className="field-error-text">{errorText}</span> : null}
        <input type="hidden" name={labelName} value={values[labelName] ?? ""} />
      </div>
    )
  }

  return (
    <tr key={wilaya.code}>
      <td className="nowrap">
        <div>{wilaya.name}</div>
        <div className="muted text-sm" dir="ltr">
          {wilaya.code}
        </div>
      </td>
      <td>{cell("home")}</td>
      <td>{cell("stop")}</td>
    </tr>
  )
}

/**
 * Batch delivery-rate editor. The whole visible grid is one `useActionState`
 * form: a rejected submission keeps every fee/enabled change and marks the
 * offending rows with `field-error` instead of discarding the operator's work.
 */
export function DeliveryRatesForm({
  wilayas,
  initial,
  currencyCode,
  locale,
}: {
  wilayas: Array<{ code: string; name: string }>
  initial: Record<string, string>
  currencyCode: string
  locale: Locale
}) {
  const t = createTranslator(locale)
  const initialState: ActionState = { ok: true, values: initial }
  const [state, action] = useActionState(saveDeliveryRatesAction, initialState)
  const [formValues, setFormValues] = useState<Record<string, string>>(state.values ?? initial)

  useEffect(() => {
    if (state.values) {
      setFormValues(state.values)
    }
  }, [state.values])

  const handleFieldChange = (name: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [name]: value }))
  }

  const [globalHomeFee, setGlobalHomeFee] = useState("")
  const [globalHomeApplyToAll, setGlobalHomeApplyToAll] = useState(true)
  const [globalStopFee, setGlobalStopFee] = useState("")
  const [globalStopApplyToAll, setGlobalStopApplyToAll] = useState(true)
  const [globalAppliedMessage, setGlobalAppliedMessage] = useState<string | null>(null)

  const handleApplyGlobal = () => {
    const nextValues = { ...formValues }
    let applied = false

    if (globalHomeFee.trim() !== "") {
      for (const wilaya of wilayas) {
        const feeKey = `home_fee_${wilaya.code}`
        const activeKey = `home_active_${wilaya.code}`
        const currentFee = nextValues[feeKey] ?? ""
        if (globalHomeApplyToAll || !currentFee.trim()) {
          nextValues[feeKey] = globalHomeFee.trim()
          nextValues[activeKey] = "on"
          applied = true
        }
      }
    }

    if (globalStopFee.trim() !== "") {
      for (const wilaya of wilayas) {
        const feeKey = `stop_fee_${wilaya.code}`
        const activeKey = `stop_active_${wilaya.code}`
        const currentFee = nextValues[feeKey] ?? ""
        if (globalStopApplyToAll || !currentFee.trim()) {
          nextValues[feeKey] = globalStopFee.trim()
          nextValues[activeKey] = "on"
          applied = true
        }
      }
    }

    if (applied) {
      setFormValues(nextValues)
      setGlobalAppliedMessage(t("admin.delivery.global.applied"))
      setTimeout(() => setGlobalAppliedMessage(null), 3000)
    }
  }

  const values = formValues
  const errors = state.errors ?? {}
  const failed = state.ok === false

  return (
    <form action={action} className="stack">
      {failed && state.message ? (
        <Alert tone="error" role="alert">
          {state.message}
        </Alert>
      ) : null}
      <input type="hidden" name="currency_code" value={currencyCode} />

      <div className="card card-pad stack">
        <h2 className="card-title">{t("admin.delivery.global.title")}</h2>
        <div className="stack-sm">
          <div className="row wrap" style={{ gap: "1rem" }}>
            <div className="field" style={{ flex: "1 1 240px", marginBottom: 0 }}>
              <label className="label" htmlFor="global-home-fee">
                {t("admin.delivery.global.home")} ({currencyCode})
              </label>
              <div className="row-tight">
                <input
                  id="global-home-fee"
                  type="text"
                  inputMode="decimal"
                  className="input"
                  value={globalHomeFee}
                  onChange={(e) => setGlobalHomeFee(e.target.value)}
                  placeholder="0.00"
                />
                <label className="row-tight text-sm" style={{ cursor: "pointer", whiteSpace: "nowrap" }}>
                  <input
                    type="checkbox"
                    checked={globalHomeApplyToAll}
                    onChange={(e) => setGlobalHomeApplyToAll(e.target.checked)}
                  />
                  {t("admin.delivery.global.applyToAll")}
                </label>
              </div>
            </div>
            <div className="field" style={{ flex: "1 1 240px", marginBottom: 0 }}>
              <label className="label" htmlFor="global-stop-fee">
                {t("admin.delivery.global.stopDesk")} ({currencyCode})
              </label>
              <div className="row-tight">
                <input
                  id="global-stop-fee"
                  type="text"
                  inputMode="decimal"
                  className="input"
                  value={globalStopFee}
                  onChange={(e) => setGlobalStopFee(e.target.value)}
                  placeholder="0.00"
                />
                <label className="row-tight text-sm" style={{ cursor: "pointer", whiteSpace: "nowrap" }}>
                  <input
                    type="checkbox"
                    checked={globalStopApplyToAll}
                    onChange={(e) => setGlobalStopApplyToAll(e.target.checked)}
                  />
                  {t("admin.delivery.global.applyToAll")}
                </label>
              </div>
            </div>
          </div>
          <div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleApplyGlobal}
            >
              {t("admin.delivery.global.applyBtn")}
            </button>
            {globalAppliedMessage ? (
              <span className="text-sm" style={{ marginInlineStart: "1rem", color: "var(--color-primary)" }}>
                {globalAppliedMessage}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t("admin.delivery.wilaya")}</th>
              <th>
                {t("admin.delivery.home")}
                <span className="stat-hint"> · {t("admin.delivery.fee")}</span>
              </th>
              <th>
                {t("admin.delivery.stopDesk")}
                <span className="stat-hint"> · {t("admin.delivery.fee")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {wilayas.map((wilaya) => (
              <WilayaRateRow
                key={wilaya.code}
                wilaya={wilaya}
                values={values}
                errors={errors}
                t={t}
                onChange={handleFieldChange}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted text-sm">{t("admin.delivery.homeHint")}</p>

      <div className="form-actions">
        <SubmitButton pendingLabel={t("admin.common.saving")} className="btn btn-primary">
          {t("admin.delivery.saveBatch")}
        </SubmitButton>
        <Badge>{currencyCode}</Badge>
      </div>
    </form>
  )
}

export function DeliveryImportForm({
  currencyCode,
  locale,
}: {
  currencyCode: string
  locale: Locale
}) {
  const t = createTranslator(locale)
  const [state, action] = useActionState(importDeliveryRatesAction, { ok: true, values: {} } satisfies ActionState)
  const failed = state.ok === false
  const csv = state.values?.csv

  return (
    <section className="card card-pad stack">
      <h2>{t("admin.delivery.import")}</h2>
      <p className="muted text-sm">{t("admin.delivery.importHelp")}</p>
      {failed && state.message ? (
        <Alert tone="error" role="alert">
          {state.message}
        </Alert>
      ) : null}
      <form action={action} className="stack">
        <input type="hidden" name="currency_code" value={currencyCode} />
        <div className="field">
          <label className="label" htmlFor="csv">
            {t("admin.delivery.import")}
          </label>
          <textarea
            id="csv"
            name="csv"
            className="textarea"
            rows={5}
            dir="ltr"
            placeholder={t("admin.delivery.importPlaceholder")}
            defaultValue={csv}
          />
        </div>
        <div className="form-actions">
          <SubmitButton pendingLabel={t("admin.common.saving")} className="btn btn-outline btn-sm">
            {t("admin.delivery.import")}
          </SubmitButton>
        </div>
      </form>
    </section>
  )
}
