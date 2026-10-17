import { LOCALE_TAG, type Locale } from "@/lib/i18n/locales"

/** Formats an ISO timestamp for the admin tables (server-rendered). */
export function formatDateTime(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

export type StatusTone = "default" | "info" | "success" | "warning" | "danger"

/**
 * Maps an order / shipment / collection / reservation status to a badge tone so
 * the list reads at a glance: amber = needs action, blue = in progress, green =
 * done, red = problem, grey = neutral.
 */
export function toneForStatus(status: string): StatusTone {
  if (
    status === "delivered" ||
    status === "cod_remitted" ||
    status === "cod_collected" ||
    status === "committed"
  ) {
    return "success"
  }
  if (
    status === "cancelled" ||
    status === "returned" ||
    status === "failed" ||
    status === "delivery_failed" ||
    status === "wrong_number"
  ) {
    return "danger"
  }
  if (
    status === "pending_confirmation" ||
    status === "cod_pending" ||
    status === "held" ||
    status === "no_answer"
  ) {
    return "warning"
  }
  if (
    status === "confirmed" ||
    status === "preparing" ||
    status === "dispatched" ||
    status === "shipped"
  ) {
    return "info"
  }
  return "default"
}
