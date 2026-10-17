# BITA COD Starter

A cash-on-delivery (COD) focused ecommerce starter for BITA Agency: a custom
modular monolith built with NestJS, Next.js, PostgreSQL, and Prisma. No
third-party ecommerce engine (see `docs/decisions/0001-no-ecommerce-engine.md`).

> **Phase 6 (current):** **order operations & store admin** — an admin order
> dashboard (filter/sort/paginate), an order detail with guarded status actions
> and an immutable history, printer-friendly slips, and a filter-aware CSV
> export. The backend gained safe named transitions with optimistic concurrency,
> reservation release on cancellation/return, and an allow-listed export. The
> operator UI is folded into the storefront as an `/admin` route group (Arabic +
> French) and authenticates with the existing shared admin key over an httpOnly
> session cookie. See `docs/api/order-operations.md`.
>
> Earlier phases: **Phase 5** delivered the customer-facing COD storefront
> (`docs/decisions/0013-storefront-i18n.md`); **Phase 4** added the Algeria
> shipping/location abstraction (`docs/api/shipping-and-locations.md`);
> **Phase 3** added guest COD orders, idempotent creation, and the order state
> machine; **Phase 2** added the catalog and inventory domain
> (`docs/api/catalog-and-inventory.md`); **Phase 1** delivered the monorepo
> skeleton. Per-operator auth (RBAC), collection/remittance tracking, client
> provisioning, and production cutover remain later phases.

## Repository layout

```
.
├── apps/
│   ├── api/          # NestJS 11 API (Prisma 7, Zod env validation, health checks)
│   └── storefront/   # Next.js 15 storefront (App Router, RTL by default)
├── docs/             # Architecture, database design, ADRs, risks, backlog
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

The workspace currently contains only `apps/*`. Shared `packages/*`
(`contracts`, `database`, `config`) arrive in Phase 2; the workspace glob is
intentionally omitted until then (see `docs/decisions/0003-monorepo-tooling.md`).

## Prerequisites

- **Node.js** — **Node 24 LTS ("Krypton") is recommended and pinned in
  `.nvmrc`** (`nvm use` / `fnm use`). The root `engines` field requires
  `>=24.0.0`. Node 26 (Current; becomes LTS on 2026-10-28) also works, though
  Prisma 7's installer prints a support notice for it.
- **pnpm** 10.x (`corepack enable` or `npm i -g pnpm@10`)
- **PostgreSQL** 16+ running locally

## Setup

```bash
# 1. Install workspace dependencies
pnpm install

# 2. Create the databases (dev + test are separate; only dev is required here)
createdb bita_cod_starter

# 3. Configure environment
cp .env.example apps/api/.env
cp .env.example apps/storefront/.env.local
#    In apps/api/.env, set DATABASE_URL with an EXPLICIT user, e.g.
#    postgresql://YOUR_USER@localhost:5432/bita_cod_starter
#    (Prisma migrate requires a user in the URL.)

# 4. Generate the Prisma client and apply migrations
pnpm db:generate
pnpm db:migrate

# 5. Run everything (API on :3001, storefront on :3000)
pnpm dev
```

Verify the API:

```bash
curl http://localhost:3001/api/health      # liveness  -> {"status":"ok",...}
curl http://localhost:3001/api/health/db   # readiness -> {"status":"ok","database":{"connected":true}}
```

## Common scripts

Run from the repository root unless noted.

| Command            | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| `pnpm dev`         | Start API + storefront in watch mode                            |
| `pnpm build`       | Build both apps                                                 |
| `pnpm test`        | Unit tests (Jest for API, Vitest for storefront)                |
| `pnpm test:e2e`    | API end-to-end tests (requires a reachable database)            |
| `pnpm typecheck`   | TypeScript checks across the workspace                          |
| `pnpm format`      | Prettier write                                                  |
| `pnpm db:validate` | Validate the Prisma schema                                      |
| `pnpm db:generate` | Generate the Prisma client into `apps/api/src/generated/prisma` |
| `pnpm db:migrate`  | Create + apply a dev migration                                  |
| `pnpm db:deploy`   | Apply committed migrations (CI/production)                      |
| `pnpm db:seed`     | Upsert reference data (currencies, store setting)               |
| `pnpm db:reset`    | Drop, recreate, and re-migrate the database                     |
| `pnpm db:studio`   | Open Prisma Studio                                              |

### Database migrations

The Prisma schema lives at `apps/api/prisma/schema.prisma` and is configured by
`apps/api/prisma.config.ts` (Prisma 7 config file; no `url` in the schema):

```bash
pnpm db:migrate                      # prisma migrate dev (prompts for a name)
pnpm --filter @bita/api exec prisma migrate dev --name add_products
pnpm db:generate                     # regenerate the client after schema edits
```

Migrations are committed under `apps/api/prisma/migrations/`. In CI/production
use `pnpm db:deploy` (never `migrate dev`).

## Key implementation notes (Phase 1)

- **NestJS 11, not 12.** Nest 12 is ESM-only and conflicts with Jest 29, the
  CommonJS `nest build`, and the CJS Prisma client. See
  `docs/decisions/0011-nestjs-version.md`.
- **Prisma 7.** Uses the `prisma-client` generator with
  `moduleFormat = "cjs"` and `importFileExtension = ""`, the required
  `prisma.config.ts`, and the `@prisma/adapter-pg` driver adapter. The generated
  client is git-ignored and regenerated by the `pre*` scripts (e.g. `prebuild`,
  `pretest`) and `pnpm db:generate`.
- **Single DB owner.** For Phase 1 the Prisma schema/client live inside
  `apps/api` (single writer). A shared `packages/database` package is deferred
  until a second consumer exists.
- **Health endpoints.** `GET /api/health` is liveness (always 200 when the
  process is up); `GET /api/health/db` is readiness (503 when Postgres is
  unreachable). The API does not crash if the DB is down at boot.
- **Env validation.** The API validates its environment with Zod at startup and
  fails fast on misconfiguration.

## Key implementation notes (Phase 2)

- **Catalog + inventory models.** `Product`, `ProductVariant`, `Category`,
  `ProductCategory`, `ProductImage`, `InventoryItem`, `InventoryMovement` added
  in migration `20261011124016_add_catalog_and_inventory`. Money is integer
  minor units (`BIGINT`) + `currency_code` (ADR-0005); DB `CHECK` constraints
  guard `stocked >= 0`, `reserved >= 0`, `reserved <= stocked`, and
  non-negative prices.
- **Transactional inventory.** Counter changes run in interactive
  `prisma.$transaction` with `SELECT … FOR UPDATE` row locks (ADR-0008) plus an
  append-only `InventoryMovement` ledger; overselling returns `409
INSUFFICIENT_STOCK`. Covered by a concurrent-reservation e2e test (N requests
  for the last unit → exactly one succeeds).
- **Duplicate SKUs.** `ProductVariant.sku` is globally unique and normalised to
  upper-case by the API, so uniqueness is case-insensitive; duplicates return
  `409 DUPLICATE_SKU`.
- **Validation + errors.** Zod schemas validate every body/query; a global
  filter maps typed domain errors to stable HTTP codes; a BigInt interceptor
  serialises money as strings.
- **Admin authorization (placeholder).** Mutations require the
  `x-admin-api-key` header matched against `ADMIN_API_KEY` (fails closed when
  unset). Replaced by JWT + RBAC in Phase 3 (ADR-0007).

## Key implementation notes (Phase 5)

- **Server-rendered, locale-free routes.** Pages resolve the active locale
  (`ar` default, `fr`) from a `locale` cookie set by `?lang=`; the root layout
  reads the cookie to set `dir`/`lang`, and Arabic/French strings live in
  `apps/storefront/src/lib/i18n/dictionaries.ts`. See ADR-0013.
- **HTTP-only data access.** All product/catalog/location/delivery/order data
  comes from the existing APIs via `apps/storefront/src/lib/api.ts`; the browser
  never reimplements pricing, stock, or delivery rules. Delivery totals are
  previews — the API is authoritative at checkout.
- **Guest COD checkout.** Cart state persists in `localStorage`; an idempotency
  key derived from the cart signature is stored in `sessionStorage` so retries
  of an unchanged order are deduplicated by the server (ADR-0009). Delivery
  quotes are fetched per wilaya + method and reflect `DELIVERY_UNAVAILABLE`
  rather than guessing a price. The order-success page is `noIndex` and keyed by
  an opaque tracking token.
- **Per-deployment branding.** `apps/storefront/src/config/store.ts` maps
  `NEXT_PUBLIC_*` variables to CSS variables and neutral defaults; the agency
  brand is never shown to customers. No secrets belong in `NEXT_PUBLIC_*`.
- **Public read endpoints.** The storefront reads products and branding from
  public routes; only catalog/inventory mutations require `x-admin-api-key`.

## Key implementation notes (Phase 6)

- **One guarded mutation path.** Every status change goes through
  `OrderService.applyStatusTransition`, which re-checks the state machine, applies
  a *conditional* update so concurrent transitions resolve to exactly one winner
  (loser → `409`), writes one history row, and releases/commits reservations.
- **Admin UI folded into the storefront.** Route groups `(store)` and `admin`
  split the chrome; the root layout keeps only the document shell + locale
  direction. Order operations reuse the storefront's i18n and money helpers.
- **The admin key never reaches the browser.** It is verified on login then held
  in an httpOnly cookie; server components/actions/route handlers attach it as
  `x-admin-api-key`. Middleware only redirects; the API guard is authoritative.
- **Export is allow-listed.** `tracking_token` and the delivery-quote snapshot are
  never exported; the CSV matches the current filters (BOM-prefixed for Excel).

## Documentation

- `docs/api/order-operations.md` — Phase 6 order operations API + admin surface
- `docs/api/catalog-and-inventory.md` — Phase 2 catalog/inventory API + verification
- `docs/api/shipping-and-locations.md` — Phase 4 shipping/location API + verification
- `docs/shipping-location-data.md` — Algeria wilaya/commune dataset provenance
- `docs/architecture.md` — target architecture and cross-cutting concerns
- `docs/database-design.md` — full commerce data model (Phase 2+)
- `docs/decisions/` — Architecture Decision Records (incl. ADR-0013 storefront i18n)
- `docs/risk-register.md`, `docs/implementation-backlog.md`
