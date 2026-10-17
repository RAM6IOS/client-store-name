import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common"
import { AdminApiKeyGuard } from "../common/guards/admin-api-key.guard"
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe"
import { StoreService } from "./store.service"
import {
  updateStoreSettingsSchema,
  type UpdateStoreSettingsInput,
} from "./dto/store.schemas"

/**
 * Administrative store configuration. Requires the admin API key. A single
 * store row is edited in place; the base currency must reference an existing,
 * active currency.
 */
@Controller("admin/store")
@UseGuards(AdminApiKeyGuard)
export class AdminStoreController {
  constructor(private readonly store: StoreService) {}

  @Get("settings")
  getSettings() {
    return this.store.getAdminSettings()
  }

  @Patch("settings")
  updateSettings(
    @Body(new ZodValidationPipe(updateStoreSettingsSchema)) body: UpdateStoreSettingsInput,
  ) {
    return this.store.updateSettings(body)
  }
}
