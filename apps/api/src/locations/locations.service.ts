import { Injectable } from "@nestjs/common"
import { NotFoundError } from "../common/errors/domain-error"
import {
  COMMUNES,
  LOCATION_DATASET_METADATA,
  WILAYAS,
  findWilaya,
  getVerificationReport,
  listCommunes,
  normalizeLocationText,
  searchCommunes,
  type CommuneRef,
  type LocationVerificationReport,
  type WilayaRef,
} from "../common/dz/locations"
import type { ListCommunesQuery, SearchCommunesQuery } from "./dto/locations.schemas"

export interface CommuneListView {
  data: readonly CommuneRef[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/**
 * Read-only access to the reference location dataset (69 wilayas, 1541
 * communes). Public endpoints are served from the committed, versioned dataset
 * so they are available without any seeding; store-specific toggles are applied
 * where relevant.
 */
@Injectable()
export class LocationsService {
  listWilayas(): readonly WilayaRef[] {
    return WILAYAS
  }

  getWilaya(code: string): WilayaRef {
    const wilaya = findWilaya(code)
    if (!wilaya) throw new NotFoundError(`Wilaya "${code}" not found`)
    return wilaya
  }

  listCommunes(wilayaCode: string, query: ListCommunesQuery = {}): CommuneListView {
    if (!findWilaya(wilayaCode)) {
      throw new NotFoundError(`Wilaya "${wilayaCode}" not found`)
    }
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 50
    const pool = listCommunes(wilayaCode)
    const filtered = query.q ? filterCommunes(pool, query.q) : [...pool]
    const start = (page - 1) * pageSize
    return {
      data: filtered.slice(start, start + pageSize),
      page,
      pageSize,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    }
  }

  searchCommunes(query: SearchCommunesQuery): readonly CommuneRef[] {
    return searchCommunes(query.q, { wilaya_code: query.wilaya_code, limit: query.limit })
  }

  getDatasetMeta() {
    return {
      ...LOCATION_DATASET_METADATA,
      actual_counts: { wilayas: WILAYAS.length, communes: COMMUNES.length },
    }
  }

  getVerificationReport(): LocationVerificationReport {
    return getVerificationReport()
  }
}

function filterCommunes(pool: readonly CommuneRef[], query: string): CommuneRef[] {
  const tokens = normalizeLocationText(query).split(" ").filter(Boolean)
  if (tokens.length === 0) return [...pool]
  return pool.filter((commune) => {
    const haystack = normalizeLocationText(
      `${commune.name_fr} ${commune.name_ar} ${commune.post_code}`,
    )
    return tokens.every((token) => haystack.includes(token))
  })
}
