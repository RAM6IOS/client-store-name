import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { validateEnv } from "./config/env.validation"
import { AdminModule } from "./admin/admin.module"
import { CatalogModule } from "./catalog/catalog.module"
import { HealthModule } from "./health/health.module"
import { InventoryModule } from "./inventory/inventory.module"
import { LocationsModule } from "./locations/locations.module"
import { MediaModule } from "./media/media.module"
import { OrderModule } from "./orders/order.module"
import { PrismaModule } from "./prisma/prisma.module"
import { StoreModule } from "./store/store.module"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [".env", "../../.env"],
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    AdminModule,
    CatalogModule,
    InventoryModule,
    LocationsModule,
    MediaModule,
    OrderModule,
    StoreModule,
  ],
})
export class AppModule {}
