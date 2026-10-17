"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ApiError } from "@/lib/api"
import {
  addAdminProductImage,
  addAdminVariant,
  adminOrderAction,
  createAdminProduct,
  deleteAdminProduct,
  deleteAdminProductImage,
  deleteAdminVariant,
  setAdminOrderStatus,
  updateAdminProduct,
  updateAdminVariant,
  uploadAdminProductImages,
  upsertAdminDeliveryRatesBatch,
  verifyAdminKey,
} from "@/lib/admin/client"
import { minorToMajorInput, parseMajorToMinor } from "@/lib/admin/money-input"
import {
  collectRateDrafts,
  parseRatesCsv,
} from "@/lib/admin/delivery-rates"
import {
  collectFormValues,
  type ActionState,
  type FieldErrors,
} from "@/lib/admin/action-state"
import { ORDER_STATUSES } from "@/lib/admin/query"
import { clearAdminKey, getAdminKey, setAdminKey } from "@/lib/admin/session"
import type { AdminOrderAction } from "@/lib/admin/types"
import { translate } from "@/lib/i18n"
import type { TranslationKey } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/server"
import type { OrderStatus, ProductStatus } from "@/lib/api-types"

const ORDER_ACTIONS: AdminOrderAction[] = [
  "confirm",
  "prepare",
  "dispatch",
  "transit",
  "deliver",
  "delivery-failed",
  "return",
  "cancel",
  "no-answer",
  "wrong-number",
]

const PRODUCT_ERROR_MESSAGES: Record<string, string> = {
  DUPLICATE_SKU: "admin.products.errors.sku",
  DUPLICATE_HANDLE: "admin.products.errors.handle",
  UNKNOWN_CURRENCY: "admin.products.errors.currency",
  INVALID_PRICE: "admin.products.errors.price",
  INVALID_STOCK: "admin.products.errors.stock",
  VALIDATION_ERROR: "admin.products.errors.validation",
  HISTORY_EXISTS: "admin.products.deleteHistory",
}

function isOrderAction(value: string): value is AdminOrderAction {
  return (ORDER_ACTIONS as string[]).includes(value)
}

function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as string[]).includes(value)
}

function safeBack(value: FormDataEntryValue | null): string {
  const raw = typeof value === "string" ? value.trim() : ""
  // Only ever accept an internal admin query string, never an absolute URL.
  if (!raw || !raw.startsWith("?") || raw.includes("://")) return ""
  return raw
}

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim()
}

function optionalText(formData: FormData, name: string): string | undefined {
  const value = text(formData, name)
  return value || undefined
}

function intOrUndefined(formData: FormData, name: string): number | undefined {
  const raw = text(formData, name)
  if (!raw) return undefined
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined
}

/** Files submitted alongside a product form; empty placeholders are ignored. */
function collectFiles(formData: FormData): File[] {
  return formData.getAll("files").filter((value): value is File => value instanceof File && value.size > 0)
}

/** Existing image ids the operator removed in the current edit session. */
function collectRemovedImageIds(formData: FormData): string[] {
  return formData
    .getAll("remove_image_ids")
    .map((value) => String(value).trim())
    .filter(Boolean)
}

/** Picks the uploaded image the operator marked as primary (fallback: first). */
function primaryUploadUrl(images: { url: string }[], index: number | undefined): string | undefined {
  if (index !== undefined && index >= 0 && index < images.length) return images[index].url
  return images[0]?.url
}

function imageErrorKey(error: unknown): TranslationKey {
  if (error instanceof ApiError) {
    if (error.code === "FILE_TOO_LARGE") return "admin.products.image.errors.tooLarge"
    if (error.code === "IMAGE_COUNT_EXCEEDED" || error.code === "FILE_COUNT_EXCEEDED") {
      return "admin.products.image.errors.count"
    }
    if (error.code === "INVALID_IMAGE") return "admin.products.image.errors.invalid"
  }
  return "admin.products.image.errors.upload"
}

async function failure(
  formData: FormData,
  messageKey: TranslationKey,
  errors?: FieldErrors,
): Promise<ActionState> {
  const locale = await getLocale()
  return {
    ok: false,
    message: translate(locale, messageKey),
    errors,
    values: collectFormValues(formData),
  }
}

function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403)
}

function productErrorMessage(error: unknown): TranslationKey {
  if (error instanceof ApiError) {
    return (PRODUCT_ERROR_MESSAGES[error.code] ?? "admin.products.errors.save") as TranslationKey
  }
  return "admin.products.errors.save"
}

export async function loginAction(formData: FormData): Promise<void> {
  const key = String(formData.get("key") ?? "").trim()
  if (!key) redirect("/admin/login?error=invalid")

  const result = await verifyAdminKey(key)
  if (result !== "ok") {
    redirect(`/admin/login?error=${result === "unavailable" ? "unavailable" : "invalid"}`)
  }

  await setAdminKey(key)
  redirect("/admin/orders")
}

export async function logoutAction(): Promise<void> {
  await clearAdminKey()
  redirect("/admin/login")
}

export async function orderAction(formData: FormData): Promise<void> {
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  const id = String(formData.get("id") ?? "").trim()
  const action = String(formData.get("action") ?? "").trim()
  const back = safeBack(formData.get("back"))
  const backSuffix = back ? `&back=${encodeURIComponent(back)}` : ""

  if (!id || !isOrderAction(action)) {
    redirect(`/admin/orders${back ? back : ""}`)
  }

  const actor = String(formData.get("actor") ?? "").trim() || "admin"
  const note = String(formData.get("note") ?? "").trim() || undefined
  const reason = String(formData.get("reason") ?? "").trim() || undefined

  try {
    await adminOrderAction(key, id, action, { actor, note, reason })
  } catch (error) {
    const code =
      error instanceof ApiError && error.status === 401
        ? "unauthorized"
        : error instanceof ApiError && error.code === "INVALID_TRANSITION"
          ? "invalidTransition"
          : "error"
    redirect(`/admin/orders/${id}?error=${code}${backSuffix}`)
  }

  revalidatePath(`/admin/orders/${id}`)
  revalidatePath("/admin/orders")
  revalidatePath("/admin/customers")
  revalidatePath("/admin")
  redirect(`/admin/orders/${id}?updated=${action}${backSuffix}`)
}

/**
 * Inline status change from the orders list. Unlike `orderAction` it targets the
 * generic `PATCH /orders/:id/status` endpoint so the dropdown can jump to any
 * transition the state machine allows. `back` carries the list query string so
 * the operator returns to the same filtered view.
 */
export async function orderStatusAction(formData: FormData): Promise<void> {
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  const id = String(formData.get("id") ?? "").trim()
  const toStatus = String(formData.get("to_status") ?? "").trim()
  const back = safeBack(formData.get("back"))
  const listHref = `/admin/orders${back}`
  const join = back ? "&" : "?"

  if (!id || !isOrderStatus(toStatus)) {
    redirect(back ? listHref : "/admin/orders")
  }

  const actor = String(formData.get("actor") ?? "").trim() || "admin"
  const note = String(formData.get("note") ?? "").trim() || undefined

  try {
    await setAdminOrderStatus(key, id, toStatus, { actor, note })
  } catch (error) {
    if (isAuthError(error)) redirect("/admin/login")
    const code =
      error instanceof ApiError && error.code === "INVALID_TRANSITION"
        ? "invalidTransition"
        : "error"
    redirect(`${back ? listHref : `/admin/orders/${id}`}${join}error=${code}`)
  }

  revalidatePath("/admin/orders")
  revalidatePath(`/admin/orders/${id}`)
  revalidatePath("/admin/customers")
  revalidatePath("/admin")
  redirect(back ? listHref : `/admin/orders/${id}`)
}

// ─────────────────────────────── Products ──────────────────────────────────

const PRODUCT_STATUSES: ProductStatus[] = ["draft", "published", "archived"]

function isProductStatus(value: string): value is ProductStatus {
  return (PRODUCT_STATUSES as string[]).includes(value)
}

/**
 * Converts a variant compare-at input (major units) into the API's decimal
 * major-unit string. An empty value clears the discount (`null`); an invalid
 * value throws so the caller can reject the submission.
 */
function mapVariantCompareAt(raw: unknown): string | null {
  const value = String(raw ?? "").trim()
  if (value === "") return null
  const minor = parseMajorToMinor(value)
  if (minor === undefined || minor === null) throw new Error("INVALID_VARIANT_COMPARE")
  return minorToMajorInput(minor)
}

export async function createProductAction(
  previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  const title = text(formData, "title")
  if (!title) return failure(formData, "admin.products.errors.title", { title: "admin.products.errors.title" })

  const currencyCode = text(formData, "currency_code") || "DZD"
  const status = text(formData, "status")
  const files = collectFiles(formData)

  const optionsJson = text(formData, "options_json")
  let options: any[] | undefined = undefined
  if (optionsJson) {
    try {
      const parsed = JSON.parse(optionsJson)
      if (Array.isArray(parsed)) {
        options = parsed.map((o: any) => ({
          title: String(o.name ?? "").trim(),
          values: Array.isArray(o.values) ? o.values.map((v: string) => ({ value: String(v).trim() })) : [],
        }))
      }
    } catch {}
  }

  const variantsJson = text(formData, "variants_json")
  let variants: any[] | undefined = undefined
  if (variantsJson) {
    try {
      const parsed = JSON.parse(variantsJson)
      if (Array.isArray(parsed) && parsed.length > 0) {
        variants = parsed.map((v: any, idx: number) => {
          const vPriceMinor = parseMajorToMinor(String(v.price ?? ""))
          if (vPriceMinor === undefined || vPriceMinor === null) {
            throw new Error("INVALID_VARIANT_PRICE")
          }
          return {
            title: String(v.title ?? "").trim(),
            sku: v.sku ? String(v.sku).trim() : undefined,
            // The API's `price` field is a decimal in major units, so convert
            // the parsed minor-unit amount back before sending it.
            price: minorToMajorInput(vPriceMinor),
            compare_at_price: mapVariantCompareAt(v.compare_at),
            currency_code: currencyCode,
            initial_stock: v.initial_stock !== undefined ? Number(v.initial_stock) : 0,
            is_default: idx === 0,
            position: idx,
          }
        })
      }
    } catch (e: any) {
      if (e.message === "INVALID_VARIANT_PRICE") {
        return failure(formData, "admin.products.errors.price", { price: "admin.products.errors.price" })
      }
      if (e.message === "INVALID_VARIANT_COMPARE") {
        return failure(formData, "admin.products.errors.compareAt", { compare_at_price: "admin.products.errors.compareAt" })
      }
      return failure(formData, "admin.products.errors.variantsRequired", { variants: "admin.products.errors.variantsRequired" })
    }
  }

  const priceText = text(formData, "price")
  const priceMinor = priceText ? parseMajorToMinor(priceText) : variants || options ? "0" : undefined
  if (!variants && !options && (priceMinor === undefined || priceMinor === null)) {
    return failure(formData, "admin.products.errors.price", { price: "admin.products.errors.price" })
  }
  // The API's `price` field is a decimal in major units (ADR-0005 stores minor
  // units); convert the parsed minor-unit amount back before sending it.
  const priceMajor = priceMinor == null ? undefined : minorToMajorInput(priceMinor)

  let productId: string
  try {
    const categoryId = optionalText(formData, "category_id")
    const product = await createAdminProduct(key, {
      title,
      handle: optionalText(formData, "handle"),
      description: optionalText(formData, "description"),
      status: isProductStatus(status) ? status : undefined,
      thumbnail: optionalText(formData, "thumbnail"),
      currency_code: currencyCode,
      price: priceMajor ?? "0",
      compare_at_price: optionalText(formData, "compare_at_price"),
      sku: optionalText(formData, "sku"),
      initial_stock: intOrUndefined(formData, "initial_stock"),
      categories: categoryId ? [{ category_id: categoryId, position: 0 }] : undefined,
      is_featured: formData.get("is_featured") != null,
      variants,
      options,
    })
    productId = product.id
  } catch (error) {
    if (isAuthError(error)) redirect("/admin/login")
    return failure(formData, productErrorMessage(error))
  }

  if (files.length > 0) {
    try {
      const uploaded = await uploadAdminProductImages(key, productId, files)
      const primaryUrl = primaryUploadUrl(uploaded, intOrUndefined(formData, "primary_file_index"))
      // Keep the thumbnail in sync with the image the operator marked primary.
      if (primaryUrl) await updateAdminProduct(key, productId, { thumbnail: primaryUrl })
    } catch (error) {
      if (isAuthError(error)) redirect("/admin/login")
      // The product exists; send the operator to its edit page to retry the
      // upload instead of discarding the whole record.
      revalidatePath("/admin/products")
      redirect(`/admin/products/${productId}?error=image`)
    }
  }

  revalidatePath("/admin/products")
  revalidatePath("/admin")
  redirect(`/admin/products/${productId}?created=1`)
}

export async function updateProductAction(
  previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  const id = text(formData, "id")
  const title = text(formData, "title")
  if (!id) redirect("/admin/products")
  if (!title) return failure(formData, "admin.products.errors.title", { title: "admin.products.errors.title" })

  const status = text(formData, "status")
  const files = collectFiles(formData)
  const removedImageIds = collectRemovedImageIds(formData)
  const thumbnail = text(formData, "thumbnail")

  const optionsJson = text(formData, "options_json")
  let options: any[] | undefined = undefined
  if (optionsJson !== "") {
    try {
      const parsed = JSON.parse(optionsJson)
      if (Array.isArray(parsed)) {
        options = parsed.map((o: any) => ({
          title: String(o.name ?? "").trim(),
          values: Array.isArray(o.values) ? o.values.map((v: string) => ({ value: String(v).trim() })) : [],
        }))
      }
    } catch {}
  }

  const currencyCode = "DZD"
  const variantsJson = text(formData, "variants_json")
  let variants: any[] | undefined = undefined
  if (variantsJson) {
    try {
      const parsed = JSON.parse(variantsJson)
      if (Array.isArray(parsed)) {
        variants = parsed.map((v: any, idx: number) => {
          return {
            title: String(v.title ?? "").trim(),
            sku: v.sku ? String(v.sku).trim() : undefined,
            price: String(v.price ?? "").trim(),
            compare_at_price: mapVariantCompareAt(v.compare_at),
            currency_code: currencyCode,
            initial_stock: v.initial_stock !== undefined ? Number(v.initial_stock) : 0,
            is_active: v.is_active !== undefined ? Boolean(v.is_active) : true,
            is_default: idx === 0,
            position: idx,
          }
        })
      }
    } catch (e: any) {
      if (e.message === "INVALID_VARIANT_COMPARE") {
        return failure(formData, "admin.products.errors.compareAt", { compare_at_price: "admin.products.errors.compareAt" })
      }
    }
  }

  // Products with variants carry their discount per variant; a product-level
  // compare-at would otherwise overwrite the default variant's price.
  const hasVariants = (options?.length ?? 0) > 0 || (variants?.length ?? 0) > 0

  try {
    await updateAdminProduct(key, id, {
      title,
      handle: optionalText(formData, "handle"),
      description: text(formData, "description"),
      status: isProductStatus(status) ? status : undefined,
      thumbnail: thumbnail ? thumbnail : null,
      // The edit form always submits the field, so an empty value clears the
      // compare-at price instead of leaving a stale discount behind. Skipped for
      // variant products, whose discounts live on each variant row.
      compare_at_price: hasVariants
        ? undefined
        : formData.has("compare_at_price")
          ? text(formData, "compare_at_price") || null
          : undefined,
      categories: formData.has("category_id")
        ? (() => {
            const categoryId = text(formData, "category_id")
            return categoryId ? [{ category_id: categoryId, position: 0 }] : []
          })()
        : undefined,
      // The edit form always renders the featured checkbox; browsers omit it when
      // unchecked, so a missing value clears the flag.
      is_featured: formData.get("is_featured") != null,
      options,
      variants,
    })
  } catch (error) {
    if (isAuthError(error)) redirect("/admin/login")
    return failure(formData, productErrorMessage(error))
  }

  try {
    for (const imageId of removedImageIds) {
      await deleteAdminProductImage(key, imageId)
    }
  } catch (error) {
    if (isAuthError(error)) redirect("/admin/login")
    return failure(formData, "admin.products.image.errors.upload")
  }

  if (files.length > 0) {
    try {
      const uploaded = await uploadAdminProductImages(key, id, files)
      // Only promote an uploaded image when the operator chose one as primary;
      // otherwise an existing image may already be the intended thumbnail.
      const primaryIndex = intOrUndefined(formData, "primary_file_index")
      const primaryUrl = primaryIndex !== undefined ? uploaded[primaryIndex]?.url : undefined
      if (primaryUrl) await updateAdminProduct(key, id, { thumbnail: primaryUrl })
    } catch (error) {
      if (isAuthError(error)) redirect("/admin/login")
      return failure(formData, imageErrorKey(error))
    }
  }

  revalidatePath(`/admin/products/${id}`)
  revalidatePath("/admin/products")
  redirect(`/admin/products/${id}?saved=1`)
}

export async function productStatusAction(formData: FormData): Promise<void> {
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  const id = text(formData, "id")
  const status = text(formData, "status")
  if (!id || !isProductStatus(status)) redirect("/admin/products")

  try {
    await updateAdminProduct(key, id, { status })
  } catch (error) {
    if (isAuthError(error)) redirect("/admin/login")
    redirect(`/admin/products/${id}?error=save`)
  }

  revalidatePath(`/admin/products/${id}`)
  revalidatePath("/admin/products")
  revalidatePath("/admin")
  redirect(`/admin/products/${id}?updated=${status}`)
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  const id = text(formData, "id")
  if (!id) redirect("/admin/products")

  try {
    await deleteAdminProduct(key, id)
  } catch (error) {
    if (isAuthError(error)) redirect("/admin/login")
    const code =
      error instanceof ApiError && error.code === "HISTORY_EXISTS" ? "history" : "delete"
    redirect(`/admin/products/${id}?error=${code}`)
  }

  revalidatePath("/admin/products")
  revalidatePath("/admin")
  redirect("/admin/products?deleted=1")
}

export async function addVariantAction(
  previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  const productId = text(formData, "product_id")
  const title = text(formData, "title")
  if (!productId) redirect("/admin/products")
  if (!title) return failure(formData, "admin.products.variant.errors.title", { title: "admin.products.variant.errors.title" })

  const currencyCode = text(formData, "currency_code") || "DZD"
  const priceInput = text(formData, "price")
  const priceMinor = priceInput ? parseMajorToMinor(priceInput) : undefined
  if (priceMinor === undefined) {
    return failure(formData, "admin.products.errors.price", { price: "admin.products.errors.price" })
  }

  try {
    await addAdminVariant(key, productId, {
      title,
      sku: optionalText(formData, "sku"),
      price: priceMinor == null ? undefined : minorToMajorInput(priceMinor),
      currency_code: currencyCode,
      initial_stock: intOrUndefined(formData, "initial_stock"),
    })
  } catch (error) {
    if (isAuthError(error)) redirect("/admin/login")
    return failure(formData, productErrorMessage(error))
  }

  revalidatePath(`/admin/products/${productId}`)
  redirect(`/admin/products/${productId}?saved=1`)
}

export async function updateVariantAction(
  previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  const productId = text(formData, "product_id")
  const variantId = text(formData, "variant_id")
  if (!productId || !variantId) redirect("/admin/products")

  const title = text(formData, "title")
  if (!title) return failure(formData, "admin.products.variant.errors.title", { title: "admin.products.variant.errors.title" })

  const currencyCode = text(formData, "currency_code") || "DZD"
  const priceInput = text(formData, "price")
  const priceMinor = priceInput ? parseMajorToMinor(priceInput) : undefined
  if (priceMinor === undefined) {
    return failure(formData, "admin.products.errors.price", { price: "admin.products.errors.price" })
  }

  try {
    await updateAdminVariant(key, variantId, {
      title: title || undefined,
      sku: text(formData, "sku") || null,
      price: priceMinor == null ? undefined : minorToMajorInput(priceMinor),
      currency_code: currencyCode,
    })
  } catch (error) {
    if (isAuthError(error)) redirect("/admin/login")
    return failure(formData, productErrorMessage(error))
  }

  revalidatePath(`/admin/products/${productId}`)
  redirect(`/admin/products/${productId}?saved=1`)
}

export async function deleteVariantAction(formData: FormData): Promise<void> {
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  const productId = text(formData, "product_id")
  const variantId = text(formData, "variant_id")
  if (!productId || !variantId) redirect("/admin/products")

  try {
    await deleteAdminVariant(key, variantId)
  } catch (error) {
    if (isAuthError(error)) redirect("/admin/login")
    const code =
      error instanceof ApiError && error.code === "HISTORY_EXISTS" ? "history" : "delete"
    redirect(`/admin/products/${productId}?error=${code}`)
  }

  revalidatePath(`/admin/products/${productId}`)
  redirect(`/admin/products/${productId}?saved=1`)
}

export async function uploadImagesAction(
  previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  const productId = text(formData, "product_id")
  if (!productId) redirect("/admin/products")

  const files = formData.getAll("files").filter((v): v is File => v instanceof File && v.size > 0)
  if (files.length === 0) {
    return failure(formData, "admin.products.errors.validation")
  }

  try {
    await uploadAdminProductImages(key, productId, files)
  } catch (error) {
    if (isAuthError(error)) redirect("/admin/login")
    if (error instanceof ApiError) {
      if (error.code === "FILE_TOO_LARGE") return failure(formData, "admin.products.image.errors.tooLarge")
      if (error.code === "IMAGE_COUNT_EXCEEDED") return failure(formData, "admin.products.image.errors.count")
      if (error.code === "INVALID_IMAGE" || error.code === "FILE_COUNT_EXCEEDED") return failure(formData, "admin.products.image.errors.invalid")
    }
    return failure(formData, "admin.products.image.errors.upload")
  }

  revalidatePath(`/admin/products/${productId}`)
  redirect(`/admin/products/${productId}?saved=1`)
}

export async function deleteListedProductAction(formData: FormData): Promise<void> {
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")
  const id = text(formData, "id")
  const back = safeBack(formData.get("back"))
  const returnTo = `/admin/products${back}`
  const join = back ? "&" : "?"
  if (!id) redirect(returnTo)
  try {
    await deleteAdminProduct(key, id)
  } catch (error) {
    if (isAuthError(error)) redirect("/admin/login")
    const code = error instanceof ApiError && error.code === "HISTORY_EXISTS" ? "history" : "delete"
    redirect(`${returnTo}${join}error=${code}`)
  }
  revalidatePath("/admin/products")
  revalidatePath("/admin")
  redirect(`${returnTo}${join}deleted=1`)
}

export async function deleteImageAction(formData: FormData): Promise<void> {
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  const productId = text(formData, "product_id")
  const imageId = text(formData, "image_id")
  if (!productId || !imageId) redirect("/admin/products")

  try {
    await deleteAdminProductImage(key, imageId)
  } catch (error) {
    if (isAuthError(error)) redirect("/admin/login")
    redirect(`/admin/products/${productId}?error=delete`)
  }

  revalidatePath(`/admin/products/${productId}`)
  redirect(`/admin/products/${productId}?saved=1`)
}

// ──────────────────────────── Delivery rates ───────────────────────────────

export async function saveDeliveryRatesAction(
  previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  const collected = collectRateDrafts(formData)
  if (!collected.ok) {
    const locale = await getLocale()
    const material =
      collected.message === "invalid" || collected.message === "activeWithoutFee"
        ? "admin.delivery.errors"
        : "admin.delivery.unsaved"
    return {
      ok: false,
      message: translate(locale, material),
      errors: collected.errors,
      values: collected.values,
    }
  }

  const currencyCode = text(formData, "currency_code") || "DZD"

  try {
    await upsertAdminDeliveryRatesBatch(
      key,
      collected.rates.map(({ code, method, draft }) => ({
        wilaya_code: code,
        method,
        currency_code: currencyCode,
        fee_amount: draft.fee,
        is_active: draft.active,
        ...(draft.label ? { label: draft.label } : {}),
      })),
    )
  } catch (error) {
    if (isAuthError(error)) redirect("/admin/login")
    const locale = await getLocale()
    return {
      ok: false,
      message: translate(locale, "admin.delivery.error"),
      errors: {},
      values: collected.values,
    }
  }

  revalidatePath("/admin/settings/delivery")
  redirect("/admin/settings/delivery?saved=1")
}

export async function importDeliveryRatesAction(
  previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  const csv = String(formData.get("csv") ?? "")
  const rows = parseRatesCsv(csv)
  if (!rows || rows.length === 0) {
    return failure(formData, "admin.delivery.error")
  }

  const currencyCode = text(formData, "currency_code") || "DZD"
  try {
    await upsertAdminDeliveryRatesBatch(
      key,
      rows.map((row) => ({
        wilaya_code: row.wilaya_code,
        method: row.method,
        currency_code: currencyCode,
        fee_amount: row.fee_amount,
        is_active: row.is_active,
        ...(row.label ? { label: row.label } : {}),
      })),
    )
  } catch (error) {
    if (isAuthError(error)) redirect("/admin/login")
    return failure(formData, "admin.delivery.error")
  }

  revalidatePath("/admin/settings/delivery")
  redirect(`/admin/settings/delivery?imported=${rows.length}`)
}