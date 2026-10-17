# BITA COD Starter — First-pass database design

Engine: PostgreSQL 16. ORM: Prisma 7.x (see [ADR-0004](./decisions/0004-postgres-prisma.md)).
Money is stored as integer minor units (`BigInt`) plus a currency code
(see [ADR-0005](./decisions/0005-money-minor-units.md)).

This is a **first pass** intended to lock the entity boundaries. Field lists are
deliberately minimal; indexes and additional columns are added per module as
Phases 2–3 land.

> **Phase 2 status (implemented).** The catalog + inventory slice is now built
> in `apps/api/prisma/schema.prisma` (migration
> `20261011124016_add_catalog_and_inventory`). Implemented models:
> `Product`, `ProductVariant`, `Category`, `ProductCategory`, `ProductImage`,
> `InventoryItem`, `InventoryMovement`. Documented divergences from the
> illustrative schema below:
>
> - `ProductCategory` is an explicit product↔category join (the brief’s entity
>   list) instead of `Category 1—* Product`.
> - Variant price is stored on `ProductVariant` (`price_amount BigInt` +
>   `currency_code`); `VariantPrice` is deferred to the pricing phase.
> - Inventory is one `InventoryItem` per variant (single implicit location)
>   with an append-only `InventoryMovement` ledger. `StockLocation`,
>   `InventoryLevel` and `InventoryReservation` (TTL + orders) move to the
>   orders/COD phase.
> - Deletion is hard (FK cascade), not `deleted_at` soft delete, for Phase 2.
> - DB `CHECK` constraints guard money and inventory invariants (money ≥ 0,
>   `reserved ≤ stocked`, both counters ≥ 0).
>
> See `docs/api/catalog-and-inventory.md` for the API contract.

## Conventions

- Primary keys: `String @id @default(cuid())` (or `uuid()`); human-facing order
  ids use a separate `display_id` integer sequence.
- Timestamps: `created_at`, `updated_at`, `deleted_at` (soft delete where audit
  matters).
- Enums are Prisma enums (native PG enums) mirroring `packages/contracts`.
- All tenant-owned tables may carry `store_id` for defense-in-depth isolation
  (ADR-0010); per-client deployments are the primary isolation boundary.
- Money columns are suffixed `_amount` and are `BigInt`; every money column is
  paired with a `currency_code`.

## Entity relationships (overview)

```
StoreSetting 1───* Currency
User *───* Role (UserRole)

Category 1───* Product        Collection 1───* Product
Product 1───* ProductImage
Product 1───* ProductOption 1───* ProductOptionValue
Product 1───* ProductVariant *───* ProductOptionValue (VariantOptionValue)
ProductVariant 1───1 InventoryItem 1───* InventoryLevel *───1 StockLocation
ProductVariant 1───* VariantPrice
InventoryItem 1───* InventoryReservation *───1 Order

Customer 1───* Address
Customer 1───* Order

Wilaya 1───* ShippingZone 1───* ShippingRate
DeliveryCompany 1───* Order (optional assignment)

Order 1───* OrderItem
Order 1───1 OrderAddress (shipping) / OrderAddress (billing)
Order 1───* OrderStatusHistory
Order 1───1 CodOrder 1───* CodStatusHistory
CodOrder 1───* CodRemittance (later)
IdempotencyKey (standalone, unique by scope+key)
```

## First-pass Prisma schema (illustrative)

```prisma
// packages/database/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ───────────────────────────── Store / settings ─────────────────────────────

model StoreSetting {
  id              String   @id @default(cuid())
  name            String
  default_locale  String   @default("ar")
  timezone        String   @default("Africa/Algiers")
  base_currency   String   @db.VarChar(3)          // "dzd"
  publishable_key String   @unique                  // storefront public key
  cod_enabled     Boolean  @default(true)
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
}

model Currency {
  code         String  @id @db.VarChar(3)
  minor_digits Int     @default(2)
  is_active    Boolean @default(true)
  is_default   Boolean @default(false)
}

// ─────────────────────────── Users / roles (admin) ──────────────────────────

enum RoleName {
  OWNER
  MANAGER
  OPERATOR
  VIEWER
}

model User {
  id            String      @id @default(cuid())
  email         String      @unique
  password_hash String                                // argon2id
  first_name    String?
  last_name     String?
  is_active     Boolean     @default(true)
  roles         UserRole[]
  created_at    DateTime    @default(now())
  updated_at    DateTime    @updatedAt
}

model Role {
  id    String     @id @default(cuid())
  name  RoleName   @unique
  users UserRole[]
}

model UserRole {
  user_id String
  role_id String
  user    User   @relation(fields: [user_id], references: [id])
  role    Role   @relation(fields: [role_id], references: [id])
  @@id([user_id, role_id])
}

model RefreshToken {
  id         String   @id @default(cuid())
  user_id    String
  token_hash String   @unique
  expires_at DateTime
  revoked_at DateTime?
  created_at DateTime @default(now())
}

// ──────────────────────────────── Catalog ───────────────────────────────────

enum ProductStatus {
  draft
  published
  archived
}

model Category {
  id       String    @id @default(cuid())
  name     String
  slug     String    @unique
  parent_id String?
  parent   Category? @relation("CategoryChildren", fields: [parent_id], references: [id])
  children Category[] @relation("CategoryChildren")
  products Product[]
}

model Collection {
  id       String    @id @default(cuid())
  title    String
  handle   String    @unique
  products Product[]
}

model Product {
  id          String        @id @default(cuid())
  title       String
  description String?
  handle      String        @unique
  status      ProductStatus @default(draft)
  thumbnail   String?
  category_id String?
  category    Category?     @relation(fields: [category_id], references: [id])
  collection_id String?
  collection  Collection?   @relation(fields: [collection_id], references: [id])
  images      ProductImage[]
  options     ProductOption[]
  variants    ProductVariant[]
  created_at  DateTime      @default(now())
  updated_at  DateTime      @updatedAt
  deleted_at  DateTime?
}

model ProductImage {
  id         String  @id @default(cuid())
  product_id String
  product    Product @relation(fields: [product_id], references: [id], onDelete: Cascade)
  url        String
  rank       Int     @default(0)
}

model ProductOption {
  id          String                @id @default(cuid())
  product_id  String
  product     Product               @relation(fields: [product_id], references: [id], onDelete: Cascade)
  title       String
  values      ProductOptionValue[]
  @@unique([product_id, title])
}

model ProductOptionValue {
  id        String        @id @default(cuid())
  option_id String
  option    ProductOption @relation(fields: [option_id], references: [id], onDelete: Cascade)
  value     String
  variants  VariantOptionValue[]
}

model ProductVariant {
  id             String            @id @default(cuid())
  product_id     String
  product        Product           @relation(fields: [product_id], references: [id], onDelete: Cascade)
  title          String
  sku            String?           @unique
  position       Int               @default(0)
  manage_inventory Boolean         @default(true)
  allow_backorder  Boolean         @default(false)
  option_values  VariantOptionValue[]
  inventory_item InventoryItem?
  prices         VariantPrice[]
  order_items    OrderItem[]
}

model VariantOptionValue {
  variant_id      String
  option_value_id String
  variant         ProductVariant     @relation(fields: [variant_id], references: [id], onDelete: Cascade)
  option_value    ProductOptionValue @relation(fields: [option_value_id], references: [id], onDelete: Cascade)
  @@id([variant_id, option_value_id])
}

// ─────────────────────────────── Pricing ────────────────────────────────────

model VariantPrice {
  id           String         @id @default(cuid())
  variant_id   String
  variant      ProductVariant @relation(fields: [variant_id], references: [id], onDelete: Cascade)
  currency_code String        @db.VarChar(3)
  amount       BigInt                              // minor units
  @@unique([variant_id, currency_code])
}

// ────────────────────────────── Inventory ───────────────────────────────────

model StockLocation {
  id            String          @id @default(cuid())
  name          String
  is_default    Boolean         @default(false)
  levels        InventoryLevel[]
}

model InventoryItem {
  id            String          @id @default(cuid())
  sku           String?         @unique
  variant_id    String?         @unique
  variant       ProductVariant? @relation(fields: [variant_id], references: [id])
  levels        InventoryLevel[]
  reservations  InventoryReservation[]
}

model InventoryLevel {
  id               String        @id @default(cuid())
  inventory_item_id String
  location_id      String
  inventory_item   InventoryItem @relation(fields: [inventory_item_id], references: [id], onDelete: Cascade)
  location         StockLocation @relation(fields: [location_id], references: [id], onDelete: Cascade)
  stocked_quantity Int           @default(0)
  reserved_quantity Int          @default(0)          // denormalised counter, updated atomically
  @@unique([inventory_item_id, location_id])
}

enum ReservationStatus {
  active
  released
  committed
  expired
}

model InventoryReservation {
  id                String            @id @default(cuid())
  inventory_item_id String
  location_id       String
  order_id          String?
  quantity          Int
  status            ReservationStatus @default(active)
  expires_at        DateTime?
  created_at        DateTime          @default(now())
  inventory_item    InventoryItem     @relation(fields: [inventory_item_id], references: [id], onDelete: Cascade)
  order             Order?            @relation(fields: [order_id], references: [id])
  @@index([order_id])
  @@index([status, expires_at])
}

// ────────────────────────────── Customers ───────────────────────────────────

model Customer {
  id         String    @id @default(cuid())
  email      String?   @unique
  phone      String?   @unique                       // normalised E.164-ish
  first_name String?
  last_name  String?
  addresses  Address[]
  orders     Order[]
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
}

model Address {
  id          String   @id @default(cuid())
  customer_id String?
  customer    Customer? @relation(fields: [customer_id], references: [id], onDelete: Cascade)
  first_name  String?
  last_name   String?
  phone       String?
  address_1   String?
  address_2   String?
  commune     String?
  wilaya_code String?
  country_code String  @db.VarChar(2) @default("dz")
  is_default  Boolean  @default(false)
}

// ────────────────────────────── Shipping ────────────────────────────────────

model Wilaya {
  id          String @id @default(cuid())
  code        String @unique                          // "16" (Alger)
  name_ar     String
  name_fr     String
  name_en     String?
  zones       ShippingZone[] @relation("ZoneWilayas")
}

enum DeliveryType {
  home
  stop_desk
}

model ShippingZone {
  id         String         @id @default(cuid())
  name       String
  wilayas    Wilaya[]       @relation("ZoneWilayas")
  rates      ShippingRate[]
}

model ShippingRate {
  id                String       @id @default(cuid())
  zone_id           String
  zone              ShippingZone @relation(fields: [zone_id], references: [id], onDelete: Cascade)
  delivery_type     DeliveryType
  name              String
  currency_code     String       @db.VarChar(3)
  amount            BigInt                            // minor units
  active            Boolean      @default(true)
  @@unique([zone_id, delivery_type, currency_code])
}

model DeliveryCompany {
  id      String  @id @default(cuid())
  name    String
  active  Boolean @default(true)
  orders  Order[]
}

// ─────────────────────────────── Orders ─────────────────────────────────────

enum OrderStatus {
  pending
  confirmed
  preparing
  with_delivery_company
  delivered
  returned
  cancelled
}

enum PaymentStatus {
  cod_pending
  cod_collected
  cod_remitted
  cod_failed
  cancelled
}

model Order {
  id             String        @id @default(cuid())
  display_id     Int           @unique @default(autoincrement())
  customer_id    String?
  customer       Customer?     @relation(fields: [customer_id], references: [id])
  status         OrderStatus   @default(pending)
  payment_status PaymentStatus @default(cod_pending)

  currency_code  String        @db.VarChar(3)
  subtotal_amount BigInt
  shipping_amount BigInt
  discount_amount BigInt       @default(0)
  total_amount    BigInt

  delivery_type  DeliveryType
  delivery_company_id String?
  delivery_company DeliveryCompany? @relation(fields: [delivery_company_id], references: [id])

  shipping_address_id String?  @unique
  shipping_address    OrderAddress? @relation("OrderShippingAddress", fields: [shipping_address_id], references: [id])
  billing_address_id  String?  @unique
  billing_address     OrderAddress? @relation("OrderBillingAddress", fields: [billing_address_id], references: [id])

  idempotency_key_id String?   @unique
  idempotency_key    IdempotencyKey? @relation(fields: [idempotency_key_id], references: [id])

  items          OrderItem[]
  status_history OrderStatusHistory[]
  cod_order      CodOrder?
  reservations   InventoryReservation[]

  placed_at  DateTime  @default(now())
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt

  @@index([status])
  @@index([created_at])
}

model OrderItem {
  id            String         @id @default(cuid())
  order_id      String
  order         Order          @relation(fields: [order_id], references: [id], onDelete: Cascade)
  variant_id    String?
  variant       ProductVariant? @relation(fields: [variant_id], references: [id])
  title         String
  sku           String?
  quantity      Int
  unit_amount   BigInt                              // minor units, snapshot
  total_amount  BigInt                              // minor units, snapshot
  currency_code String         @db.VarChar(3)
}

model OrderAddress {
  id           String @id @default(cuid())
  first_name   String?
  last_name    String?
  phone        String?
  address_1    String?
  address_2    String?
  commune      String?
  wilaya_code  String?
  country_code String @db.VarChar(2) @default("dz")
}

model OrderStatusHistory {
  id          String      @id @default(cuid())
  order_id    String
  order       Order       @relation(fields: [order_id], references: [id], onDelete: Cascade)
  from_status OrderStatus?
  to_status   OrderStatus
  changed_by  String?
  changed_by_name String?
  note        String?
  created_at  DateTime    @default(now())
  @@index([order_id, created_at])
}

// ──────────────────────────────── COD ───────────────────────────────────────

enum CodStatus {
  new
  no_answer
  confirmed
  preparing
  with_delivery_company
  delivered
  returned
  cancelled
}

model CodOrder {
  id           String    @id @default(cuid())
  order_id     String    @unique                      // one COD order per order
  order        Order     @relation(fields: [order_id], references: [id], onDelete: Cascade)
  status       CodStatus @default(new) @index
  confirmed_at DateTime?
  confirmed_by String?
  history      CodStatusHistory[]
  remittances  CodRemittance[]
  created_at   DateTime  @default(now())
  updated_at   DateTime  @updatedAt
}

model CodStatusHistory {
  id           String    @id @default(cuid())
  cod_order_id String
  cod_order    CodOrder  @relation(fields: [cod_order_id], references: [id], onDelete: Cascade)
  order_id     String    @index
  from_status  CodStatus?
  to_status    CodStatus
  changed_by   String?
  changed_by_name String?
  note         String?
  created_at   DateTime  @default(now())
  @@index([cod_order_id, created_at])
}

// Optional, later: cash reconciliation with the delivery company.
model CodRemittance {
  id           String   @id @default(cuid())
  cod_order_id String
  cod_order    CodOrder @relation(fields: [cod_order_id], references: [id], onDelete: Cascade)
  amount       BigInt
  currency_code String  @db.VarChar(3)
  remitted_at  DateTime?
  reference    String?
  created_at   DateTime @default(now())
}

// ──────────────────────────── Idempotency ───────────────────────────────────

model IdempotencyKey {
  id          String   @id @default(cuid())
  scope       String                                  // e.g. "order.create"
  key         String                                  // client-supplied
  request_hash String?
  response_id String?                                 // created order id
  created_at  DateTime @default(now())
  expires_at  DateTime?
  order       Order?
  @@unique([scope, key])
}
```

## Notes and open items

- `display_id` uses a Postgres sequence so customer-facing order numbers remain
  small and gap-tolerant; it is independent of the internal `id`.
- Address data is **snapshotted** onto `OrderAddress` at order time so later
  edits to `Customer`/`Address` never mutate historical orders.
- `OrderItem` snapshots title/sku/unit price at order time (same reason).
- `InventoryLevel.reserved_quantity` is a denormalised counter updated inside the
  same transaction as the reservation, guarded by an atomic conditional update to
  prevent overselling (ADR-0008). `InventoryReservation` is the durable ledger.
- Whether `store_id` is added to every table (ADR-0010) is pending; the primary
  isolation model is per-client deployment.
- Search, media variants, tax, discounts, and multi-warehouse fulfillment are
  intentionally out of scope for the first pass.

## Phase 4 — Locations, shipping & delivery rates

Additive slice (migration `20261011150000_add_locations_and_shipping`); see
ADR-0012 and `docs/api/shipping-and-locations.md`.

- `Wilaya` — extended with `latitude`, `longitude`, `position` (stable ordinal
  order from the dataset), `is_active`, `updated_at`.
- `Commune` — `code` (internal, unique), `post_code` (unique, used as
  `commune_code` at checkout), `name_fr`/`name_ar`, `daira`/`daira_ar`,
  `wilaya_code → Wilaya.code`, coordinates, `verification_status`
  (`LocationReviewStatus`) + `verification_note`, `is_active`.
- `LegacyLocationCode` — carrier/legacy codes kept separate from administrative
  data: `provider`, `legacy_code`, `wilaya_code?`, `commune_code → Commune.code`,
  `label`, unique `(provider, legacy_code)`.
- `DeliveryRate` — added `provider` (default `""` = store tariff) and the unique
  key `(wilaya_code, method, currency_code, provider)`.
- `Order` — added `commune_code`, the frozen quote (`delivery_quote_provider`,
  `delivery_quote_snapshot Json?`, `delivery_quote_issued_at`,
  `delivery_quote_expires_at`) and stop-desk snapshot columns
  (`stop_desk_id/name/provider/address`).

Orders snapshot addresses and quotes; they never depend on the mutable
`commune`/`delivery_rate` rows. Commune rows are reference data rebuilt by the
seed and are not referenced by orders.
