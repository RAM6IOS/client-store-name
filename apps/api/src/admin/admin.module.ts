import { Module } from "@nestjs/common"
import { AdminApiKeyGuard } from "../common/guards/admin-api-key.guard"
import { OrderModule } from "../orders/order.module"
import { StoreModule } from "../store/store.module"
import { DashboardController } from "./dashboard.controller"
import { DashboardService } from "./dashboard.service"
import { CustomersController } from "./customers.controller"
import { CustomersService } from "./customers.service"

/**
 * Cross-domain read surface for the single-store owner dashboard: overview
 * metrics and derived customers. Mutating admin surfaces stay with their
 * owning modules (catalog, inventory, delivery, store settings).
 */
@Module({
  imports: [OrderModule, StoreModule],
  controllers: [DashboardController, CustomersController],
  providers: [DashboardService, CustomersService, AdminApiKeyGuard],
})
export class AdminModule {}
