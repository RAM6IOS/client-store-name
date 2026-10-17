"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import type {
  Commune,
  DeliveryMethod,
  DeliveryMethodOption,
  DeliveryQuote,
  OrderPublic,
  StopDesk,
} from "@/lib/api-types"
import {
  API_ERROR_CODES,
  createCheckout,
  deliveryMethods,
  deliveryQuote,
  isApiError,
  listCommunes,
  stopDesks,
} from "@/lib/api"
import { clearCheckoutKey, getOrCreateCheckoutKey } from "@/lib/checkout-key"
import { cartSignature } from "@/lib/idempotency"
import type { Locale } from "@/lib/i18n/locales"
import type { Translate } from "@/lib/i18n"
import { useI18n } from "@/lib/i18n/context"
import { isValidPhoneFormat } from "@/lib/phone"

export type QuoteState = "idle" | "loading" | "ready" | "unavailable" | "error"

export interface OrderLineInput {
  variantId: string
  quantity: number
}

interface UseOrderFormParams {
  /** Lines submitted with the order (single product or whole cart). */
  lines: OrderLineInput[]
  /** Precomputed item subtotal in minor units. */
  subtotal: bigint
  currency: string
  /** False until any async prerequisites (e.g. cart hydration) are available. */
  ready?: boolean
}

function communeName(commune: Commune, locale: Locale): string {
  return locale === "ar" ? commune.name_ar : commune.name_fr
}

/**
 * Owns the Algeria COD order form: destination lookups, server-authoritative
 * delivery quotes, validation and submission. Shared by the cart checkout page
 * and the inline product-page order form so both flows stay identical.
 *
 * Because both flows can run side by side conceptually, `lines` is supplied by
 * the caller; the hook never reads the cart directly.
 */
export function useOrderForm({ lines, subtotal, currency, ready = true }: UseOrderFormParams) {
  const { t, locale } = useI18n()

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [wilayaCode, setWilayaCode] = useState("")
  const [communeCode, setCommuneCode] = useState("")
  const [addressLine, setAddressLine] = useState("")
  const [landmark, setLandmark] = useState("")
  const [notes, setNotes] = useState("")
  const [stopDeskId, setStopDeskId] = useState("")
  const [stopDeskName, setStopDeskName] = useState("")

  const [methods, setMethods] = useState<DeliveryMethodOption[]>([])
  const [desks, setDesks] = useState<StopDesk[]>([])
  const [communes, setCommunes] = useState<Commune[]>([])
  const [method, setMethod] = useState<DeliveryMethod>("home")
  const [loadingDestination, setLoadingDestination] = useState(false)

  const [quote, setQuote] = useState<DeliveryQuote | null>(null)
  const [quoteState, setQuoteState] = useState<QuoteState>("idle")

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Load communes, delivery methods and stop desks whenever the wilaya changes.
  useEffect(() => {
    if (!wilayaCode || !ready) {
      setCommunes([])
      setMethods([])
      setDesks([])
      setCommuneCode("")
      setStopDeskId("")
      return
    }
    let cancelled = false
    setLoadingDestination(true)
    setCommuneCode("")
    setStopDeskId("")
    setStopDeskName("")

    Promise.all([
      deliveryMethods(wilayaCode, currency).catch(() => [] as DeliveryMethodOption[]),
      stopDesks(wilayaCode).catch(() => ({
        data: [] as StopDesk[],
        total: 0,
        provider_configured: false,
      })),
      listCommunes(wilayaCode, { pageSize: 200 }).catch(() => null),
    ])
      .then(([methodList, deskResult, communeResult]) => {
        if (cancelled) return
        setMethods(methodList)
        setDesks(deskResult.data)
        setCommunes(communeResult?.data ?? [])
        const homeAvailable = methodList.some((item) => item.method === "home" && item.available)
        const stopAvailable = methodList.some((item) => item.method === "stop_desk" && item.available)
        setMethod(homeAvailable ? "home" : stopAvailable ? "stop_desk" : "home")
      })
      .finally(() => {
        if (!cancelled) setLoadingDestination(false)
      })

    return () => {
      cancelled = true
    }
  }, [wilayaCode, currency, ready])

  const homeAvailable = methods.some((item) => item.method === "home" && item.available)
  const stopDeskAvailable = methods.some((item) => item.method === "stop_desk" && item.available)
  const anyMethodAvailable = homeAvailable || stopDeskAvailable

  // Fetch a server-authoritative quote for the selected destination + method.
  useEffect(() => {
    if (!wilayaCode) {
      setQuote(null)
      setQuoteState("idle")
      return
    }
    const option = methods.find((item) => item.method === method)
    if (!option || !option.available) {
      setQuote(null)
      setQuoteState("unavailable")
      return
    }
    let cancelled = false
    setQuoteState("loading")
    deliveryQuote({ wilaya_code: wilayaCode, method, currency_code: currency })
      .then((result) => {
        if (cancelled) return
        setQuote(result)
        setQuoteState("ready")
      })
      .catch((error) => {
        if (cancelled) return
        setQuote(null)
        setQuoteState(
          isApiError(error) && error.code === API_ERROR_CODES.DELIVERY_UNAVAILABLE
            ? "unavailable"
            : "error",
        )
      })
    return () => {
      cancelled = true
    }
  }, [wilayaCode, method, methods, desks, currency])

  const selectedCommune = useMemo(
    () => communes.find((commune) => commune.post_code === communeCode) ?? null,
    [communes, communeCode],
  )

  const deliveryFee = quoteState === "ready" && quote ? quote.feeAmount : null
  const total = deliveryFee !== null ? subtotal + BigInt(deliveryFee) : subtotal

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = t("checkout.required")
    if (!isValidPhoneFormat(phone)) next.phone = t("checkout.invalidPhone")
    if (!wilayaCode) next.wilaya = t("checkout.selectWilayaError")
    if (!communeCode) next.commune = t("checkout.selectCommuneError")
    if (method === "home" && !addressLine.trim()) next.address = t("checkout.addressRequired")
    if (method === "stop_desk" && !stopDeskId && !stopDeskName.trim()) next.stopDesk = t("checkout.stopDeskRequired")
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit(event?: FormEvent): Promise<OrderPublic | null> {
    event?.preventDefault()
    if (!validate()) return null

    if (quoteState !== "ready") {
      if (!wilayaCode) {
        setErrors((prev) => ({ ...prev, wilaya: t("checkout.selectWilayaError") }))
      } else {
        setSubmitError(t("checkout.quoteLoading"))
      }
      return null
    }

    const signature = cartSignature(lines)
    const idempotencyKey = getOrCreateCheckoutKey(signature)
    const desk = desks.find((candidate) => candidate.id === stopDeskId) ?? null

    setSubmitting(true)
    setSubmitError(null)

    try {
      const order = await createCheckout({
        idempotency_key: idempotencyKey,
        currency_code: currency,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        delivery_method: method,
        wilaya_code: wilayaCode,
        commune: selectedCommune ? communeName(selectedCommune, locale) : "",
        commune_code: selectedCommune?.post_code,
        address_line: method === "home" ? addressLine.trim() : undefined,
        nearby_landmark: landmark.trim() || undefined,
        notes: notes.trim() || undefined,
        stop_desk_id: method === "stop_desk" ? desk?.id : undefined,
        stop_desk_name: method === "stop_desk" ? ((desk?.name ?? stopDeskName.trim()) || undefined) : undefined,
        stop_desk_address: method === "stop_desk" ? (desk?.address ?? undefined) : undefined,
        items: lines.map((line) => ({ variant_id: line.variantId, quantity: line.quantity })),
      })
      clearCheckoutKey()
      return order
    } catch (error) {
      setSubmitError(mapSubmitError(error, t))
      return null
    } finally {
      setSubmitting(false)
    }
  }

  return {
    name,
    setName,
    phone,
    setPhone,
    wilayaCode,
    setWilayaCode,
    communeCode,
    setCommuneCode,
    addressLine,
    setAddressLine,
    landmark,
    setLandmark,
    notes,
    setNotes,
    stopDeskId,
    setStopDeskId,
    stopDeskName,
    setStopDeskName,
    methods,
    desks,
    communes,
    method,
    setMethod,
    loadingDestination,
    quote,
    quoteState,
    homeAvailable,
    stopDeskAvailable,
    anyMethodAvailable,
    selectedCommune,
    subtotal,
    deliveryFee,
    total,
    currency,
    errors,
    submitError,
    submitting,
    submit,
  }
}

export type OrderForm = ReturnType<typeof useOrderForm>

/** Maps API failures to a localized, user-facing message. */
function mapSubmitError(error: unknown, t: Translate): string {
  if (isApiError(error)) {
    switch (error.code) {
      case API_ERROR_CODES.INSUFFICIENT_STOCK:
        return t("checkout.errorStock")
      case API_ERROR_CODES.DELIVERY_UNAVAILABLE:
        return t("checkout.errorDeliveryUnavailable")
      case API_ERROR_CODES.INVALID_LOCATION:
        return t("checkout.errorDeliveryInvalid")
      case API_ERROR_CODES.VALIDATION:
        return t("checkout.errorValidation")
      case API_ERROR_CODES.NETWORK:
        return t("checkout.errorNetwork")
      default:
        break
    }
  }
  return t("checkout.errorGeneric")
}
