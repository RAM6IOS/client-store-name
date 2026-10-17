import { Module } from "@nestjs/common"
import { UnconfiguredShippingProvider } from "./unconfigured.provider"
import { SHIPPING_PROVIDERS, ShippingService } from "./shipping.service"
import type { ShippingProvider } from "./shipping.types"

/**
 * Shipping integration module. Registers the provider registry. Real carrier
 * providers are added to the `SHIPPING_PROVIDERS` array as they are
 * implemented; by default only the unconfigured provider is present so the app
 * runs without any carrier credentials.
 */
@Module({
  providers: [
    {
      provide: SHIPPING_PROVIDERS,
      useFactory: (): ShippingProvider[] => [new UnconfiguredShippingProvider()],
    },
    ShippingService,
  ],
  exports: [ShippingService],
})
export class ShippingModule {}
