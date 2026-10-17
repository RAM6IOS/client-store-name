/**
 * Algeria administrative divisions (wilayas + communes) for the 2026
 * territorial division (69 wilayas / 1541 communes, loi n° 26-06, Journal
 * Officiel n° 25, 5 avril 2026).
 *
 * The dataset is committed at `./data/dz-locations.json` together with its
 * provenance and a per-row verification status (see
 * `docs/shipping-location-data.md`). This module is the single source of truth
 * for wilaya/commune validation and lookups; server-side code must use it
 * instead of hardcoding codes or names.
 */
import dataset from "./data/dz-locations.json"
import legacyCodes from "./data/legacy-location-codes.json"

/** Outcome of cross-checking a row against the Journal Officiel text. */
export type LocationReviewStatus = "verified" | "spelling_variant" | "unmatched" | "unchecked"

export interface WilayaRef {
  code: string
  name_fr: string
  name_ar: string
  latitude: number | null
  longitude: number | null
}

export interface CommuneRef {
  code: string
  post_code: string
  name_fr: string
  name_ar: string
  daira: string | null
  daira_ar: string | null
  wilaya_code: string
  latitude: number | null
  longitude: number | null
  verification_status: LocationReviewStatus
  verification_note: string | null
}

export interface LocationDatasetMetadata {
  title: string
  legal_basis: { law: string; journal_officiel: string }
  source: { repository: string; license: string; retrieved_at: string; files: string[] }
  counts: { wilayas: number; communes: number }
}

export const WILAYAS: readonly WilayaRef[] = dataset.wilayas as readonly WilayaRef[]
export const COMMUNES: readonly CommuneRef[] = dataset.communes as readonly CommuneRef[]
export const LOCATION_DATASET_METADATA: LocationDatasetMetadata =
  dataset.metadata as LocationDatasetMetadata

/**
 * External/legacy location-code mappings (e.g. a carrier's own wilaya/commune
 * codes). Kept separate from the administrative dataset; empty by default and
 * extended with verified carrier mappings only. `commune_code` refers to the
 * internal `Commune.code`.
 */
export interface LegacyLocationCodeRef {
  provider: string
  legacy_code: string
  wilaya_code: string | null
  commune_code: string | null
  label: string | null
}

export const LEGACY_LOCATION_CODES: readonly LegacyLocationCodeRef[] =
  legacyCodes as readonly LegacyLocationCodeRef[]

const wilayaByCode = new Map(WILAYAS.map((w) => [w.code, w]))
const communeByPostCode = new Map(COMMUNES.map((c) => [c.post_code, c]))
const communesByWilaya = new Map<string, CommuneRef[]>()
for (const commune of COMMUNES) {
  const list = communesByWilaya.get(commune.wilaya_code)
  if (list) list.push(commune)
  else communesByWilaya.set(commune.wilaya_code, [commune])
}

export function listWilayas(): readonly WilayaRef[] {
  return WILAYAS
}

export function isWilayaCode(code: string): boolean {
  return wilayaByCode.has(code)
}

export function findWilaya(code: string): WilayaRef | undefined {
  return wilayaByCode.get(code)
}

export function getWilaya(code: string): WilayaRef {
  const wilaya = wilayaByCode.get(code)
  if (!wilaya) throw new Error(`Unknown wilaya code: ${code}`)
  return wilaya
}

export function listCommunes(wilayaCode: string): readonly CommuneRef[] {
  return communesByWilaya.get(wilayaCode) ?? []
}

export function getCommuneByPostCode(postCode: string): CommuneRef | undefined {
  return communeByPostCode.get(postCode)
}

export function isCommuneOfWilaya(wilayaCode: string, communeCode: string): boolean {
  const commune = communeByPostCode.get(communeCode)
  return !!commune && commune.wilaya_code === wilayaCode
}

/** Strip Arabic diacritics, Latin accents, punctuation and case for search. */
export function normalizeLocationText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .trim()
}

export interface CommuneSearchOptions {
  wilaya_code?: string
  limit?: number
}

export function searchCommunes(
  query: string,
  options: CommuneSearchOptions = {},
): readonly CommuneRef[] {
  const limit = options.limit ?? 20
  const normalized = normalizeLocationText(query)
  const pool = options.wilaya_code ? listCommunes(options.wilaya_code) : COMMUNES
  if (!normalized) return pool.slice(0, limit)
  const tokens = normalized.split(" ").filter(Boolean)
  const matches: CommuneRef[] = []
  for (const commune of pool) {
    const haystack = normalizeLocationText(
      `${commune.name_fr} ${commune.name_ar} ${commune.post_code}`,
    )
    if (tokens.every((token) => haystack.includes(token))) {
      matches.push(commune)
      if (matches.length >= limit) break
    }
  }
  return matches
}

/** The dataset's own report of rows flagged during law verification. */
export interface LocationVerificationReport {
  verified: number
  spelling_variant: number
  unmatched: number
  unchecked: number
  flagged: readonly CommuneRef[]
}

export function getVerificationReport(): LocationVerificationReport {
  const counts = { verified: 0, spelling_variant: 0, unmatched: 0, unchecked: 0 }
  const flagged: CommuneRef[] = []
  for (const commune of COMMUNES) {
    counts[commune.verification_status] += 1
    if (
      commune.verification_status === "spelling_variant" ||
      commune.verification_status === "unmatched"
    ) {
      flagged.push(commune)
    }
  }
  return { ...counts, flagged }
}
