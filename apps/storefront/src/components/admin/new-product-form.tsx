"use client"

import Link from "next/link"
import { useActionState, useState } from "react"
import { createProductAction } from "@/app/admin/actions"
import { Alert } from "@/components/ui"
import { ProductImageManager } from "@/components/admin/product-image-manager"
import { ProductVariantsManager } from "@/components/admin/product-variants-manager"
import { SubmitButton } from "@/components/admin/submit-button"
import type { ActionState } from "@/lib/admin/action-state"
import { createTranslator, type TranslationKey } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/locales"

const INITIAL: ActionState = { ok: true, values: {} }

/**
 * Product creation form. Runs the server action through `useActionState` so a
 * recoverable failure (validation, duplicate SKU) re-renders the form with the
 * operator's input preserved and the offending field flagged, instead of
 * wiping the whole entry behind a redirect.
 */
export function NewProductForm({
  locale,
  currencyCode,
  categories,
}: {
  locale: Locale
  currencyCode: string
  categories: { id: string; name: string }[]
}) {
  const t = createTranslator(locale)
  const [state, action] = useActionState(createProductAction, INITIAL)
  const values = state.values ?? {}
  const failed = state.ok === false

  const [title, setTitle] = useState(values.title ?? "")
  const [handle, setHandle] = useState(values.handle ?? "")
  const [isHandleManual, setIsHandleManual] = useState(Boolean(values.handle))
  const [hasVariants, setHasVariants] = useState(false)

  const slugify = (str: string) =>
    str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    if (!isHandleManual) {
      setHandle(slugify(newTitle))
    }
  }

  const errorText = (name: string): string | undefined => {
    const key = state.errors?.[name]
    return key ? t(key as TranslationKey) : undefined
  }
  const fieldClass = (name: string): string => (state.errors?.[name] ? " field-error" : "")

  return (
    <form action={action} className="card card-pad stack">
      {failed && state.message ? (
        <Alert tone="error" role="alert">
          {state.message}
        </Alert>
      ) : null}

      <input type="hidden" name="currency_code" value={currencyCode} />

      <div className="spread">
        <h1 className="page-title" style={{ margin: 0, fontSize: "1.25rem" }}>
          {t("admin.products.createTitle")}
        </h1>
        <div className="row">
          <SubmitButton pendingLabel={t("admin.common.saving")} className="btn btn-primary btn-sm">
            {t("admin.common.create")}
          </SubmitButton>
          <Link href="/admin/products" className="btn btn-outline btn-sm">
            {t("admin.common.cancel")}
          </Link>
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="title">
          {t("admin.products.name")}
        </label>
        <input
          id="title"
          name="title"
          className={`input${fieldClass("title")}`}
          value={title}
          onChange={handleTitleChange}
          required
          maxLength={200}
          aria-invalid={state.errors?.title ? true : undefined}
        />
        {errorText("title") ? <span className="field-error-text">{errorText("title")}</span> : null}
      </div>

      <div className="field">
        <label className="label" htmlFor="handle">
          {t("admin.products.handle")}
        </label>
        <input
          id="handle"
          name="handle"
          className="input"
          dir="ltr"
          value={handle}
          onChange={(e) => {
            setHandle(e.target.value)
            setIsHandleManual(true)
          }}
        />
      </div>

      <div className="field-grid-2">
        <div className="field">
          <label className="label" htmlFor="price">
            {t("admin.common.price")} ({currencyCode})
          </label>
          <input
            id="price"
            name="price"
            className={`input${fieldClass("price")}`}
            inputMode="decimal"
            required
            placeholder="0.00"
            defaultValue={values.price}
            aria-invalid={state.errors?.price ? true : undefined}
          />
          {errorText("price") ? <span className="field-error-text">{errorText("price")}</span> : null}
        </div>
        {!hasVariants ? (
          <div className="field">
            <label className="label" htmlFor="compare_at_price">
              {t("admin.products.compareAtPrice")} ({currencyCode})
            </label>
            <input
              id="compare_at_price"
              name="compare_at_price"
              className="input"
              inputMode="decimal"
              placeholder="0.00"
              defaultValue={values.compare_at_price}
            />
          </div>
        ) : null}
      </div>

      <div className="field-grid-2">
        <div className="field">
          <label className="label" htmlFor="sku">
            {t("admin.products.sku")}
          </label>
          <input id="sku" name="sku" className="input" dir="ltr" defaultValue={values.sku} />
          {errorText("sku") ? <span className="field-error-text">{errorText("sku")}</span> : null}
        </div>
        <div className="field">
          <label className="label" htmlFor="initial_stock">
            {t("admin.products.initialStock")}
          </label>
          <input
            id="initial_stock"
            name="initial_stock"
            type="number"
            min={0}
            defaultValue={values.initial_stock ?? "0"}
            className="input"
          />
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="status">
          {t("admin.common.status")}
        </label>
        <select id="status" name="status" className="select" defaultValue={values.status ?? "draft"}>
          <option value="draft">{t("admin.products.status.draft")}</option>
          <option value="published">{t("admin.products.status.published")}</option>
        </select>
      </div>

      <div className="field">
        <label className="label" htmlFor="category_id">
          {t("admin.products.category")}
        </label>
        <select
          id="category_id"
          name="category_id"
          className="select"
          defaultValue={values.category_id ?? ""}
          disabled={categories.length === 0}
        >
          <option value="">{t("admin.products.categoryNone")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="checkbox-field">
          <input
            type="checkbox"
            name="is_featured"
            value="true"
            defaultChecked={values.is_featured === "true"}
          />
          <span className="text-sm">{t("admin.products.featured")}</span>
        </label>
      </div>

      <div className="field">
        <label className="label" htmlFor="description">
          {t("admin.products.description")}
        </label>
        <textarea id="description" name="description" className="textarea" rows={4} defaultValue={values.description} />
      </div>

      <ProductVariantsManager
        locale={locale}
        currencyCode={currencyCode}
        onHasVariantsChange={setHasVariants}
      />

      <ProductImageManager locale={locale} />

      <div className="form-actions">
        <SubmitButton pendingLabel={t("admin.common.saving")} className="btn btn-primary">
          {t("admin.common.create")}
        </SubmitButton>
        <Link href="/admin/products" className="btn btn-outline">
          {t("admin.common.cancel")}
        </Link>
      </div>
    </form>
  )
}
