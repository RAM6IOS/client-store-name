import { Body, Controller, Get, Post, Query } from "@nestjs/common"
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe"
import { ShippingService } from "../shipping/shipping.service"
import { DeliveryService } from "./delivery.service"
import {
  deliveryQuoteRequestSchema,
  deliveryMethodsQuerySchema,
  stopDesksQuerySchema,
  type DeliveryQuoteRequest,
  type DeliveryMethodsQuery,
  type StopDesksQuery,
} from "./dto/delivery.schemas"

/**
 * Public delivery endpoints. A quote is always generated server-side from the
 * store's configured rates; unknown or disabled destinations return an explicit
 * `DELIVERY_UNAVAILABLE` response. Stop desks are empty when no carrier is
 * configured.
 */
@Controller("delivery")
export class DeliveryController {
  constructor(
    private readonly delivery: DeliveryService,
    private readonly shipping: ShippingService,
  ) {}

  @Post("quote")
  quote(@Body(new ZodValidationPipe(deliveryQuoteRequestSchema)) body: DeliveryQuoteRequest) {
    return this.delivery.getQuote(body.wilaya_code, body.method, body.currency_code)
  }

  @Get("methods")
  async listMethods(
    @Query(new ZodValidationPipe(deliveryMethodsQuerySchema)) query: DeliveryMethodsQuery,
  ) {
    const data = await this.delivery.listMethods(query.wilaya_code, query.currency_code)
    return { data }
  }

  @Get("stop-desks")
  async stopDesks(@Query(new ZodValidationPipe(stopDesksQuerySchema)) query: StopDesksQuery) {
    const data = await this.shipping.listStopDesks(query.wilaya_code)
    return {
      data,
      total: data.length,
      provider_configured: this.shipping.isConfigured,
    }
  }
}
