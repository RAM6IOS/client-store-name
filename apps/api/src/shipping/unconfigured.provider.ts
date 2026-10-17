import { ShippingProviderNotConfiguredError } from "../common/errors/domain-error"
import type {
  AddressValidationInput,
  AddressValidationResult,
  CreateShipmentInput,
  ProviderCoverage,
  ShipmentResult,
  ShippingProvider,
  StopDesk,
  TrackShipmentResult,
} from "./shipping.types"

/**
 * No-op provider used when the store has no real carrier configured (the
 * default). It advertises nothing and returns an empty stop-desk list so the
 * storefront can still present a coherent (if empty) choice instead of erroring.
 * Shipment operations fail explicitly rather than pretending to succeed.
 */
export class UnconfiguredShippingProvider implements ShippingProvider {
  readonly key = "none"
  readonly displayName = "No carrier configured"

  isConfigured(): boolean {
    return false
  }

  async getCoverage(): Promise<readonly ProviderCoverage[]> {
    return []
  }

  async supports(): Promise<boolean> {
    return false
  }

  async listStopDesks(): Promise<readonly StopDesk[]> {
    return []
  }

  async validateAddress(): Promise<AddressValidationResult> {
    return { valid: true, issues: [] }
  }

  async createShipment(): Promise<never> {
    throw new ShippingProviderNotConfiguredError()
  }

  async trackShipment(): Promise<never> {
    throw new ShippingProviderNotConfiguredError()
  }

  async cancelShipment(): Promise<never> {
    throw new ShippingProviderNotConfiguredError()
  }
}
