import { Module } from "@nestjs/common"
import { AdminApiKeyGuard } from "../common/guards/admin-api-key.guard"
import { MediaModule } from "../media/media.module"
import { CatalogController } from "./catalog.controller"
import { CatalogService } from "./catalog.service"

@Module({
  imports: [MediaModule],
  controllers: [CatalogController],
  providers: [CatalogService, AdminApiKeyGuard],
  exports: [CatalogService],
})
export class CatalogModule {}
