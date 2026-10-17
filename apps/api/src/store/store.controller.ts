import { Controller, Get } from "@nestjs/common"
import { StoreService } from "./store.service"

@Controller("store")
export class StoreController {
  constructor(private readonly store: StoreService) {}

  /** Public, non-sensitive storefront configuration. */
  @Get("settings")
  getSettings() {
    return this.store.getPublicSettings()
  }
}
