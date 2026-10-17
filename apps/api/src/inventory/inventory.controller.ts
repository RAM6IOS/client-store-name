import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from "@nestjs/common"
import { AdminApiKeyGuard } from "../common/guards/admin-api-key.guard"
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe"
import { InventoryService } from "./inventory.service"
import {
  adjustStockSchema,
  listInventoryQuerySchema,
  listMovementsQuerySchema,
  releaseStockSchema,
  reserveStockSchema,
  type AdjustStockInput,
  type ListInventoryQuery,
  type ListMovementsQuery,
  type ReleaseStockInput,
  type ReserveStockInput,
} from "./dto/inventory.schemas"

@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  /** List inventory items (optionally only items with no sellable stock). */
  @Get()
  listItems(@Query(new ZodValidationPipe(listInventoryQuerySchema)) query: ListInventoryQuery) {
    return this.inventory.listItems(query)
  }

  /** Availability for a variant (stocked, reserved, available). */
  @Get("variants/:variantId")
  getAvailability(@Param("variantId") variantId: string) {
    return this.inventory.getAvailabilityByVariant(variantId)
  }

  /** Append-only movement ledger for a variant. */
  @Get("variants/:variantId/movements")
  listMovements(
    @Param("variantId") variantId: string,
    @Query(new ZodValidationPipe(listMovementsQuerySchema)) query: ListMovementsQuery,
  ) {
    return this.inventory.listMovements(variantId, query)
  }

  /** Signed stock adjustment (receipt / adjustment / return). */
  @Post("variants/:variantId/adjust")
  @UseGuards(AdminApiKeyGuard)
  adjust(
    @Param("variantId") variantId: string,
    @Body(new ZodValidationPipe(adjustStockSchema)) body: AdjustStockInput,
    @Headers("x-actor") actor?: string,
  ) {
    return this.inventory.adjustStock(variantId, body, actor)
  }

  /** Atomically reserve stock; 409 when availability is insufficient. */
  @Post("variants/:variantId/reserve")
  @UseGuards(AdminApiKeyGuard)
  reserve(
    @Param("variantId") variantId: string,
    @Body(new ZodValidationPipe(reserveStockSchema)) body: ReserveStockInput,
    @Headers("x-actor") actor?: string,
  ) {
    return this.inventory.reserveStock(variantId, body, actor)
  }

  /** Release previously reserved stock. */
  @Post("variants/:variantId/release")
  @UseGuards(AdminApiKeyGuard)
  release(
    @Param("variantId") variantId: string,
    @Body(new ZodValidationPipe(releaseStockSchema)) body: ReleaseStockInput,
    @Headers("x-actor") actor?: string,
  ) {
    return this.inventory.releaseStock(variantId, body, actor)
  }
}
