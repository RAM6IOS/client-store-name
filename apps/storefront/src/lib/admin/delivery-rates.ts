import { minorToMajorInput, parseMajorToMinor } from "./money-input"

/**
 * Pure helpers for the delivery-rate editor. Kept free of server-only imports
 * so the parsing/validation rules are unit-testable in the client package and
 * reused by the batch-save and CSV-import server actions.
 */

export const RATE_FIELD = /^(home|stop)_(fee|active|label)_(\d{2})$/

export interface RateDraft {
  fee: string
  active: boolean
  label?: string
}

export interface RateInput {
  code: string
  method: "home" | "stop_desk"
  draft: RateDraft
}

export type RateCollection =
  | { ok: true; rates: RateInput[]; values: Record<string, string> }
  | { ok: false; message: "invalid" | "activeWithoutFee" | "empty"; errors: Record<string, string>; values: Record<string, string> }

function field(method: "home" | "stop_desk", kind: "fee" | "active" | "label", code: string): string {
  const methodToken = method === "stop_desk" ? "stop" : "home"
  return `${methodToken}_${kind}_${code}`
}

/**
 * Reads the dynamic per-row delivery-rate inputs from the submitted form.
 * Rows without a fee are skipped (meaning "not configured") unless they are
 * toggled active, which is rejected. Any non-integer/negative fee is marked on
 * that row's field. Unchecked checkboxes are recorded as `""` in the returned
 * values so the form can faithfully restore the operator's submission.
 */
export function collectRateDrafts(entries: Iterable<[string, unknown]>): RateCollection {
  type Entry = { code: string; method: "home" | "stop_desk" } & Partial<RateDraft>
  const byKey = new Map<string, Entry>()
  const values: Record<string, string> = {}
  const presentActiveRows = new Set<string>()

  for (const [name, raw] of entries) {
    const match = RATE_FIELD.exec(name)
    if (!match) continue
    const [, methodToken, kind, code] = match
    const method = methodToken === "stop" ? "stop_desk" : "home"
    const value = typeof raw === "string" ? raw : ""
    values[name] = value
    const key = `${method}_${code}`
    const entry = byKey.get(key) ?? { code, method }
    if (kind === "fee") entry.fee = value
    else if (kind === "active") {
      entry.active = value === "on" || value === "1" || value === "true"
      presentActiveRows.add(key)
    } else entry.label = value
    byKey.set(key, entry)
  }

  const rates: RateInput[] = []
  const errors: Record<string, string> = {}
  for (const entry of byKey.values()) {
    if (entry.fee === undefined) continue
    const active = entry.active ?? false
    const feeInput = entry.fee.trim()

    // An unchecked box is absent from the form data; record the OFF state so
    // the restored form does not re-check it against the persisted value.
    if (!presentActiveRows.has(`${entry.method}_${entry.code}`)) {
      values[field(entry.method, "active", entry.code)] = ""
    }

    if (!feeInput) {
      if (active) {
        errors[field(entry.method, "active", entry.code)] = "feeRequired"
      }
      continue
    }

    const minor = parseMajorToMinor(feeInput)
    if (minor === undefined || minor === null) {
      errors[field(entry.method, "fee", entry.code)] = "invalidFee"
      continue
    }

    rates.push({
      code: entry.code,
      method: entry.method,
      draft: { fee: minor, active, label: entry.label?.trim() || undefined },
    })
  }

  const errorKeys = Object.keys(errors)
  if (errorKeys.length > 0) {
    const hasInvalid = Object.values(errors).some((message) => message === "invalidFee")
    return {
      ok: false,
      message: hasInvalid ? "invalid" : "activeWithoutFee",
      errors,
      values,
    }
  }
  if (rates.length === 0) return { ok: false, message: "empty", errors, values }
  return { ok: true, rates, values }
}

export interface ParsedCsvRow {
  wilaya_code: string
  method: "home" | "stop_desk"
  fee_amount: string
  is_active: boolean
  label?: string
}

/**
 * Minimal CSV parser for the delivery-rate import: five columns
 * `wilaya_code,method,fee,is_active,label`. Blank lines and rows beginning with
 * `#` are ignored. The fee is read in major units and converted to minor units.
 */
export function parseRatesCsv(csv: string): ParsedCsvRow[] | null {
  const rows: ParsedCsvRow[] = []
  for (const rawLine of csv.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const cells = line.split(",").map((cell) => cell.trim())
    if (cells.length < 3) return null
    const [code, methodToken, feeInput, activeToken = "1", ...labelParts] = cells
    if (!/^\d{2}$/.test(code)) return null
    if (methodToken !== "home" && methodToken !== "stop_desk") return null
    const minor = parseMajorToMinor(feeInput)
    if (minor === undefined || minor === null) return null
    rows.push({
      wilaya_code: code,
      method: methodToken,
      fee_amount: minor,
      is_active: !(activeToken === "0" || activeToken.toLowerCase() === "false"),
      label: labelParts.join(",").trim() || undefined,
    })
  }
  if (rows.length === 0) return null
  return rows
}

/** Builds the initial field-value map (major-unit fees, enabled flags) from the
 * currently persisted rates so the editor always shows live values. */
export function initialRateValues(
  rates: ReadonlyArray<{ wilaya_code: string; method: "home" | "stop_desk"; fee_amount: string | number | bigint | null; is_active: boolean; label?: string | null }>,
): Record<string, string> {
  const values: Record<string, string> = {}
  for (const rate of rates) {
    const method = rate.method === "stop_desk" ? "stop" : "home"
    values[field(rate.method, "fee", rate.wilaya_code)] = minorToMajorInput(rate.fee_amount)
    values[field(rate.method, "active", rate.wilaya_code)] = rate.is_active ? "on" : ""
    values[field(rate.method, "label", rate.wilaya_code)] = rate.label ?? ""
  }
  return values
}