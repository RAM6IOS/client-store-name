import { Module } from "@nestjs/common"
import { AdminApiKeyGuard } from "../common/guards/admin-api-key.guard"
import { InventoryController } from "./inventory.controller"
import { InventoryService } from "./inventory.service"

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, AdminApiKeyGuard],
  exports: [InventoryService],
})
export class InventoryModule {}
