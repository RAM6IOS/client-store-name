import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { PrismaService } from "../prisma/prisma.service"
import {
  DeliveryUnavailableError,
  InvalidLocationError,
} from "../common/errors/domain-error"
import { findWilaya } from "../common/dz/locations"
import type { DeliveryMethod } from "../shipping/shipping.types"

/** Store-owned tariff (no carrier). Carrier-specific rates carry a provider key. */
export const STORE_PROVIDER = ""

export interface DeliveryQuote {
  deliveryRateId: string
  method: DeliveryMethod
  currencyCode: string
  feeAmount: bigint
  label: string | null
  provider: string
  wilayaCode: string
  wilayaName: string
  wilayaNameFr: string
  issuedAt: string
  expiresAt: string
}

export interface DeliveryMethodOption {
  method: DeliveryMethod
  available: boolean
  currencyCode: string
  feeAmount: bigint | null
  label: string | null
  provider: string
}

export interface ResolvedDeliveryRate {
  id: string
  method: DeliveryMethod
  currency_code: string
  fee_amount: bigint
  label: string | null
  provider: string
  wilaya_code: string
}

/**
 * Configuration-driven delivery pricing. Rates are never assumed national
 * tariffs: a wilaya/method/currency must have an active `DeliveryRate`, and an
 * unknown or disabled destination yields an explicit `DELIVERY_UNAVAILABLE`
 * response instead of a guessed price.
 */
@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get quoteTtlSeconds(): number {
    return this.config.get<number>("DELIVERY_QUOTE_TTL_SECONDS") ?? 900
  }

  async getQuote(
    wilayaCode: string,
    method: DeliveryMethod,
    currencyCode: string,
    provider: string = STORE_PROVIDER,
  ): Promise<DeliveryQuote> {
    const wilaya = findWilaya(wilayaCode)
    if (!wilaya) {
      throw new InvalidLocationError(`Unknown wilaya code "${wilayaCode}"`, { wilayaCode })
    }

    const dbWilaya = await this.prisma.wilaya.findUnique({
      where: { code: wilayaCode },
      select: { is_active: true },
    })
    if (dbWilaya && !dbWilaya.is_active) {
      throw new DeliveryUnavailableError("This destination is not currently available for delivery", {
        wilayaCode,
        reason: "WILAYA_INACTIVE",
      })
    }

    const rate = await this.resolveActiveRate(wilayaCode, method, currencyCode, provider)
    if (!rate) {
      throw new DeliveryUnavailableError(
        "No delivery option is available for the selected wilaya and method",
        { wilayaCode, method, currencyCode, reason: "NO_ACTIVE_RATE" },
      )
    }

    const issuedAt = new Date()
    const expiresAt = new Date(issuedAt.getTime() + this.quoteTtlSeconds * 1_000)
    return {
      deliveryRateId: rate.id,
      method: rate.method,
      currencyCode: rate.currency_code,
      feeAmount: rate.fee_amount,
      label: rate.label,
      provider: rate.provider,
      wilayaCode: rate.wilaya_code,
      wilayaName: wilaya.name_ar,
      wilayaNameFr: wilaya.name_fr,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }
  }

  async resolveActiveRate(
    wilayaCode: string,
    method: DeliveryMethod,
    currencyCode: string,
    provider: string = STORE_PROVIDER,
  ): Promise<ResolvedDeliveryRate | null> {
    return this.prisma.deliveryRate.findFirst({
      where: {
        wilaya_code: wilayaCode,
        method,
        currency_code: currencyCode.toUpperCase(),
        provider,
        is_active: true,
      },
    })
  }

  /** Which delivery methods the destination supports, with their fees. */
  async listMethods(
    wilayaCode: string,
    currencyCode: string,
    provider: string = STORE_PROVIDER,
  ): Promise<DeliveryMethodOption[]> {
    const wilaya = findWilaya(wilayaCode)
    if (!wilaya) {
      throw new InvalidLocationError(`Unknown wilaya code "${wilayaCode}"`, { wilayaCode })
    }
    const normalizedCurrency = currencyCode.toUpperCase()
    const rates = await this.prisma.deliveryRate.findMany({
      where: { wilaya_code: wilayaCode, currency_code: normalizedCurrency, provider, is_active: true },
    })
    const byMethod = new Map(rates.map((rate) => [rate.method, rate]))
    const build = (method: DeliveryMethod): DeliveryMethodOption => {
      const rate = byMethod.get(method)
      return {
        method,
        available: !!rate,
        currencyCode: normalizedCurrency,
        feeAmount: rate ? rate.fee_amount : null,
        label: rate?.label ?? null,
        provider,
      }
    }
    return [build("home"), build("stop_desk")]
  }

  /** Freeze the applicable configuration into an immutable order snapshot. */
  buildQuoteSnapshot(quote: DeliveryQuote): Record<string, unknown> {
    return {
      delivery_rate_id: quote.deliveryRateId,
      method: quote.method,
      currency_code: quote.currencyCode,
      fee_amount: quote.feeAmount.toString(),
      label: quote.label,
      provider: quote.provider,
      wilaya_code: quote.wilayaCode,
      wilaya_name: quote.wilayaName,
      wilaya_name_fr: quote.wilayaNameFr,
      issued_at: quote.issuedAt,
      expires_at: quote.expiresAt,
    }
  }

  async ensureActiveRate(rateId: string): Promise<ResolvedDeliveryRate> {
    const rate = await this.prisma.deliveryRate.findUnique({ where: { id: rateId } })
    if (!rate || !rate.is_active) {
      throw new DeliveryUnavailableError("The selected delivery option is no longer available", { rateId })
    }
    return rate
  }
}
