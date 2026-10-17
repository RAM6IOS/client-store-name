import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common"
import { AdminApiKeyGuard } from "../common/guards/admin-api-key.guard"
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe"
import { PrismaService } from "../prisma/prisma.service"
import { NotFoundError } from "../common/errors/domain-error"
import { ShippingService } from "../shipping/shipping.service"
import { STORE_PROVIDER } from "./delivery.service"
import {
  batchUpsertDeliveryRatesSchema,
  createDeliveryRateSchema,
  updateDeliveryRateSchema,
  listDeliveryRatesQuerySchema,
  type BatchUpsertDeliveryRatesInput,
  type CreateDeliveryRateInput,
  type UpdateDeliveryRateInput,
  type ListDeliveryRatesQuery,
} from "./dto/delivery.schemas"

/**
 * Administrative delivery configuration. Every route requires the admin API
 * key. Rates are store configuration and are upserted idempotently on their
 * (wilaya, method, currency, provider) identity.
 */
@Controller("admin")
@UseGuards(AdminApiKeyGuard)
export class AdminDeliveryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shipping: ShippingService,
  ) {}

  @Get("shipping/providers")
  providerStatus() {
    return this.shipping.getStatus()
  }

  @Get("delivery-rates")
  async listRates(
    @Query(new ZodValidationPipe(listDeliveryRatesQuerySchema)) query: ListDeliveryRatesQuery,
  ) {
    const rates = await this.prisma.deliveryRate.findMany({
      where: {
        ...(query.wilaya_code ? { wilaya_code: query.wilaya_code } : {}),
        ...(query.method ? { method: query.method } : {}),
        ...(query.provider !== undefined ? { provider: query.provider } : {}),
        ...(query.active_only ? { is_active: true } : {}),
      },
      orderBy: [{ wilaya_code: "asc" }, { method: "asc" }, { provider: "asc" }],
    })
    return { data: rates, total: rates.length }
  }

  @Post("delivery-rates")
  async upsertRate(
    @Body(new ZodValidationPipe(createDeliveryRateSchema)) body: CreateDeliveryRateInput,
  ) {
    return this.prisma.deliveryRate.upsert(rateUpsertArgs(body))
  }

  /**
   * Saves many edited wilaya/method rows in a single transaction: either every
   * row is persisted or none is, so the dashboard never leaves config half-saved.
   */
  @Post("delivery-rates/batch")
  async upsertRatesBatch(
    @Body(new ZodValidationPipe(batchUpsertDeliveryRatesSchema)) body: BatchUpsertDeliveryRatesInput,
  ) {
    const results = await this.prisma.$transaction(
      body.rates.map((rate) => this.prisma.deliveryRate.upsert(rateUpsertArgs(rate))),
    )
    return { data: results, total: results.length }
  }

  @Patch("delivery-rates/:id")
  async updateRate(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateDeliveryRateSchema)) body: UpdateDeliveryRateInput,
  ) {
    const existing = await this.prisma.deliveryRate.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError(`Delivery rate "${id}" not found`)
    return this.prisma.deliveryRate.update({
      where: { id },
      data: {
        ...(body.fee_amount !== undefined ? { fee_amount: BigInt(body.fee_amount) } : {}),
        ...(body.label !== undefined ? { label: body.label } : {}),
        ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
      },
    })
  }
}

/** Normalises a validated rate payload into an idempotent upsert. */
function rateUpsertArgs(body: CreateDeliveryRateInput) {
  const provider = body.provider?.trim() ?? STORE_PROVIDER
  const currencyCode = body.currency_code.toUpperCase()
  const feeAmount = BigInt(body.fee_amount)
  return {
    where: {
      wilaya_code_method_currency_code_provider: {
        wilaya_code: body.wilaya_code,
        method: body.method,
        currency_code: currencyCode,
        provider,
      },
    },
    update: {
      fee_amount: feeAmount,
      label: body.label ?? null,
      is_active: body.is_active ?? true,
    },
    create: {
      wilaya_code: body.wilaya_code,
      method: body.method,
      currency_code: currencyCode,
      provider,
      fee_amount: feeAmount,
      label: body.label ?? null,
      is_active: body.is_active ?? true,
    },
  }
}
