import { Body, Controller, Get, Header, Param, Patch, Post, Query, UseGuards } from "@nestjs/common"
import { AdminApiKeyGuard } from "../common/guards/admin-api-key.guard"
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe"
import { OrderService } from "./order.service"
import {
  checkoutSchema,
  confirmOrderSchema,
  cancelOrderSchema,
  transitionOrderSchema,
  orderActionSchema,
  listOrdersQuerySchema,
  exportOrdersQuerySchema,
  type CheckoutInput,
  type ConfirmOrderInput,
  type CancelOrderInput,
  type TransitionOrderInput,
  type OrderActionInput,
  type ListOrdersQuery,
  type ExportOrdersQuery,
} from "./dto/orders.schemas"

/**
 * Orders HTTP surface.
 *
 * Public: `POST /checkout` and `GET /orders/track/:token` (opaque token).
 * Administrative: everything under `orders*` requires the admin API key; every
 * mutation also requires an `actor` and is validated against the state machine.
 */
@Controller()
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Post("checkout")
  checkout(@Body(new ZodValidationPipe(checkoutSchema)) body: CheckoutInput) {
    return this.orders.checkout(body)
  }

  @Get("orders")
  @UseGuards(AdminApiKeyGuard)
  listOrders(@Query(new ZodValidationPipe(listOrdersQuerySchema)) query: ListOrdersQuery) {
    return this.orders.listOrders(query)
  }

  /** Must be declared before `orders/:id` so "export" is not read as an id. */
  @Get("orders/export")
  @UseGuards(AdminApiKeyGuard)
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="orders.csv"')
  @Header("Cache-Control", "no-store")
  exportOrders(@Query(new ZodValidationPipe(exportOrdersQuerySchema)) query: ExportOrdersQuery) {
    return this.orders.exportOrders(query)
  }

  @Get("orders/:id")
  @UseGuards(AdminApiKeyGuard)
  getOrder(@Param("id") id: string) {
    return this.orders.getAdminOrderById(id)
  }

  @Post("orders/:id/confirm")
  @UseGuards(AdminApiKeyGuard)
  confirm(@Param("id") id: string, @Body(new ZodValidationPipe(confirmOrderSchema)) body: ConfirmOrderInput) {
    return this.orders.confirm(id, body)
  }

  @Post("orders/:id/cancel")
  @UseGuards(AdminApiKeyGuard)
  cancel(@Param("id") id: string, @Body(new ZodValidationPipe(cancelOrderSchema)) body: CancelOrderInput) {
    return this.orders.cancel(id, body)
  }

  @Post("orders/:id/prepare")
  @UseGuards(AdminApiKeyGuard)
  prepare(@Param("id") id: string, @Body(new ZodValidationPipe(orderActionSchema)) body: OrderActionInput) {
    return this.orders.prepare(id, body)
  }

  @Post("orders/:id/dispatch")
  @UseGuards(AdminApiKeyGuard)
  dispatch(@Param("id") id: string, @Body(new ZodValidationPipe(orderActionSchema)) body: OrderActionInput) {
    return this.orders.dispatch(id, body)
  }

  @Post("orders/:id/transit")
  @UseGuards(AdminApiKeyGuard)
  inTransit(@Param("id") id: string, @Body(new ZodValidationPipe(orderActionSchema)) body: OrderActionInput) {
    return this.orders.markInTransit(id, body)
  }

  @Post("orders/:id/no-answer")
  @UseGuards(AdminApiKeyGuard)
  noAnswer(@Param("id") id: string, @Body(new ZodValidationPipe(orderActionSchema)) body: OrderActionInput) {
    return this.orders.markNoAnswer(id, body)
  }

  @Post("orders/:id/wrong-number")
  @UseGuards(AdminApiKeyGuard)
  wrongNumber(@Param("id") id: string, @Body(new ZodValidationPipe(orderActionSchema)) body: OrderActionInput) {
    return this.orders.markWrongNumber(id, body)
  }

  @Post("orders/:id/deliver")
  @UseGuards(AdminApiKeyGuard)
  deliver(@Param("id") id: string, @Body(new ZodValidationPipe(orderActionSchema)) body: OrderActionInput) {
    return this.orders.markDelivered(id, body)
  }

  @Post("orders/:id/delivery-failed")
  @UseGuards(AdminApiKeyGuard)
  deliveryFailed(@Param("id") id: string, @Body(new ZodValidationPipe(orderActionSchema)) body: OrderActionInput) {
    return this.orders.markDeliveryFailed(id, body)
  }

  @Post("orders/:id/return")
  @UseGuards(AdminApiKeyGuard)
  markReturned(@Param("id") id: string, @Body(new ZodValidationPipe(orderActionSchema)) body: OrderActionInput) {
    return this.orders.markReturned(id, body)
  }

  @Patch("orders/:id/status")
  @UseGuards(AdminApiKeyGuard)
  transition(@Param("id") id: string, @Body(new ZodValidationPipe(transitionOrderSchema)) body: TransitionOrderInput) {
    return this.orders.transitionStatus(id, body)
  }

  @Get("orders/track/:token")
  track(@Param("token") token: string) {
    return this.orders.getPublicOrderByToken(token)
  }
}
