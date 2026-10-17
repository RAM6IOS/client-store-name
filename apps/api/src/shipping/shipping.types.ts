/**
 * Provider-agnostic shipping contract. Carrier integrations (Yalidine, ZR
 * Express, ...) implement `ShippingProvider`; the rest of the app only depends
 * on these normalized shapes, never on carrier-specific payloads or statuses.
 *
 * Credentials live server-side (env / secure store) and are never part of any
 * value returned by these types.
 */

export type DeliveryMethod = "home" | "stop_desk"

/** Carrier statuses normalized to a small, provider-independent vocabulary. */
export type NormalizedShipmentStatus =
  | "pending"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed"
  | "returned"
  | "cancelled"

export interface ProviderCoverage {
  wilaya_code: string
  methods: readonly DeliveryMethod[]
}

export interface StopDesk {
  id: string
  provider: string
  name: string
  wilaya_code: string
  commune_code: string | null
  commune_name: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
}

export interface AddressValidationInput {
  method: DeliveryMethod
  wilaya_code: string
  commune_code: string | null
  commune: string
  address_line: string | null
  stop_desk_id: string | null
}

export interface AddressValidationResult {
  valid: boolean
  issues: readonly string[]
}

export interface ShipmentRecipient {
  name: string
  phone: string
  wilaya_code: string
  commune_code: string | null
  commune: string
  address_line: string | null
  stop_desk_id: string | null
}

export interface CreateShipmentInput {
  order_id: string
  display_id: number | null
  method: DeliveryMethod
  recipient: ShipmentRecipient
  cod_amount: string
  currency_code: string
  parcels_count: number
  weight_grams: number | null
  reference: string | null
}

export interface ShipmentResult {
  provider: string
  shipment_id: string
  tracking_number: string | null
  status: NormalizedShipmentStatus
  label_url: string | null
}

export interface ShipmentEvent {
  status: NormalizedShipmentStatus
  at: string
  note: string | null
}

export interface TrackShipmentResult {
  provider: string
  shipment_id: string
  status: NormalizedShipmentStatus
  updated_at: string | null
  events: readonly ShipmentEvent[]
}

/** Public, secret-free view of the store's provider configuration. */
export interface ProviderStatus {
  provider: string | null
  display_name: string | null
  configured: boolean
  stop_desks_supported: boolean
  shipment_creation_supported: boolean
}

export interface ShippingProvider {
  readonly key: string
  readonly displayName: string
  /** True when the provider has all credentials/configuration it needs. */
  isConfigured(): boolean
  /** Wilayas (and methods) the provider claims to serve. */
  getCoverage(): Promise<readonly ProviderCoverage[]>
  supports(wilayaCode: string, method?: DeliveryMethod): Promise<boolean>
  /** Stop desks for a wilaya. Empty array when none/unconfigured. */
  listStopDesks(wilayaCode: string): Promise<readonly StopDesk[]>
  validateAddress(input: AddressValidationInput): Promise<AddressValidationResult>
  createShipment(input: CreateShipmentInput): Promise<ShipmentResult>
  trackShipment(shipmentId: string): Promise<TrackShipmentResult>
  cancelShipment(shipmentId: string): Promise<void>
}
