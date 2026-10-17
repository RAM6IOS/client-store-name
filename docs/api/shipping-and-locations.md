# Shipping & Locations API (Phase 4)

Phase 4 adds Algeria-aware location data and a provider-agnostic delivery layer.
Pricing is **configuration**, never assumed: a quote requires an active
`DeliveryRate` for the wilaya × method × currency, otherwise the API returns an
explicit `DELIVERY_UNAVAILABLE`. See
[ADR-0012](../decisions/0012-shipping-location-abstraction.md) and
[data provenance](../shipping-location-data.md).

Base URL: `http://localhost:3001/api`

## Concepts

- **Wilaya / commune** — administrative divisions for the 2026 division (69
  wilayas / 1541 communes). Read-only, served from the committed dataset.
- **Delivery method** — `home` or `stop_desk`.
- **Delivery rate** — a configured tariff for `(wilaya, method, currency,
provider)`. `provider: ""` is the store's own tariff.
- **Quote** — a server-computed price with an issue/expiry window, frozen onto
  the order at checkout.
- **Provider** — a carrier integration. The default is unconfigured (`none`):
  no stop-desks, no shipments.

Money is integer **minor units** serialised as strings (ADR-0005).

## Public endpoints

### Locations (read-only)

| Method | Path                                | Description                                  |
| ------ | ----------------------------------- | -------------------------------------------- |
| `GET`  | `/locations/wilayas`                | All 69 wilayas (`{ data, total }`)           |
| `GET`  | `/locations/wilayas/:code`          | One wilaya by 2-char code (`404` if unknown) |
| `GET`  | `/locations/wilayas/:code/communes` | Communes of a wilaya, paginated/filterable   |
| `GET`  | `/locations/communes/search`        | Search communes by name (`?q` required)      |
| `GET`  | `/locations/meta`                   | Dataset metadata + counts                    |
| `GET`  | `/locations/verification`           | Verification totals + flagged rows           |

`GET /locations/wilayas/:code/communes` query: `q?` (name filter), `page?`
(default 1), `pageSize?` (default 50, max 200) → `{ data, page, pageSize,
total, totalPages }`.

`GET /locations/communes/search` query: `q` (required), `wilaya_code?`,
`limit?` (default 20, max 100) → `{ data, total }`.

A wilaya's communes carry `wilaya_code`, so the storefront can drive a
wilaya → commune dependent select. `commune_code` used at checkout is the
**postal code** (`post_code`).

### Delivery

| Method | Path                   | Description                                         |
| ------ | ---------------------- | --------------------------------------------------- |
| `POST` | `/delivery/quote`      | Quote one wilaya + method + currency                |
| `GET`  | `/delivery/methods`    | `home` / `stop_desk` availability + fee for a place |
| `GET`  | `/delivery/stop-desks` | Stop-desks for a wilaya (`[]` when unconfigured)    |

`POST /delivery/quote`

```json
{ "wilaya_code": "16", "method": "home", "currency_code": "DZD" }
```

```json
{
  "deliveryRateId": "...",
  "method": "home",
  "currencyCode": "DZD",
  "feeAmount": "800",
  "label": "Alger Centre - Home",
  "provider": "",
  "wilayaCode": "16",
  "wilayaName": "الجزائر",
  "wilayaNameFr": "Alger",
  "issuedAt": "2026-10-11T10:00:00.000Z",
  "expiresAt": "2026-10-11T10:15:00.000Z"
}
```

- Unknown wilaya → `400 VALIDATION_ERROR`.
- Wilaya disabled or no active rate → `422 DELIVERY_UNAVAILABLE`.
- `expiresAt = issuedAt + DELIVERY_QUOTE_TTL_SECONDS` (default 900).

`GET /delivery/methods?wilaya_code=16&currency_code=DZD` →
`{ data: [ { method: "home", available: true, currencyCode, feeAmount, label,
provider }, { method: "stop_desk", ... } ] }`.

`GET /delivery/stop-desks?wilaya_code=16` →
`{ data: [], total: 0, provider_configured: false }`.

## Checkout integration

`POST /checkout` accepts optional `commune_code` (postal code) and, for
stop-desk delivery, `stop_desk_id` / `stop_desk_name` / `stop_desk_address`.
The price is always recomputed server-side.

- When `commune_code` is provided it must belong to the chosen wilaya, otherwise
  the request fails with `400 INVALID_LOCATION`. Free-text `commune` remains
  required for the address snapshot.
- When a provider **is** configured, `stop_desk_id` is validated against that
  provider (`400 INVALID_LOCATION` if unknown). When no provider is configured,
  the supplied stop-desk fields are stored as an unverified snapshot.
- The order stores a **frozen quote snapshot** (`delivery_quote`) plus
  `commune_code` and, when present, a `stop_desk` block. History is never
  rewritten by later config or dataset changes.
- No active rate → `422 DELIVERY_UNAVAILABLE` (the order is not created).

## Admin endpoints

All require `x-admin-api-key: <ADMIN_API_KEY>` (fails closed with `401`).

| Method  | Path                        | Description                                                         |
| ------- | --------------------------- | ------------------------------------------------------------------- |
| `GET`   | `/admin/shipping/providers` | Secret-free active-provider status                                  |
| `GET`   | `/admin/delivery-rates`     | List rates (`wilaya_code?`, `method?`, `provider?`, `active_only?`) |
| `POST`  | `/admin/delivery-rates`     | Upsert a rate by `(wilaya, method, currency, provider)`             |
| `PATCH` | `/admin/delivery-rates/:id` | Update `fee_amount` / `label` / `is_active`                         |

`POST /admin/delivery-rates` body:

```json
{
  "wilaya_code": "16",
  "method": "home",
  "currency_code": "DZD",
  "provider": "",
  "fee_amount": "800",
  "label": "Alger - Home",
  "is_active": true
}
```

`fee_amount` is a non-negative **integer string** in minor units; `provider`
defaults to `""` (store tariff); `currency_code` is upper-cased. The endpoint is
idempotent on the rate identity.

`GET /admin/shipping/providers`:

```json
{
  "provider": null,
  "display_name": null,
  "configured": false,
  "stop_desks_supported": false,
  "shipment_creation_supported": false
}
```

No endpoint ever returns provider credentials.

## Configuration

| Variable                       | Default | Purpose                            |
| ------------------------------ | ------- | ---------------------------------- |
| `SHIPPING_PROVIDER`            | `none`  | Active provider key (unset = none) |
| `SHIPPING_PROVIDER_API_KEY`    | —       | Carrier credential (server-side)   |
| `SHIPPING_PROVIDER_BASE_URL`   | —       | Carrier API base URL               |
| `SHIPPING_PROVIDER_ACCOUNT_ID` | —       | Carrier account id                 |
| `DELIVERY_QUOTE_TTL_SECONDS`   | `900`   | Quote validity window              |

## Provider interface

Implement `ShippingProvider` (`apps/api/src/shipping/shipping.types.ts`) and
register it in `ShippingModule`, then set `SHIPPING_PROVIDER` to its key.
`listStopDesks`, `validateAddress`, `createShipment`, `trackShipment` and
`cancelShipment` are the surface the app relies on. The default `none` provider
returns empty stop-desks and throws `SHIPPING_PROVIDER_NOT_CONFIGURED` on
shipment operations. Tests use a fake provider; no live carrier calls are made in
automated tests.
