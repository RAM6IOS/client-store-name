"use client"

import Link from "next/link"
import { useActionState, useState } from "react"
import {
  deleteProductAction,
  productStatusAction,
  updateProductAction,
} from "@/app/admin/actions"
import { Alert, Badge } from "@/components/ui"
import { ConfirmSubmit } from "@/components/admin/confirm-submit"
import { ProductImageManager } from "@/components/admin/product-image-manager"
import { ProductVariantsManager } from "@/components/admin/product-variants-manager"
import { SubmitButton } from "@/components/admin/submit-button"
import type { ActionState } from "@/lib/admin/action-state"
import { minorToMajorInput } from "@/lib/admin/money-input"
import type { Product } from "@/lib/api-types"
import { createTranslator, type TranslationKey } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/locales"

function initialProductState(product: Product): ActionState {
  const defaultVariant = product.variants.find((v) => v.is_default) ?? product.variants[0]
  return {
    ok: true,
    values: {
      title: product.title,
      handle: product.handle,
      description: product.description ?? "",
      thumbnail: product.thumbnail ?? "",
      status: product.status,
      category_id: product.categories[0]?.category_id ?? "",
      compare_at_price: minorToMajorInput(defaultVariant?.compare_at_amount),
      is_featured: product.is_featured ? "true" : "",
    },
  }
}

function useFieldErrors(state: ActionState, locale: Locale) {
  const t = createTranslator(locale)
  return {
    text: (name: string): string | undefined => {
      const key = state.errors?.[name]
      return key ? t(key as TranslationKey) : undefined
    },
    failed: state.ok === false,
    class: (name: string): string => (state.errors?.[name] ? " field-error" : ""),
  }
}

export function ProductDetailClient({
  product,
  currencyCode,
  locale,
  categories,
}: {
  product: Product
  currencyCode: string
  locale: Locale
  categories: { id: string; name: string }[]
}) {
  const t = createTranslator(locale)
  const [editState, editAction] = useActionState(updateProductAction, initialProductState(product))
  const edit = useFieldErrors(editState, locale)
  const editValues = editState.values ?? {}
  // Existing products always manage their price (and discount) through the
  // variant rows, so the product-level compare-at field is shown only while
  // the manager reports no variants.
  const [hasVariants, setHasVariants] = useState(
    product.options.length > 0 || product.variants.length > 0,
  )

  return (
    <div className="stack">
      <section className="card card-pad stack">
        {edit.failed && editState.message ? (
          <Alert tone="error" role="alert">
            {editState.message}
          </Alert>
        ) : null}

        <form action={editAction} className="stack">
          <input type="hidden" name="id" value={product.id} />

          <div className="field">
            <label className="label" htmlFor="title">
              {t("admin.products.name")}
            </label>
            <input
              id="title"
              name="title"
              className={`input${edit.class("title")}`}
              defaultValue={editValues.title}
              required
              maxLength={200}
              aria-invalid={editState.errors?.title ? true : undefined}
            />
            {edit.text("title") ? <span className="field-error-text">{edit.text("title")}</span> : null}
          </div>

          <div className="field-grid-2">
            <div className="field">
              <label className="label" htmlFor="handle">
                {t("admin.products.handle")}
              </label>
              <input id="handle" name="handle" className="input" dir="ltr" defaultValue={editValues.handle} />
              {edit.text("handle") ? <span className="field-error-text">{edit.text("handle")}</span> : null}
            </div>
            <div className="field">
              <label className="label" htmlFor="status">
                {t("admin.common.status")}
              </label>
              <select id="status" name="status" className="select" defaultValue={editValues.status}>
                <option value="draft">{t("admin.products.status.draft")}</option>
                <option value="published">{t("admin.products.status.published")}</option>
                <option value="archived">{t("admin.products.status.archived")}</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="description">
              {t("admin.products.description")}
            </label>
            <textarea id="description" name="description" className="textarea" rows={4} defaultValue={editValues.description} />
          </div>

          <div className="field">
            <label className="label" htmlFor="category_id">
              {t("admin.products.category")}
            </label>
            <select
              id="category_id"
              name="category_id"
              className="select"
              defaultValue={editValues.category_id ?? ""}
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
                defaultValue={editValues.compare_at_price}
              />
            </div>
          ) : null}

          <div className="field">
            <label className="checkbox-field">
              <input
                type="checkbox"
                name="is_featured"
                value="true"
                defaultChecked={editValues.is_featured === "true"}
              />
              <span className="text-sm">{t("admin.products.featured")}</span>
            </label>
          </div>

          <ProductImageManager
            locale={locale}
            existing={product.images}
            initialThumbnail={product.thumbnail}
          />

          <ProductVariantsManager
            locale={locale}
            currencyCode={currencyCode}
            existingOptions={product.options}
            existingVariants={product.variants}
            onHasVariantsChange={setHasVariants}
          />

          <div className="form-actions">
            <SubmitButton pendingLabel={t("admin.common.saving")} className="btn btn-primary">
              {t("admin.common.save")}
            </SubmitButton>
          </div>
        </form>

        <div className="form-actions">
          {product.status !== "published" ? (
            <form action={productStatusAction} className="inline-form">
              <input type="hidden" name="id" value={product.id} />
              <input type="hidden" name="status" value="published" />
              <SubmitButton className="btn btn-outline btn-sm">{t("admin.products.publish")}</SubmitButton>
            </form>
          ) : (
            <form action={productStatusAction} className="inline-form">
              <input type="hidden" name="id" value={product.id} />
              <input type="hidden" name="status" value="draft" />
              <SubmitButton className="btn btn-outline btn-sm">{t("admin.products.unpublish")}</SubmitButton>
            </form>
          )}
          {product.status !== "archived" ? (
            <form action={productStatusAction} className="inline-form">
              <input type="hidden" name="id" value={product.id} />
              <input type="hidden" name="status" value="archived" />
              <SubmitButton className="btn btn-outline btn-sm">{t("admin.products.archive")}</SubmitButton>
            </form>
          ) : null}
          <form action={deleteProductAction} className="inline-form">
            <input type="hidden" name="id" value={product.id} />
            <ConfirmSubmit message={t("admin.products.deleteConfirm")} className="btn btn-outline btn-sm btn-danger">
              {t("admin.common.delete")}
            </ConfirmSubmit>
          </form>
        </div>
      </section>
    </div>
  )
}
