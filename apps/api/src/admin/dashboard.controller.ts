import { Controller, Get, UseGuards } from "@nestjs/common"
import { AdminApiKeyGuard } from "../common/guards/admin-api-key.guard"
import { DashboardService } from "./dashboard.service"

/** Single-store owner overview metrics. Administrative only. */
@Controller("admin/dashboard")
@UseGuards(AdminApiKeyGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  getOverview() {
    return this.dashboard.getOverview()
  }
}
