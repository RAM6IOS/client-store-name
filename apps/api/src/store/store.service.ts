import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { UnknownCurrencyError } from "../common/errors/domain-error"
import type { UpdateStoreSettingsInput } from "./dto/store.schemas"

/**
 * Non-sensitive storefront configuration. Only fields safe to serve publicly
 * are exposed; nothing administrative or secret is ever returned here.
 */
export interface PublicStoreSettings {
  name: string
  default_locale: string
  base_currency: string
  cod_enabled: boolean
}

/** Full settings row for the administrative surface (still no secrets). */
export interface AdminStoreSettings extends PublicStoreSettings {
  reservation_ttl_minutes: number
  created_at: Date
  updated_at: Date
}

const FALLBACK: PublicStoreSettings = {
  name: "Store",
  default_locale: "ar",
  base_currency: "DZD",
  cod_enabled: true,
}

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicSettings(): Promise<PublicStoreSettings> {
    const setting = await this.prisma.storeSetting.findFirst({
      orderBy: { created_at: "asc" },
    })
    if (!setting) return { ...FALLBACK }
    return {
      name: setting.name,
      default_locale: setting.default_locale,
      base_currency: setting.base_currency.toUpperCase(),
      cod_enabled: setting.cod_enabled,
    }
  }

  /** The base currency orders and dashboard figures are reported in. */
  async getBaseCurrency(): Promise<string> {
    const setting = await this.prisma.storeSetting.findFirst({
      orderBy: { created_at: "asc" },
      select: { base_currency: true },
    })
    return (setting?.base_currency ?? FALLBACK.base_currency).toUpperCase()
  }

  async getAdminSettings(): Promise<AdminStoreSettings> {
    const setting = await this.prisma.storeSetting.findFirst({
      orderBy: { created_at: "asc" },
    })
    if (!setting) {
      const created = await this.prisma.storeSetting.create({
        data: {
          name: FALLBACK.name,
          default_locale: FALLBACK.default_locale,
          base_currency: FALLBACK.base_currency,
          cod_enabled: FALLBACK.cod_enabled,
        },
      })
      return this.toAdminSettings(created)
    }
    return this.toAdminSettings(setting)
  }

  async updateSettings(input: UpdateStoreSettingsInput): Promise<AdminStoreSettings> {
    if (input.base_currency) {
      const currency = await this.prisma.currency.findUnique({
        where: { code: input.base_currency },
      })
      if (!currency || !currency.is_active) throw new UnknownCurrencyError(input.base_currency)
    }

    const existing = await this.prisma.storeSetting.findFirst({
      orderBy: { created_at: "asc" },
    })
    if (!existing) {
      const created = await this.prisma.storeSetting.create({
        data: {
          name: input.name ?? FALLBACK.name,
          default_locale: input.default_locale ?? FALLBACK.default_locale,
          base_currency: input.base_currency ?? FALLBACK.base_currency,
          cod_enabled: input.cod_enabled ?? FALLBACK.cod_enabled,
          reservation_ttl_minutes: input.reservation_ttl_minutes ?? 60,
        },
      })
      return this.toAdminSettings(created)
    }

    const updated = await this.prisma.storeSetting.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        default_locale: input.default_locale,
        base_currency: input.base_currency,
        cod_enabled: input.cod_enabled,
        reservation_ttl_minutes: input.reservation_ttl_minutes,
      },
    })
    return this.toAdminSettings(updated)
  }

  private toAdminSettings(setting: {
    name: string
    default_locale: string
    base_currency: string
    cod_enabled: boolean
    reservation_ttl_minutes: number
    created_at: Date
    updated_at: Date
  }): AdminStoreSettings {
    return {
      name: setting.name,
      default_locale: setting.default_locale,
      base_currency: setting.base_currency.toUpperCase(),
      cod_enabled: setting.cod_enabled,
      reservation_ttl_minutes: setting.reservation_ttl_minutes,
      created_at: setting.created_at,
      updated_at: setting.updated_at,
    }
  }
}
