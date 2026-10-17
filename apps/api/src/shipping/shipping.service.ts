import { Inject, Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { UnconfiguredShippingProvider } from "./unconfigured.provider"
import type {
  AddressValidationInput,
  AddressValidationResult,
  CreateShipmentInput,
  DeliveryMethod,
  ProviderStatus,
  ShipmentResult,
  ShippingProvider,
  StopDesk,
  TrackShipmentResult,
} from "./shipping.types"

/** DI token for the registered shipping providers (default: unconfigured). */
export const SHIPPING_PROVIDERS = "SHIPPING_PROVIDERS"

export const UNCONFIGURED_PROVIDER_KEY = "none"

/**
 * Resolves the active shipping provider from configuration and exposes the
 * operations the rest of the app needs. When no provider is configured (the
 * default) all read operations degrade gracefully (`[]` stop desks) and write
 * operations fail with a typed `SHIPPING_PROVIDER_NOT_CONFIGURED` error.
 */
@Injectable()
export class ShippingService {
  private readonly registry = new Map<string, ShippingProvider>()

  constructor(
    private readonly config: ConfigService,
    @Inject(SHIPPING_PROVIDERS) providers: ShippingProvider[],
  ) {
    for (const provider of providers) this.registry.set(provider.key, provider)
    if (!this.registry.has(UNCONFIGURED_PROVIDER_KEY)) {
      this.registry.set(UNCONFIGURED_PROVIDER_KEY, new UnconfiguredShippingProvider())
    }
  }

  /** Configured provider key, or "none". */
  get activeKey(): string {
    return this.config.get<string>("SHIPPING_PROVIDER") ?? UNCONFIGURED_PROVIDER_KEY
  }

  get provider(): ShippingProvider {
    return this.registry.get(this.activeKey) ?? this.registry.get(UNCONFIGURED_PROVIDER_KEY)!
  }

  get isConfigured(): boolean {
    return this.provider.isConfigured()
  }

  async listStopDesks(wilayaCode: string): Promise<StopDesk[]> {
    const provider = this.provider
    if (!provider.isConfigured()) return []
    if (!(await provider.supports(wilayaCode, "stop_desk"))) return []
    return [...(await provider.listStopDesks(wilayaCode))]
  }

  async validateAddress(input: AddressValidationInput): Promise<AddressValidationResult> {
    const provider = this.provider
    if (!provider.isConfigured()) return { valid: true, issues: [] }
    return provider.validateAddress(input)
  }

  async createShipment(input: CreateShipmentInput): Promise<ShipmentResult> {
    return this.provider.createShipment(input)
  }

  async trackShipment(shipmentId: string): Promise<TrackShipmentResult> {
    return this.provider.trackShipment(shipmentId)
  }

  async cancelShipment(shipmentId: string): Promise<void> {
    return this.provider.cancelShipment(shipmentId)
  }

  async supports(wilayaCode: string, method?: DeliveryMethod): Promise<boolean> {
    const provider = this.provider
    if (!provider.isConfigured()) return false
    return provider.supports(wilayaCode, method)
  }

  /** Secret-free description of the active provider for admin endpoints. */
  getStatus(): ProviderStatus {
    const provider = this.provider
    const configured = provider.isConfigured()
    return {
      provider: this.activeKey === UNCONFIGURED_PROVIDER_KEY ? null : this.activeKey,
      display_name: this.activeKey === UNCONFIGURED_PROVIDER_KEY ? null : provider.displayName,
      configured,
      stop_desks_supported: configured,
      shipment_creation_supported: configured,
    }
  }
}
