/**
 * Minimal, dependency-free CSV serialisation for operational exports.
 *
 * Rules (RFC 4180): fields containing a comma, double quote, CR or LF are
 * wrapped in double quotes, and embedded quotes are doubled. Values are
 * stringified; `null`/`undefined` become empty fields. Columns are emitted in
 * the fixed order given by the caller so exports are stable and diffable.
 */

export type CsvValue = string | number | bigint | boolean | null | undefined
export type OrderExportRow = Record<string, string | number | null>

export interface CsvColumn {
  /** Row property to read. */
  key: string
  /** Header label written in the first row. */
  header: string
}

export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ""
  const text = typeof value === "bigint" ? value.toString() : String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function toCsv(
  rows: ReadonlyArray<Record<string, unknown>>,
  columns: ReadonlyArray<CsvColumn>,
): string {
  const head = columns.map((column) => escapeCsvField(column.header)).join(",")
  const body = rows.map((row) => columns.map((column) => escapeCsvField(row[column.key])).join(","))
  return [head, ...body].join("\r\n")
}

/**
 * Columns for the orders CSV export. Deliberately omits `tracking_token` and
 * the delivery-quote snapshot: the export is for operations (statuses, contact,
 * destination, amounts), not public tracking credentials. Amounts remain
 * integer minor units; `currency_code` accompanies them (ADR-0005).
 */
export const ORDER_EXPORT_COLUMNS: ReadonlyArray<CsvColumn> = [
  { key: "display_id", header: "order_id" },
  { key: "status", header: "status" },
  { key: "shipment_status", header: "shipment_status" },
  { key: "collection_status", header: "collection_status" },
  { key: "created_at", header: "created_at" },
  { key: "placed_at", header: "placed_at" },
  { key: "customer_name", header: "customer_name" },
  { key: "customer_phone", header: "customer_phone" },
  { key: "wilaya_code", header: "wilaya_code" },
  { key: "wilaya_name", header: "wilaya_name" },
  { key: "commune", header: "commune" },
  { key: "commune_code", header: "commune_code" },
  { key: "delivery_method", header: "delivery_method" },
  { key: "delivery_label", header: "delivery_label" },
  { key: "subtotal_amount", header: "subtotal_amount" },
  { key: "shipping_amount", header: "shipping_amount" },
  { key: "discount_amount", header: "discount_amount" },
  { key: "total_amount", header: "total_amount" },
  { key: "currency_code", header: "currency_code" },
]
