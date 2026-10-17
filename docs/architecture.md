# BITA COD Starter — Architecture

Phase 0 deliverable: audit of the existing `bita-ecommerce-starter` repository,
the target architecture for a custom Cash-on-Delivery (COD) ecommerce system,
and the plan to migrate to it.

Status: **proposal — awaiting approval**. Nothing in the source repository has
been modified, copied, deployed, or deleted.

Source repository audited:
`/Users/macbookpro/Documents/bita-ecommerce-starter`
Target project (this repository): `/Users/macbookpro/Documents/BITA_COD_Starter`

---

## Part A — Audit of the existing repository

### A.1 What the repository is

A fork of the **Medusa DTC Starter** (Turborepo monorepo) that has been
customised by BITA Agency for an Algerian, COD-first storefront.

```
bita-ecommerce-starter/
├── apps/
│   ├── backend/     # Medusa v2 application (@dtc/backend)
│   └── storefront/  # Next.js 15 App Router storefront (@dtc/storefront)
├── package.json     # pnpm workspace root, turbo
├── pnpm-workspace.yaml
└── .github/workflows/update.yaml   # medusa-update-action (opened PRs via Anthropic key)
```

It is **not** a pristine starter. The README/AGENTS.md still describe Medusa,
but the product surface has already been pushed toward COD + Algeria:

- DZD currency, Algeria region, "BITA Online Store" sales channel, Home Delivery
  and Stop Desk shipping options (`backend/src/scripts/bita-setup.ts`,
  `bita-checkout-setup.ts`).
- A custom Medusa module `cod` with its own data model, state machine, API
  routes, workflows, subscriber, admin pages and widgets.
- A dedicated storefront product landing + COD order form (no payment gateway;
  `pp_system_default`).
- Algerian wilaya/phone utilities and COD i18n.

So the repository already encodes most of the **business intent** we need, but it
does so on top of Medusa's data model, service container, workflow engine, module
loader and admin dashboard. Phase 1+ replaces the engine; it must preserve the
intent.

### A.2 Medusa-specific surface (the part that does not survive the move)

Everything below depends on `@medusajs/*` and must be re-implemented or dropped.

**Backend (`apps/backend`):**

| Area | Files | Notes |
| --- | --- | --- |
| Config | `medusa-config.ts` | DB URL, CORS, JWT/COOKIE secrets, module registration |
| Custom module | `src/modules/cod/{index,service,types,models/*,migrations/*}` | `MedusaService`, `model.define`, `Migration*.ts`, `.snapshot-cod.json` |
| Workflows | `src/workflows/create-bita-product.ts`, `transition-cod-order.ts` | `createStep`/`createWorkflow`/`transform`, `@medusajs/medusa/core-flows` |
| API routes | `src/api/admin/**` (file-based), `src/api/middlewares.ts` | `AuthenticatedMedusaRequest`, `req.scope.resolve`, zod schemas |
| Subscribers | `src/subscribers/cod-order-placed.ts`, `password-reset.ts` | `OrderWorkflowEvents.PLACED` |
| Admin extensions | `src/admin/routes/cod/page.tsx`, `products/bita-create/page.tsx`, `widgets/*`, `lib/*`, `i18n/*` | `@medusajs/admin-sdk`, `@medusajs/ui`, widgets into Medusa dashboard |
| Scripts | `src/scripts/{bita-setup,bita-checkout-setup,seed-demo-products}.ts` | core-flows |
| Search | `src/search/product.ts` + helpers | Medusa search index config |
| Migration scripts | `src/migration-scripts/{backfill-cod-orders,initial-data-seed,set-*-layout}.ts` | Medusa container |

**Storefront (`apps/storefront`):**

| Area | Files | Notes |
| --- | --- | --- |
| SDK wiring | `src/lib/config.ts` (`@medusajs/js-sdk`), `middleware.ts` (`/store/regions`) | publishable key, region cookie |
| Data layer | `src/lib/data/*` (`cart.ts`, `cod.ts`, `products.ts`, `customer.ts`, `regions.ts`, ...) | all call `/store/*` Medusa routes |
| Search | `src/lib/search-client.ts` (`@medusajs/instantsearch-adapter`), `/store/search` | |
| Checkout | `src/modules/checkout/**`, `src/app/[countryCode]/(checkout)` | Medusa multi-step cart/checkout |
| Every module | `src/modules/**` | imports `HttpTypes` from `@medusajs/types` throughout |

Usage counts in source: `@medusajs/types` 88, `@medusajs/framework` 69,
`@medusajs/icons` 30, plus `@medusajs/admin-sdk`, `@medusajs/ui`,
`@medusajs/medusa`, `@medusajs/dashboard`, `@medusajs/js-sdk`.

### A.3 Reusable assets (business logic and UI worth porting)

These carry intent that should be re-expressed on the new stack rather than
rewritten from scratch.

1. **COD state machine** — `src/modules/cod/types.ts`
   - Statuses: `new, no_answer, confirmed, preparing, with_delivery_company,
     delivered, returned, cancelled`.
   - Explicit transition table, terminal detection, guards. This is
     framework-agnostic and should move into `packages/contracts` almost verbatim.
   - `CodOrderStatusHistory` (from/to status, actor id/name, note) is the audit
     trail model we want to keep.

2. **Transition workflow** — `src/workflows/transition-cod-order.ts`
   - Validate → guard illegal transition (UNEXPECTED_STATE → HTTP 409) → update
     → append history. The compensation (rollback) pattern is a good reference,
     not required if we use DB transactions.

3. **COD order creation trigger** — `src/subscribers/cod-order-placed.ts`
   - COD order is created when an order is placed and metadata says
     `delivery_intent=cod` / `payment_method=cod`. In the new system this is a
     normal part of order creation, not an event handler.

4. **Order↔COD admin read model** — `src/api/admin/cod-orders/route.ts` and
   `orders/[id]/cod/route.ts`: loyalty to customer name/phone/wilaya/commune/
   delivery type. Good field list for our admin API contract.

5. **Storefront COD flow** — `src/modules/products/components/product-landing/*`
   (`cod-order-form`, `delivery-method`, `wilaya-select`, `order-summary`,
   `quantity-selector`, `cod-order-success`, `mobile-order-bar`, `trust-faq`) and
   `src/lib/data/cod.ts`. The UX (dedicated cart, live quote, delivery-type
   verification, in-place success) is the core product and should be preserved.

6. **Domain utilities** — `src/lib/util/phone.ts` (Algerian phone
   normalise/validate), `src/lib/util/algeria-wilayas.ts` (wilaya list),
   `src/lib/util/cod-i18n.ts`, `money.ts` (currency formatting),
   `email.ts` (email validation).

7. **Shared UI primitives** — `src/modules/common/components/*` (input, radio,
   checkbox, modal, native-select, ui helpers), `src/modules/skeletons/**`,
   `src/modules/layout/components/*`. Mostly plain React + Tailwind, reusable
   with the Medusa `HttpTypes` stripped out.

8. **Tests worth porting**:
   - `backend/src/workflows/__tests__/transition-cod-order.unit.spec.ts`
   - `backend/src/workflows/__tests__/create-bita-product.unit.spec.ts`
   - `backend/src/admin/lib/__tests__/{bita-product,inventory-levels}.unit.spec.ts`
   - `backend/integration-tests/http/bita-products.spec.ts`
   - `storefront/src/lib/data/cod.test.ts`
   - `storefront/src/modules/products/components/product-landing/__tests__/cod-order-form.test.tsx`
   - `storefront/src/modules/layout/components/language-select/__tests__/language-select.test.tsx`

### A.4 Things to leave behind

- The `@medusajs/*` admin dashboard and all `src/admin/**` extensions.
- Medusa cart/checkout/payment orchestration and `pp_system_default`.
- Medusa regions/sales-channels/price-set plumbing (we model store settings and
  prices directly).
- `@medusajs/instantsearch-adapter` + `/store/search` (replace with our own
  search query; Algolia/Meilisearch is a later decision).
- The `.github/workflows/update.yaml` Medusa auto-update action.
- Unused dependency `pg` in the storefront (no direct `pg` usage found).

### A.5 Version report

Measured on this machine and from manifests/lockfile.

| Component | Current (source repo) | Found on machine |
| --- | --- | --- |
| Node.js | `engines: >=22.22.0` (README says v20+) | **v26.7.0** |
| pnpm | `packageManager: pnpm@10.11.1` | **10.26.1** |
| npm | — | 11.19.0 |
| Next.js | `15.5.24` | — |
| React / ReactDOM | storefront `19.0.5`; backend admin `18.3.1` | — |
| TypeScript | backend `^5.6.2`; storefront `^5.3.2` | — |
| PostgreSQL | README `15+` | **16.15 (Homebrew)** |
| Prisma | **not present anywhere** | CLI not installed |
| Medusa | `2.21.2` (`@medusajs/*`) | — |
| Turborepo | `^2.0.14` | — |
| Jest / Vitest | `^29.7.0` / `^5.0.3` | — |
| ESLint | `^9.39.4` | — |

No Prisma schema, no `@prisma/*` dependency, and no direct `pg` usage in the app
code exist today. The current persistence is entirely Medusa's MikroORM-based
data layer.

### A.6 Recommended target versions (do not upgrade blindly)

Rationale: prefer current LTS lines, matching majors where the source already
has them, and avoid release-candidate software in the initial build.

| Component | Recommended | Why |
| --- | --- | --- |
| Node.js | **22.x LTS** (pin `>=22.12.0`), CI uses same | Supported by NestJS 11/12, Prisma 7/8, Next 15/16. Machine has 26.7.0 (odd/current); pin the project to 22 LTS for determinism. |
| pnpm | **10.x** (keep `10.x`, pin exact) | Already used; keep one lockfile. |
| NestJS | **11.x LTS** initially; 12.x as a fast-follow | Nest 12 is current (12.1.x) and Node 20.19+/22.12+; Nest 11 is lower-risk first target. Decide in ADR-0011. |
| Next.js | **15.5.27** (patch of the existing 15.5.24) | 15.5 is Maintenance LTS; avoids a major jump. Plan Next 16 later. |
| React | **19.x** (storefront), align admin to 19 | App Router + Next 15. |
| PostgreSQL | **16.x** (keep local 16.15; prod 16) | Already present; well supported. |
| Prisma | **7.x stable** (pin), track **8.x** after GA | Prisma 8 is still RC (GA expected Oct 2026). Prisma 7 remains fully supported. |
| TypeScript | **5.9.x** | Meets Prisma 8 requirement; safe for Nest/Next. |
| Test runners | **Jest** for API (Nest default) … | See Part D. |

> Do not bulk-upgrade the source repository. These versions apply to the **new**
> project. The source repo is migrated, then retired (Part E).

---

## Part B — Target architecture

### B.1 Principles

1. **No ecommerce engine.** Commerce domain (catalog, inventory, pricing,
   orders, COD) is owned code.
2. **Modular monolith.** One deployable API with strict internal module
   boundaries. No microservices.
3. **Independent per client.** One client = one project, database, set of
   credentials, and infrastructure. No shared runtime or shared schema.
4. **Contracts first.** DTOs/validation shared via a package so API, storefront
   and admin cannot drift.
5. **Boring, observable, and testable.** Transactions for correctness; explicit
   state machines; health checks; structured logs.

### B.2 Proposed monorepo structure

```
BITA_COD_Starter/
├── apps/
│   ├── api/                      # NestJS API (modular monolith, owner of all writes)
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── common/           # filters, interceptors, guards, pipes, decorators
│   │   │   │   ├── auth/         # JWT guard, roles guard, current-user decorator
│   │   │   │   ├── errors/       # domain error -> HTTP mapping
│   │   │   │   └── money/        # Money value object helpers (server side)
│   │   │   └── modules/
│   │   │       ├── auth/         # admin + (optional) customer sessions
│   │   │       ├── users/        # admin users, roles
│   │   │       ├── customers/
│   │   │       ├── catalog/      # products, variants, options, media
│   │   │       ├── inventory/    # stock locations, levels, reservations
│   │   │       ├── pricing/      # price lists / variant prices
│   │   │       ├── shipping/     # wilayas, zones, rates, delivery companies
│   │   │       ├── orders/       # order lifecycle, items, addresses
│   │   │       ├── cod/          # COD state machine, status history, remittance
│   │   │       ├── settings/     # store settings, currencies, feature flags
│   │   │       └── health/
│   │   ├── prisma/               # (only if not using packages/database)
│   │   ├── test/                 # e2e / integration harness
│   │   ├── nest-cli.json
│   │   └── package.json
│   ├── storefront/               # Next.js App Router, customer-facing
│   │   └── src/
│   │       ├── app/[locale]/...  # routes (keep countryCode/[locale] pattern)
│   │       ├── modules/          # feature UI (products, cart-cod, layout, home)
│   │       ├── lib/              # api client, utils (phone, wilaya, money, i18n)
│   │       └── middleware.ts
│   └── admin/                    # Next.js App Router, internal ops UI
│       └── src/app/(dashboard)/{orders,products,inventory,settings,cod}
│
├── packages/
│   ├── contracts/                # Zod schemas + inferred TS types (single source of truth)
│   │   ├── src/cod/{statuses,dtos}.ts
│   │   ├── src/catalog/, orders/, shipping/, settings/, money.ts
│   │   └── package.json
│   ├── database/                 # Prisma schema, generated client export, migrations, seed
│   │   ├── prisma/schema.prisma
│   │   ├── prisma/migrations/
│   │   ├── src/client.ts
│   │   └── package.json
│   ├── config/                   # shared tsconfig / eslint / prettier presets
│   └── ui/                       # (optional) shared React primitives across storefront+admin
│
├── infra/
│   ├── docker-compose.yml        # local Postgres (+ optional Redis)
│   ├── Dockerfile.api
│   ├── Dockerfile.storefront
│   └── env/                      # *.env.example per client (never real secrets)
│
├── docs/                         # this documentation set
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── .env.example
```

Notes:

- `apps/admin` may be merged into `apps/storefront` initially to reduce build
  cost; keep it a separate app if the ops team needs independent deploys. This is
  an open question (Part F).
- `packages/ui` is created only if storefront and admin genuinely share
  components; otherwise defer (YAGNI).
- `packages/database` owns the Prisma schema and the client so both `api` and
  any scripts import one generated client.

### B.3 Layering inside the API

Each module follows the same shape:

```
<module>/
├── <module>.controller.ts     # HTTP only: validate (contracts), call service
├── <module>.service.ts        # domain logic, transactions, invariants
├── <module>.repository.ts     # Prisma access only
├── dto/                       # request/response shapes (from contracts)
├── entities/ or mappers/      # domain <-> persistence mapping
└── <module>.module.ts         # wiring; exports service only
```

Rules:

- Controllers never touch Prisma. Repositories never contain business rules.
- Cross-module reads go through the other module's **service** interface, never
  its repository or tables.
- All multi-step writes run in a single `prisma.$transaction`.
- Domain errors are typed (`InvalidTransitionError`, `InsufficientStockError`)
  and mapped centrally to HTTP status codes.

### B.4 Database design

Full first-pass schema: [`docs/database-design.md`](./database-design.md).
Summary of entities:

- **Store**: `StoreSetting`, `Currency`, `User`, `Role`/`UserRole`.
- **Catalog**: `Product`, `ProductImage`, `ProductOption`,
  `ProductOptionValue`, `ProductVariant`, `VariantOptionValue`, `Category`,
  `Collection`.
- **Inventory**: `StockLocation`, `InventoryItem`, `InventoryLevel`,
  `InventoryReservation`.
- **Pricing**: `PriceList` (optional), `VariantPrice` (per currency).
- **Customers**: `Customer`, `Address`.
- **Shipping**: `Wilaya`, `ShippingZone`, `ShippingRate` (home / stop-desk),
  `DeliveryCompany`.
- **Orders**: `Order`, `OrderItem`, `OrderAddress`, `OrderStatusHistory`,
  `IdempotencyKey`.
- **COD**: `CodOrder`, `CodStatusHistory`, `CodRemittance` (optional, later).

---

## Part C — Cross-cutting concerns

### C.1 Authentication and authorization

- **Admin/staff auth**: email + password hashed with **Argon2id**, issuing a
  short-lived JWT access token and a rotating refresh token. Store refresh
  token hash server-side. Access token sent as `Authorization: Bearer` (admin
  SPA) or httpOnly, `SameSite=Lax`, `Secure` cookie (server-rendered admin).
- **Customer auth**: optional for Phase 1. COD checkout must work as **guest**
  (name + phone). If accounts are added later, use phone OTP or email/password;
  do not block guest COD.
- **Storefront API auth**: a **publishable key** (per deployment) scopes public
  store endpoints, mirroring the useful part of Medusa's publishable keys.
- **Authorization**: role-based access control. Roles: `OWNER`, `MANAGER`,
  `OPERATOR`, `VIEWER`. Every mutating COD transition carries the actor
  (`user_id` + display name) into `CodStatusHistory` (already modelled in the
  source). Guards enforce roles per route; services enforce ownership/scoping.
- **Hardening**: rate-limit auth and public order creation; lockout on repeated
  failures; never log secrets or tokens.

### C.2 Money handling

- Store monetary amounts as **integer minor units** (`BIGINT` / Prisma `BigInt`)
  plus an ISO-4217 `currency_code` column. No floats, ever. DZD is modelled as
  2 minor digits for forward compatibility; display rules are per-currency.
- A shared `Money` value object in `packages/contracts` handles parse/format/
  add/compare. Formatting for UI stays in the storefront; arithmetic stays in
  the API.
- Rounding policy defined once (half-up at the line/total boundary); taxes and
  shipping are computed from integer math.
- Never trust client-supplied totals: the storefront's displayed quote is
  advisory; the API recomputes the authoritative total at order creation from
  variant prices + shipping rate + any adjustments.

### C.3 Order state transitions

Two related machines, both server-enforced and append-only audited:

**Fulfillment/order lifecycle** (`Order.status`):
`pending → confirmed → preparing → with_delivery_company → delivered`
with `returned` and `cancelled` reachable from the states allowed below.

**COD machine** (port of `src/modules/cod/types.ts`):

| From | Allowed to |
| --- | --- |
| `new` | `no_answer`, `confirmed`, `cancelled` |
| `no_answer` | `no_answer`, `confirmed`, `cancelled` |
| `confirmed` | `preparing`, `cancelled` |
| `preparing` | `with_delivery_company`, `cancelled` |
| `with_delivery_company` | `delivered`, `returned` |
| `delivered` | — (terminal) |
| `returned` | — (terminal) |
| `cancelled` | — (terminal) |

Rules:
- Transitions are validated against the table; illegal transition → **409**.
- Every transition writes a `CodStatusHistory` row (from, to, actor, note,
  timestamp) in the same transaction as the status update.
- Terminal statuses are immutable.
- The state table is defined in `packages/contracts` and imported by API, admin,
  and tests — one definition, no drift.

### C.4 Inventory reservation

- Availability = `stocked_quantity − reserved_quantity` (reservations tracked in
  `InventoryReservation`, or as an `InventoryLevel.reserved_quantity` counter).
- **On order placement**: create a reservation in the same transaction as the
  order, using an atomic conditional update / row lock to prevent overselling:
  the update only succeeds if available ≥ requested quantity. Failure →
  `InsufficientStockError` → **409**, order rejected.
- **Reservation TTL** for unconfirmed COD orders (e.g. 24–48h); a scheduled job
  expires and releases stale reservations. COD confirm/deny drives whether the
  reservation converts to a sale or is released.
- **On cancel/return**: release the reservation / restock per policy, recorded in
  status history.
- Backorder policy: **disabled** initially (mirrors source `allow_backorder:
  false`).

### C.5 Idempotency

- **Order creation** accepts an `Idempotency-Key` header (or a client-generated
  checkout token). A unique `IdempotencyKey` row (scope + key + stored response)
  guarantees a retried submit returns the original order instead of duplicating.
- **Unique constraints as backstops**: one `CodOrder` per `Order` (`order_id`
  unique, already in the source model); one order per idempotency key.
- **Webhooks/events** (delivery company callbacks, future payments) are
  idempotent by external event id.
- The storefront's COD form already guards double-submit client-side
  (`submittingRef`); the server must not rely on that.

### C.6 Client isolation

Primary strategy: **one deployment per client**.

- Separate git project (or long-lived branch), separate PostgreSQL database,
  separate credentials/secrets, separate hosting and object storage.
- No cross-client shared runtime, shared database, or shared admin user pool.
- Configuration (store name, currency, wilayas, shipping rates, publishable
  key) lives in `StoreSetting` + environment, never in code.

Defense in depth (optional, low cost): carry a `store_id` on tenant-owned tables
and scope every query by it. This does not turn the product into multi-tenant;
it protects against accidental cross-environment data import and makes a future
consolidation cheaper. Decision recorded as ADR-0010.

> Reminder from the constraints: copying a repository does **not** synchronise
> future updates. Each client deployment is a fork with its own upgrade path; a
> documented "propagate core changes" process is required (see backlog).

---

## Part D — Testing requirements

| Level | Tooling | Scope | Gate |
| --- | --- | --- | --- |
| Unit | Jest (API), Vitest (storefront/admin) | Pure domain logic: COD transition table, money math, phone/wilaya validation, payload normalisation, pricing | Required on every PR; fast, no DB |
| Integration | Jest + **Testcontainers Postgres** + Prisma | Repository/service behavior against a real Postgres: transactions, constraints, reservation races, idempotency uniqueness | Required on every PR |
| Contract | Zod schema tests in `packages/contracts` | Schema validity + inferred types compile; consumer/provider agreement | Required |
| E2E | Playwright | Storefront COD purchase against a running API+DB (guest, home + stop-desk, invalid phone/email, out-of-stock, double-submit) | Required before release |
| API e2e | Supertest against Nest app | Admin COD transitions incl. 409 on illegal transition, RBAC 401/403 | Required |
| Load (later) | k6/Artillery | Concurrent COD submits vs inventory (no oversell) | Before scale milestone |

Concrete must-have test cases (seeded by the existing suites):

- `new → delivered` illegal hop is rejected (`409`).
- Concurrent orders for the last unit: exactly one succeeds.
- Duplicate `Idempotency-Key` returns the same order id.
- Every transition appends exactly one history row with the correct actor.
- Money totals recomputed server-side; client tampering ignored.
- Cross-role: `VIEWER` cannot transition; `OPERATOR` can confirm but not delete.

Conventions: integration tests require a reachable Postgres (Testcontainers
preferred over a shared local DB); no destructive commands against shared data;
test data is namespaced and cleaned up.

---

## Part E — Incremental migration plan

Principle: **additive and reversible**. The existing repository is neither
modified nor deleted during this phase. The new project is built alongside it.

**Phase 0 — Audit and foundation (this document).**
Deliverables in `docs/`. Gate: approval before any architectural change.

**Phase 1 — Scaffold the monorepo (no domain code).**
- Initialize pnpm workspace, turbo, `packages/config`, `apps/api` (NestJS "hello
  + health"), `apps/storefront` (Next.js), `packages/contracts`,
  `packages/database`.
- Add `infra/docker-compose.yml` for local Postgres, `.env.example`, CI that runs
  lint/typecheck/test.
- Gate: `pnpm build`, `pnpm lint`, `pnpm test` green; API health endpoint.

**Phase 2 — Data layer and shared contracts.**
- Author `packages/database/prisma/schema.prisma` (Part B.4) + initial migration.
- Implement `packages/contracts` (COD statuses/transitions, DTOs, Money).
- Port the existing **unit tests** for the COD transition table and validation so
  the contract is locked before UI work.
- Gate: schema applies cleanly; contract tests green.

**Phase 3 — Core API modules.**
- Implement `catalog`, `inventory`, `pricing`, `shipping`, `settings` read +
  write endpoints (internal/admin).
- Implement `orders` + `cod`: order creation with idempotency, reservation,
  state machine, history.
- Integration tests (reservation race, idempotency, transitions, RBAC).
- Gate: API e2e suites green.

**Phase 4 — Admin UI.**
- Build `apps/admin` screens: product create (port `bita-create` UX + per-variant
  price/stock), orders list with COD status columns, order detail with COD
  transition widget and history (port `order-list-cod-status`,
  `cod-order-widget`, `cod/page.tsx` intent).
- Gate: operator can process a COD order end-to-end.

**Phase 5 — Storefront.**
- Port the product landing + COD form flow (`product-landing/*`,
  `lib/data/cod.ts`) onto the new API client, preserving UX: dedicated cart,
  live quote, delivery-type verification, in-place success, wilaya/phone
  validation, i18n.
- Gate: Playwright E2E COD purchase green.

**Phase 6 — Data migration and cutover.**
- Export catalog/customers/orders from the Medusa database; transform into the
  new schema; load via a one-off migration script with reconciliation counts.
- Run new system in parallel; verify order parity; then switch DNS/storefront.
- Retire the Medusa deployment after a stability window.

**Phase 7 — Per-client provisioning.**
- Codify "new client" steps: fork repo, provision Postgres, generate secrets,
  seed store settings/wilayas/rates, deploy, verify. Document the core-upgrade
  propagation process.

Every phase: additive, feature-flagged, and revertible. No phase deletes source
repository code until Phase 6's approval gate.

---

## Part F — Open questions (tracked, not yet decided)

1. **Admin app**: separate `apps/admin` or fold into `apps/storefront`?
2. **NestJS 11 vs 12** for the initial build (see updated ADR-0011).
3. **Prisma 7 now vs wait for Prisma 8 GA** — RC risk tolerance.
4. **Storefront hosting/runtime**: standard Node vs Edge — affects middleware and
   data-fetch strategy.
5. **Guest-only vs customer accounts** for Phase 1.
6. **Search**: keep server-side SQL search initially, or adopt Meilisearch/
   Algolia for the storefront listing/instant-search feature we are dropping.
7. **Delivery-company integration**: which couriers, and do we ingest their
   status webhooks (needs idempotent callback design)?
8. **Multi-currency**: DZD-only or future currencies/prices per region.
9. **Reservation TTL length** and the expiry job's schedule.
10. **Object storage** for product media (local volume vs S3-compatible).
11. **Locale strategy**: keep `[countryCode]` route prefix, `[locale]`, or both.
12. **Core-change propagation**: branch/merge vs shared `packages/*` published to
    each client.

---

## Part G — Architectural decisions

Recorded as ADRs in [`docs/decisions/`](./decisions/):

- [ADR-0001 — Do not use Medusa (or any ecommerce engine)](./decisions/0001-no-ecommerce-engine.md)
- [ADR-0002 — Modular monolith](./decisions/0002-modular-monolith.md)
- [ADR-0003 — pnpm workspace + Turborepo monorepo](./decisions/0003-monorepo-tooling.md)
- [ADR-0004 — PostgreSQL + Prisma](./decisions/0004-postgres-prisma.md)
- [ADR-0005 — Money as integer minor units](./decisions/0005-money-minor-units.md)
- [ADR-0006 — COD order state machine](./decisions/0006-cod-state-machine.md)
- [ADR-0007 — Authentication and RBAC](./decisions/0007-auth-rbac.md)
- [ADR-0008 — Inventory reservation model](./decisions/0008-inventory-reservation.md)
- [ADR-0009 — Idempotency strategy](./decisions/0009-idempotency.md)
- [ADR-0010 — Client isolation](./decisions/0010-client-isolation.md)

See also:

- [Database design](./database-design.md)
- [Risk register](./risk-register.md)
- [Implementation backlog](./implementation-backlog.md)
