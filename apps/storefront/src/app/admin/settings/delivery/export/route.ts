import { redirect } from "next/navigation"
import { ApiError } from "@/lib/api"
import { getAdminSettings, listAdminDeliveryRates } from "@/lib/admin/client"
import { minorToMajorInput } from "@/lib/admin/money-input"
import { getAdminKey } from "@/lib/admin/session"

/** Escapes a CSV cell: quotes when it contains a comma, quote, or newline. */
function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Streams the current delivery-rate configuration as CSV. Read-only; the fee is
 * written in major units so the file round-trips through the import form.
 */
export async function GET(): Promise<Response> {
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  let rates
  let currencyCode = "DZD"
  try {
    const [rateList, settings] = await Promise.all([
      listAdminDeliveryRates(key),
      getAdminSettings(key),
    ])
    rates = rateList.data
    currencyCode = settings.base_currency
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      redirect("/admin/login")
    }
    return new Response("export_failed", { status: 502 })
  }

  const header = ["wilaya_code", "method", "fee", "is_active", "label"].join(",")
  const lines = rates.map((rate) =>
    [
      rate.wilaya_code,
      rate.method,
      minorToMajorInput(rate.fee_amount),
      rate.is_active ? "1" : "0",
      csvCell(rate.label ?? ""),
    ].join(","),
  )
  const body = `\uFEFF${[header, ...lines].join("\n")}\n`

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="delivery-rates-${currencyCode}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
