# BITA COD Starter — Phased implementation backlog

Scope for Phase 0 is **documentation only**. Implementation begins after
approval. Items are grouped by migration phase (see `architecture.md` Part E).
Estimates are relative (S/M/L), not calendar commitments.

Legend: `[ ]` todo, `[~]` in progress, `[x]` done, `[!]` blocked.

## Phase 1 — Monorepo scaffold

- [ ] Init `pnpm-workspace.yaml`, root `package.json` (pin pnpm 10.x), `turbo.json`, `.npmrc`
- [ ] `packages/config`: shared tsconfig, eslint, prettier presets
- [ ] `apps/api`: NestJS skeleton + `/health`; choose Nest 11 vs 12 (ADR-0011/open Q2)
- [ ] `apps/storefront`: Next.js 15.5.27 App Router skeleton
- [ ] `apps/admin`: Next.js skeleton (or fold into storefront — open Q1)
- [ ] `packages/contracts`, `packages/database` package shells
- [ ] `infra/docker-compose.yml` (Postgres 16), `.env.example`, Dockerfiles
- [ ] CI: install, lint, typecheck, test, build
- [ ] Definition of done: `pnpm build && pnpm lint && pnpm test` green; health endpoint responds

## Phase 2 — Data layer + contracts

- [x] `packages/database/prisma/schema.prisma` (per `database-design.md`)
      — Phase 2 slice implemented in `apps/api/prisma/schema.prisma` (catalog +
      inventory); `packages/database` still deferred (single DB owner)
- [x] Initial Prisma migration; seed script (store settings, currencies, wilayas)
      — migration `add_catalog_and_inventory`, `apps/api/prisma/seed.ts`
      (currencies + store setting; wilayas later with shipping)
- [x] `packages/contracts`: `Money`, COD statuses + transition table, DTOs (Zod)
      — money util + Zod DTOs live in `apps/api/src/common/money` and module
      `dto/`; shared `packages/contracts` deferred until a second consumer
- [~] Port unit tests: COD transition table, phone/wilaya validation, product payload normalisation
  — product payload normalisation covered (`catalog.schemas.spec.ts`); wilaya +
  commune dataset validation covered (`common/dz/locations.spec.ts`); COD
  transition tests belong to the COD phase
- [ ] Definition of done: schema applies cleanly; contract tests green
- [x] Catalog + inventory APIs, transactional reservation, concurrency tests
      (delivered ahead of the backlog list above; see
      `docs/api/catalog-and-inventory.md`)

## Phase 3 — Core API modules

- [ ] `settings` module (store settings, currencies)
- [ ] `auth` + `users` modules: Argon2id, JWT + refresh rotation, RBAC guards (ADR-0007)
- [ ] `catalog`: products, variants, options, images (admin CRUD; storefront read)
- [ ] `pricing`: variant prices per currency
- [ ] `inventory`: stock locations, levels, reservations, atomic reservation (ADR-0008)
- [x] `shipping`: wilayas, communes, delivery rates (home/stop-desk), provider abstraction
      — Phase 4 slice; see `docs/api/shipping-and-locations.md` and
      `docs/shipping-location-data.md`. Zones and live carrier integrations deferred.
- [ ] `customers`: guest + optional account, addresses
- [ ] `orders`: create (idempotent), snapshot items/address, status history
- [ ] `cod`: CodOrder + state machine + history + transition endpoint
- [ ] Idempotency key storage + middleware (ADR-0009)
- [ ] Integration tests: reservation race, idempotency, transitions (409), RBAC, money recompute
- [ ] Definition of done: API e2e suites green

## Phase 4 — Admin UI

> Delivered incrementally. The **order operations** slice shipped in the task's
> "Phase 6" (see `docs/api/order-operations.md`): order list, detail, guarded
> transitions, history, reservations, print, CSV export, ar/fr UI, folded into the
> storefront as `/admin`. Remaining admin screens below are still todo.

- [ ] Product create (port `bita-create`: simple + variants, per-variant price/stock)
- [x] Orders list with COD status columns (port `order-list-cod-status` intent)
      — Phase 6: admin list at `/admin/orders` with filters/sort/pagination
- [x] Order detail + COD transition control + history (port `cod-order-widget`, `cod/page.tsx`)
      — Phase 6: guarded actions, immutable timeline, reservation visibility
- [ ] Inventory view/edit
- [ ] Store settings (shipping rates, wilayas, delivery companies)
- [x] Definition of done: operator processes a COD order end-to-end
      — orders list → detail → guarded transition → history/export verified

## Phase 5 — Storefront

- [ ] API client + publishable key wiring; locale/region routing (keep `[countryCode]`/`[locale]`)
- [ ] Product listing + product landing (port layout/catalog UI, strip `HttpTypes`)
- [ ] COD order flow: dedicated cart, live quote, delivery method, wilaya select, address, validation, in-place success (port `product-landing/*`, `lib/data/cod.ts`)
- [ ] Port domain utils: phone, algeria-wilayas, cod-i18n, money, email
- [ ] Port storefront tests (`cod.test.ts`, `cod-order-form.test.tsx`, language-select)
- [ ] Playwright E2E: guest COD (home + stop-desk), invalid inputs, out-of-stock, double-submit
- [ ] Definition of done: E2E COD purchase green

## Phase 6 — Migration + cutover

- [ ] Export catalog/customers/orders from Medusa DB
- [ ] Transform + load into new schema; reconciliation counts
- [ ] Parallel run; order parity checks
- [ ] DNS/storefront switch; monitoring
- [ ] Retire Medusa deployment after stability window
- [ ] Definition of done: production on new stack; source decommissioned

## Phase 7 — Per-client provisioning

- [ ] Document "new client" runbook: fork, provision Postgres, generate secrets, seed, deploy, verify
- [ ] Core-change propagation process (fork/merge vs published packages) (ADR-0010)
- [ ] Upgrade checklist per client

## Cross-cutting / ongoing

- [ ] Define rounding policy + tests (ADR-0005)
- [ ] Rate limiting (auth + public order creation)
- [ ] Structured logging + health/metrics
- [ ] Backup/restore runbook per client
- [ ] Resolve open questions in `architecture.md` Part F (Admin split, Nest 11/12, Prisma 7/8, search, reservation TTL, object storage, locale strategy, couriers)

## Blocked / needs input

- [!] NestJS 11 vs 12 — decision pending (ADR-0011 to be written)
- [!] Courier integration details (R-10)
- [!] Search approach (SQL vs Meilisearch/Algolia) (R-15)
