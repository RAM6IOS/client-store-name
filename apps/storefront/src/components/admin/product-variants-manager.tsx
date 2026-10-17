"use client"

import { useEffect, useState } from "react"
import { createTranslator } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/locales"
import type { ProductOption, ProductVariant } from "@/lib/api-types"
import { minorToMajorInput } from "@/lib/admin/money-input"

export interface VariantRowData {
  title: string
  price: string
  compare_at: string
  initial_stock: string
  sku: string
  is_active: boolean
}

export interface OptionData {
  id: string
  name: string
  values: string[]
}

export function ProductVariantsManager({
  locale,
  currencyCode,
  existingOptions,
  existingVariants,
  onHasVariantsChange,
}: {
  locale: Locale
  currencyCode: string
  existingOptions?: ProductOption[]
  existingVariants?: ProductVariant[]
  onHasVariantsChange?: (hasVariants: boolean) => void
}) {
  const t = createTranslator(locale)

  const [hasVariants, setHasVariants] = useState(
    Boolean(
      (existingOptions && existingOptions.length > 0) ||
      (existingVariants && existingVariants.length > 0)
    )
  )
  const [options, setOptions] = useState<OptionData[]>(() => {
    if (existingOptions && existingOptions.length > 0) {
      return existingOptions.map((o) => ({
        id: o.id,
        name: o.title,
        values: o.values.map((v) => v.value),
      }))
    }
    if (existingVariants && existingVariants.length > 0) {
      const partsMap: string[][] = []
      for (const v of existingVariants) {
        const parts = v.title.split(" / ").map((p) => p.trim()).filter(Boolean)
        parts.forEach((part, idx) => {
          if (!partsMap[idx]) partsMap[idx] = []
          if (!partsMap[idx].includes(part)) {
            partsMap[idx].push(part)
          }
        })
      }
      if (partsMap.length > 0) {
        return partsMap.map((values, idx) => ({
          id: `opt-${idx + 1}`,
          name: idx === 0 ? "الخيار 1" : `الخيار ${idx + 1}`,
          values,
        }))
      }
    }
    return []
  })
  const [newValueInputs, setNewValueInputs] = useState<Record<string, string>>({})
  const [variants, setVariants] = useState<VariantRowData[]>(() => {
    if (existingVariants && existingVariants.length > 0) {
      return existingVariants.map((v) => ({
        title: v.title,
        price: minorToMajorInput(v.price_amount),
        compare_at: minorToMajorInput(v.compare_at_amount),
        initial_stock: v.inventory_item ? String(v.inventory_item.stocked_quantity) : "0",
        sku: v.sku ?? "",
        is_active: v.is_active,
      }))
    }
    return []
  })

  // Let the parent hide fields that only apply to simple products (such as the
  // product-level compare-at price) while this product is variant-based.
  useEffect(() => {
    onHasVariantsChange?.(hasVariants)
  }, [hasVariants, onHasVariantsChange])

  function addOption() {
    setOptions((prev) => [
      ...prev,
      { id: Date.now().toString(), name: "", values: [] },
    ])
  }

  function removeOption(id: string) {
    setOptions((prev) => prev.filter((o) => o.id !== id))
  }

  function updateOptionName(id: string, name: string) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, name } : o)))
  }

  function addValue(optionId: string) {
    const val = (newValueInputs[optionId] ?? "").trim()
    if (!val) return
    setOptions((prev) =>
      prev.map((o) => {
        if (o.id !== optionId) return o
        if (o.values.includes(val)) return o
        return { ...o, values: [...o.values, val] }
      }),
    )
    setNewValueInputs((prev) => ({ ...prev, [optionId]: "" }))
  }

  function removeValue(optionId: string, valToRemove: string) {
    setOptions((prev) =>
      prev.map((o) =>
        o.id === optionId
          ? { ...o, values: o.values.filter((v) => v !== valToRemove) }
          : o,
      ),
    )
  }

  function generateVariants() {
    const validOptions = options.filter(
      (opt) => opt.name.trim() && opt.values.length > 0,
    )
    if (validOptions.length === 0) return

    const arrays = validOptions.map((opt) => opt.values)
    const combinations = arrays.reduce<string[][]>(
      (acc, curr) => acc.flatMap((x) => curr.map((y) => [...x, y])),
      [[]],
    )

    const newVariants: VariantRowData[] = combinations.map((combo) => {
      const title = combo.join(" / ")
      const existing = variants.find((v) => v.title === title)
      return {
        title,
        price: existing?.price ?? "",
        compare_at: existing?.compare_at ?? "",
        initial_stock: existing?.initial_stock ?? "0",
        sku: existing?.sku ?? "",
        is_active: existing?.is_active ?? true,
      }
    })
    setVariants(newVariants)
  }

  function updateVariantField(
    index: number,
    field: keyof VariantRowData,
    value: string | boolean,
  ) {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
    )
  }

  function removeVariant(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="stack" style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1rem", marginTop: "1rem" }}>
      <div className="field" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <input
          type="checkbox"
          id="has_variants"
          name="has_variants"
          checked={hasVariants}
          onChange={(e) => setHasVariants(e.target.checked)}
          style={{ width: "1.2rem", height: "1.2rem", cursor: "pointer" }}
        />
        <label htmlFor="has_variants" className="label" style={{ margin: 0, cursor: "pointer", fontWeight: 600 }}>
          {t("admin.products.hasVariants")}
        </label>
      </div>

      {hasVariants ? (
        <div className="stack card card-pad" style={{ background: "var(--color-surface)" }}>
          <input
            type="hidden"
            name="options_json"
            value={JSON.stringify(options)}
          />
          <h3 style={{ margin: 0, fontSize: "1.05rem" }}>{t("admin.products.variantsSection")}</h3>

          {options.map((opt, optIdx) => (
            <div key={opt.id} className="card card-pad stack" style={{ background: "#fff" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="text"
                  className="input"
                  placeholder={t("admin.products.optionName")}
                  value={opt.name}
                  onChange={(e) => updateOptionName(opt.id, e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-outline btn-sm btn-danger"
                  onClick={() => removeOption(opt.id)}
                >
                  {t("admin.common.delete")}
                </button>
              </div>

              <div className="row wrap" style={{ gap: "0.5rem", alignItems: "center" }}>
                {opt.values.map((val) => (
                  <span
                    key={val}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "4px",
                      fontSize: "0.85rem",
                    }}
                  >
                    {val}
                    <button
                      type="button"
                      onClick={() => removeValue(opt.id, val)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "bold", color: "var(--color-danger)" }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  className="input"
                  placeholder={t("admin.products.optionValuePlaceholder")}
                  value={newValueInputs[opt.id] ?? ""}
                  onChange={(e) =>
                    setNewValueInputs((prev) => ({ ...prev, [opt.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addValue(opt.id)
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => addValue(opt.id)}
                >
                  {t("admin.products.addValue")}
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={addOption}
            style={{ alignSelf: "flex-start" }}
          >
            + {t("admin.products.addOption")}
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={generateVariants}
          >
            {t("admin.products.generateVariants")}
          </button>

          {variants.length > 0 ? (
            <div className="stack" style={{ overflowX: "auto" }}>
              <h4 style={{ margin: 0 }}>{t("admin.products.variantsTable")}</h4>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
                    <th style={{ padding: "0.5rem" }}>{t("admin.products.variantTitle")}</th>
                    <th style={{ padding: "0.5rem" }}>{t("admin.products.variantPrice")} ({currencyCode})</th>
                    <th style={{ padding: "0.5rem" }}>{t("admin.products.variantCompareAt")} ({currencyCode})</th>
                    <th style={{ padding: "0.5rem" }}>{t("admin.products.variantStock")}</th>
                    <th style={{ padding: "0.5rem" }}>{t("admin.products.variantSku")}</th>
                    <th style={{ padding: "0.5rem" }}>{t("admin.products.variantActive")}</th>
                    <th style={{ padding: "0.5rem" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((variant, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "0.5rem" }}>
                        <input
                          type="text"
                          className="input"
                          value={variant.title}
                          onChange={(e) => updateVariantField(idx, "title", e.target.value)}
                        />
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        <input
                          type="text"
                          className="input"
                          placeholder="0.00"
                          value={variant.price}
                          onChange={(e) => updateVariantField(idx, "price", e.target.value)}
                          required={variant.is_active}
                        />
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        <input
                          type="text"
                          className="input"
                          inputMode="decimal"
                          placeholder="—"
                          value={variant.compare_at}
                          onChange={(e) => updateVariantField(idx, "compare_at", e.target.value)}
                        />
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        <input
                          type="number"
                          className="input"
                          min={0}
                          value={variant.initial_stock}
                          onChange={(e) => updateVariantField(idx, "initial_stock", e.target.value)}
                        />
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        <input
                          type="text"
                          className="input"
                          dir="ltr"
                          value={variant.sku}
                          onChange={(e) => updateVariantField(idx, "sku", e.target.value)}
                        />
                      </td>
                      <td style={{ padding: "0.5rem", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={variant.is_active}
                          onChange={(e) => updateVariantField(idx, "is_active", e.target.checked)}
                        />
                      </td>
                      <td style={{ padding: "0.5rem", textAlign: "center" }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm btn-danger"
                          onClick={() => removeVariant(idx)}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <input
                type="hidden"
                name="variants_json"
                value={JSON.stringify(variants.filter((v) => v.is_active))}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
