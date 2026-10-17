import { Module } from "@nestjs/common"
import { AdminApiKeyGuard } from "../common/guards/admin-api-key.guard"
import { StoreController } from "./store.controller"
import { AdminStoreController } from "./admin-store.controller"
import { StoreService } from "./store.service"

@Module({
  controllers: [StoreController, AdminStoreController],
  providers: [StoreService, AdminApiKeyGuard],
  exports: [StoreService],
})
export class StoreModule {}
