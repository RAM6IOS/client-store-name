# Catalog & Inventory API (Phase 2)

Phase 2 adds the first commerce domain: the product catalog and inventory.
It is built on the ADRs in `docs/decisions/` and the entity design in
`docs/database-design.md`, with a few documented, deliberate simplifications
(see “Design notes & divergences” below).

- Money: integer minor units (`BIGINT`), `ADR-0005`
- Inventory concurrency: row-locked transactions (`SELECT … FOR UPDATE`), `ADR-0008`
- Auth: shared admin key placeholder (`ADR-0007` is Phase 3)

Base URL: `http://localhost:3001/api`

## Authentication

All **mutating** catalog and inventory endpoints require the header:

```
x-admin-api-key: <ADMIN_API_KEY>
```

`ADMIN_API_KEY` is read from the environment. The guard **fails closed**: when
the variable is unset, every protected request returns `401`
(`ADMIN_API_KEY_NOT_CONFIGURED`). Read endpoints are public so the storefront
can use them.

> Phase 2 placeholder. Phase 3 replaces this with JWT access tokens + RBAC
> (`OWNER`/`MANAGER`/`OPERATOR`/`VIEWER`) per ADR-0007.

Optional audit header: `x-actor: <user-or-system>` is recorded as
`created_by` on inventory movements.

## Money

Every amount is an integer number of **minor units** plus an ISO-4217
`currency_code`. The exponent is `Currency.minor_digits` (DZD = 2):

```
1500.00 DZD  ==  150000 minor units
```

- Prices are **never** floating point. `price_amount` is stored as `BIGINT`.
- Request bodies accept either `price_amount` (integer minor units) or `price`
  (a decimal string in major units, e.g. `"1500.00"`), which the API converts
  using the currency exponent.
- Parsing uses **round-half-up** (away from zero) at the minor-unit boundary,
  defined once in `apps/api/src/common/money/money.ts`.
- Negative prices are rejected (`400`).
- Monetary values are serialised as **strings** in JSON responses (never
  numbers) to avoid precision loss.

## Catalog endpoints

### Products

| Method   | Path                    | Auth | Description                                             |
| -------- | ----------------------- | ---- | ------------------------------------------------------- |
| `POST`   | `/catalog/products`     | yes  | Create a product (simple or with variants)              |
| `GET`    | `/catalog/products`     | no   | List/paginate/filter products                           |
| `GET`    | `/catalog/products/:id` | no   | Retrieve one product with variants, images, categories  |
| `PATCH`  | `/catalog/products/:id` | yes  | Update title/description/handle/status/thumbnail        |
| `DELETE` | `/catalog/products/:id` | yes  | Delete a product (cascades variants, images, inventory) |

List query params: `page` (default 1), `pageSize` (default 20, max 100),
`status` (`draft`\|`published`\|`archived`), `category` (id or slug),
`search` (matches title/handle, case-insensitive).

**Simple product** — omit `variants`; a single `is_default` variant is created
automatically from the product-level `sku`, price and `initial_stock`:

```bash
curl -s -X POST "$API/catalog/products" \
  -H "x-admin-api-key: $KEY" -H "content-type: application/json" \
  -d '{
    "title": "Cotton T-Shirt",
    "handle": "cotton-tshirt-black",
    "currency_code": "DZD",
    "price_amount": "150000",
    "sku": "TEE-BLK-M",
    "initial_stock": 25,
    "images": [{ "url": "https://cdn.example.com/tee.jpg", "rank": 0 }],
    "categories": [{ "category_id": "<category-id>" }]
  }'
```

**Variant product** — provide a `variants` array. Each variant resolves its
currency from `currency_code` or falls back to the product-level currency:

```bash
curl -s -X POST "$API/catalog/products" \
  -H "x-admin-api-key: $KEY" -H "content-type: application/json" \
  -d '{
    "title": "Oxford Shirt",
    "handle": "oxford-shirt",
    "currency_code": "DZD",
    "variants": [
      { "title": "Small",  "sku": "OX-S", "price_amount": "420000", "initial_stock": 4 },
      { "title": "Medium", "sku": "OX-M", "price": "4300.00", "initial_stock": 6 }
    ]
  }'
```

### Variants

| Method   | Path                             | Auth | Description                                        |
| -------- | -------------------------------- | ---- | -------------------------------------------------- |
| `POST`   | `/catalog/products/:id/variants` | yes  | Add a variant (optionally with `initial_stock`)    |
| `PATCH`  | `/catalog/variants/:id`          | yes  | Update title/sku/position/price/inventory flags    |
| `DELETE` | `/catalog/variants/:id`          | yes  | Delete a variant (cascades its inventory + ledger) |

### Images

| Method   | Path                                 | Auth | Description                             |
| -------- | ------------------------------------ | ---- | --------------------------------------- |
| `POST`   | `/catalog/products/:id/images`       | yes  | Append an image by URL                  |
| `POST`   | `/catalog/products/:id/images/upload`| yes  | Upload one or more image files (multipart) |
| `DELETE` | `/catalog/images/:id`                | yes  | Delete an image                         |

Uploaded files are validated by content (magic-byte sniffing), not by the
client-declared MIME type. Accepted formats: **JPEG, PNG, WebP and AVIF**.
Limits: **5 MB per file** and **20 images per product** (enforced per request
by the interceptor). Files are stored durably on the API host under `MEDIA_DIR`
and served back read-only at `GET /media/products/:file`; the stored URL is
returned by the upload and persisted on `ProductImage.url`.

```bash
curl -s -X POST "$API/catalog/products/$ID/images/upload" \
  -H "x-admin-api-key: $KEY" \
  -F "files=@tee-front.jpg" -F "files=@tee-back.avif"
```

Rejected uploads return `INVALID_IMAGE` (unrecognised content), `FILE_TOO_LARGE`
(over 5 MB) or `IMAGE_COUNT_EXCEEDED` (more than 20 for the product).

### Categories

| Method   | Path                      | Auth | Description                                                               |
| -------- | ------------------------- | ---- | ------------------------------------------------------------------------- |
| `POST`   | `/catalog/categories`     | yes  | Create a category (slug auto-generated if omitted)                        |
| `GET`    | `/catalog/categories`     | no   | List categories (`?includeInactive=true`)                                 |
| `GET`    | `/catalog/categories/:id` | no   | Retrieve a category with parent/children                                  |
| `PATCH`  | `/catalog/categories/:id` | yes  | Update a category                                                         |
| `DELETE` | `/catalog/categories/:id` | yes  | Delete a category (product links cascade; children re-parented to `null`) |

## Inventory endpoints

| Method | Path                                       | Auth | Description                                        |
| ------ | ------------------------------------------ | ---- | -------------------------------------------------- |
| `GET`  | `/inventory`                               | no   | List inventory items (`?lowStock=true`, paginated) |
| `GET`  | `/inventory/variants/:variantId`           | no   | Availability (`stocked`, `reserved`, `available`)  |
| `GET`  | `/inventory/variants/:variantId/movements` | no   | Append-only movement ledger (paginated)            |
| `POST` | `/inventory/variants/:variantId/adjust`    | yes  | Signed stock adjustment                            |
| `POST` | `/inventory/variants/:variantId/reserve`   | yes  | Reserve stock (atomic)                             |
| `POST` | `/inventory/variants/:variantId/release`   | yes  | Release reserved stock                             |

`available = stocked_quantity - reserved_quantity`.

Adjust body: `{ "quantity": <non-zero int>, "type": "receipt"|"adjustment"|"return", "reason"?, "reference"? }`.
`receipt`/`return` must be positive; `adjustment` may be negative.

Reserve/release body: `{ "quantity": <positive int>, "reason"?, "reference"? }`.

### Concurrency (no overselling)

Every counter change runs in an interactive `prisma.$transaction` that:

1. locks the `inventory_items` row with `SELECT … FOR UPDATE` (`ADR-0008`),
2. re-checks the invariant against the freshly locked values,
3. updates the counters and appends exactly one `inventory_movements` row.

`reserve` returns **409 `INSUFFICIENT_STOCK`** when availability is
insufficient. DB `CHECK` constraints
(`stocked >= 0`, `reserved >= 0`, `reserved <= stocked`) are the final backstop.

## Deletion behaviour (defined rules)

- `Product` → hard delete. Cascades to `ProductVariant`, `ProductImage`,
  `ProductCategory`.
- `ProductVariant` → hard delete. Cascades to `InventoryItem` and its
  `InventoryMovement` ledger.
- `Category` → hard delete. `ProductCategory` links cascade; child categories
  keep existing with `parent_id = NULL`.
- `ProductImage` → hard delete.
- Soft-delete/audit history is deferred to the orders phase, where mutations
  must be preserved.

## SKU uniqueness scope

`ProductVariant.sku` is **globally unique** across the catalog (one SKU maps to
at most one sellable variant, which keeps SKU ↔ inventory unambiguous). The API
normalises SKUs to **upper-case** before persisting, so uniqueness is
effectively case-insensitive: `tee-blk-m` and `TEE-BLK-M` collide. Duplicates
return **409 `DUPLICATE_SKU`**. `NULL` SKUs are allowed and are not deduplicated.

## Error format

```json
{
  "statusCode": 409,
  "code": "INSUFFICIENT_STOCK",
  "message": "…",
  "details": {},
  "path": "/api/…",
  "timestamp": "…"
}
```

Common codes: `VALIDATION_ERROR` (400), `UNKNOWN_CURRENCY` (400),
`INVALID_PRICE` (400), `INVALID_STOCK` (400), `UNAUTHORIZED` (401),
`NOT_FOUND` (404), `DUPLICATE_SKU` / `DUPLICATE_HANDLE` / `DUPLICATE_SLUG`
(409), `INSUFFICIENT_STOCK` (409), `CONFLICT` (409).

## Design notes & divergences from `docs/database-design.md`

The Phase 2 brief lists a specific entity set (Product, ProductVariant,
Category, ProductCategory, ProductImage, InventoryItem, InventoryMovement).
Where it differs from the first-pass design, the brief wins and the design doc
is updated:

- **ProductCategory** is an explicit many-to-many join instead of
  `Category 1—* Product`.
- **Variant price** lives on `ProductVariant` (`price_amount` / `currency_code`);
  the separate `VariantPrice` model is deferred to the pricing phase.
- **Inventory** is a single `InventoryItem` per variant (one implicit location)
  plus an append-only `InventoryMovement` ledger. `StockLocation`,
  `InventoryLevel` and `InventoryReservation` (TTL/orders) arrive with the
  orders/COD phase.
- `Collection`, `ProductOption`, `ProductOptionValue`, `VariantOptionValue`
  are not part of Phase 2.
- Deletion is hard (cascade) rather than `deleted_at` soft delete for now.

## Reproducible verification

```bash
# 1. Schema + migration
pnpm db:validate                         # prisma validate
pnpm --filter @bita/api exec prisma migrate status

# 2. Regenerate the client and seed reference currencies
pnpm db:generate
pnpm db:seed                             # upserts DZD/USD/EUR + store setting

# 3. Unit tests (fast, no DB)
pnpm test

# 4. Integration/e2e tests (requires PostgreSQL on DATABASE_URL)
pnpm --filter @bita/api test:e2e

# 5. Types + lint
pnpm typecheck
pnpm lint

# 6. Optional: exercise the API by hand
ADMIN_API_KEY=<your-dev-key>
curl -s http://localhost:3001/api/catalog/products | jq
curl -s -X POST http://localhost:3001/api/catalog/products \
  -H "x-admin-api-key: $ADMIN_API_KEY" -H "content-type: application/json" \
  -d '{"title":"Demo","currency_code":"DZD","price_amount":"1000","initial_stock":3}' | jq
```
