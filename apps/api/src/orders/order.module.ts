import { Module } from "@nestjs/common"
import { AdminApiKeyGuard } from "../common/guards/admin-api-key.guard"
import { InventoryModule } from "../inventory/inventory.module"
import { ShippingModule } from "../shipping/shipping.module"
import { OrderController } from "./order.controller"
import { DeliveryController } from "./delivery.controller"
import { AdminDeliveryController } from "./admin-delivery.controller"
import { OrderService } from "./order.service"
import { DeliveryService } from "./delivery.service"
import { IdempotencyService } from "./idempotency.service"
import { OrderRepository } from "./order.repository"

@Module({
  imports: [InventoryModule, ShippingModule],
  controllers: [OrderController, DeliveryController, AdminDeliveryController],
  providers: [OrderService, DeliveryService, IdempotencyService, OrderRepository, AdminApiKeyGuard],
  exports: [OrderService, DeliveryService, IdempotencyService],
})
export class OrderModule {}