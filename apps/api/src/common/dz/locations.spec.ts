import {
  COMMUNES,
  LOCATION_DATASET_METADATA,
  WILAYAS,
  findWilaya,
  getCommuneByPostCode,
  getVerificationReport,
  isCommuneOfWilaya,
  isWilayaCode,
  listCommunes,
  normalizeLocationText,
  searchCommunes,
} from "./locations"

describe("Algeria location dataset", () => {
  it("contains the 2026 division (69 wilayas, 1541 communes)", () => {
    expect(WILAYAS).toHaveLength(69)
    expect(COMMUNES).toHaveLength(1541)
    expect(LOCATION_DATASET_METADATA.counts.wilayas).toBe(69)
    expect(LOCATION_DATASET_METADATA.counts.communes).toBe(1541)
  })

  it("documents its provenance against loi 26-06 / JO 25", () => {
    const metadata = LOCATION_DATASET_METADATA
    expect(metadata.legal_basis.law).toContain("26-06")
    expect(metadata.legal_basis.journal_officiel).toContain("25")
    expect(metadata.source.repository).toBeTruthy()
    expect(metadata.source.license).toBeTruthy()
  })

  it("recognises the new wilaya codes 59-69", () => {
    for (let n = 59; n <= 69; n += 1) {
      expect(isWilayaCode(String(n).padStart(2, "0"))).toBe(true)
    }
    expect(isWilayaCode("99")).toBe(false)
  })

  it("resolves wilayas and their communes", () => {
    expect(findWilaya("16")?.name_fr).toBeTruthy()
    const alger = listCommunes("16")
    expect(alger.length).toBeGreaterThan(0)
    expect(alger.every((c) => c.wilaya_code === "16")).toBe(true)
    expect(listCommunes("99")).toHaveLength(0)
  })

  it("looks up communes by post code and validates wilaya membership", () => {
    const commune = COMMUNES[0]
    expect(getCommuneByPostCode(commune.post_code)?.code).toBe(commune.code)
    expect(isCommuneOfWilaya(commune.wilaya_code, commune.post_code)).toBe(true)
    expect(isCommuneOfWilaya("99", commune.post_code)).toBe(false)
  })

  it("normalizes accents, diacritics and case for search", () => {
    expect(normalizeLocationText("Aïn El Melh")).toBe("ain el melh")
    expect(normalizeLocationText("TIZI-OUZOU")).toBe("tizi ouzou")
  })

  it("searches communes by name without inventing results", () => {
    const results = searchCommunes("alger", { limit: 5 })
    expect(results.length).toBeGreaterThan(0)
    expect(results.length).toBeLessThanOrEqual(5)
    expect(searchCommunes("zzzzz-not-a-place")).toHaveLength(0)
  })

  it("reports verification totals that add up to the dataset size", () => {
    const report = getVerificationReport()
    const total = report.verified + report.spelling_variant + report.unmatched + report.unchecked
    expect(total).toBe(COMMUNES.length)
    expect(report.flagged.length).toBe(report.spelling_variant + report.unmatched)
  })
})
