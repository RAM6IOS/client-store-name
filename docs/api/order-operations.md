# Order Operations API + Admin (Phase 6)

Phase 6 makes the COD order lifecycle **operable**: an order dashboard, an order
detail with guarded status actions, an immutable status timeline, printer-friendly
slips, and a filter-aware CSV export — plus the backend capabilities they need.
It builds on the Phase 3 state machine
([ADR-0006](../decisions/0006-cod-state-machine.md)) and the Phase 5 storefront
([ADR-0013](../decisions/0013-storefront-i18n.md)); it does **not** add a second
admin app. The operations UI lives inside the storefront as a route group (open
question Q1 in `architecture.md` resolved to "fold into storefront" for now).

Base URL: `http://localhost:3001/api`

## Scope

- **In:** admin order listing (filter/sort/paginate), admin order detail,
  guarded status actions, status history, reservation visibility, CSV export,
  printer slip, Arabic/French operations UI, single-store installation.
- **Out:** multi-tenancy, payments/collection reconciliation, CRM, carrier
  settlement, product/inventory CRUD screens, per-operator accounts (RBAC).

## Authorization

Every order endpoint except `POST /checkout` and `GET /orders/track/:token`
requires the existing admin key via the `x-admin-api-key` header
(`AdminApiKeyGuard`, constant-time compare, fails closed).

The admin UI never ships the key to the browser:

- The operator pastes the key once on `/admin/login`; it is verified against the
  API, then stored in an **httpOnly, SameSite=Lax** cookie (`bita_admin_key`,
  path `/admin`, `Secure` in production).
- All admin reads/writes happen in **server components, server actions, and one
  route handler**; the key is attached server-side as `x-admin-api-key`.
- The edge middleware only redirects browsers without the cookie; the API guard
  remains the actual security boundary.

> **Gap (tracked):** this is a single shared secret, not per-operator identity,
> and it is not `JWT + RBAC`. There is no operator login, no role scoping, and no
> revocation beyond rotating `ADMIN_API_KEY`. See
> [ADR-0007](../decisions/0007-auth-rbac.md) and R-17 in the risk register.

## Admin endpoints

| Method  | Path                          | Description                                                  |
| ------- | ----------------------------- | ------------------------------------------------------------ |
| `GET`   | `/orders`                     | List orders (filters, sort, pagination)                      |
| `GET`   | `/orders/export`              | CSV of the **current filter set** (max `ORDER_EXPORT_LIMIT`) |
| `GET`   | `/orders/:id`                 | Admin detail: snapshots + `status_history` + `reservations`  |
| `POST`  | `/orders/:id/confirm`         | `pending_confirmation → confirmed`                           |
| `POST`  | `/orders/:id/cancel`          | `→ cancelled` (requires `reason`)                            |
| `POST`  | `/orders/:id/prepare`         | `confirmed → preparing`                                      |
| `POST`  | `/orders/:id/dispatch`        | `preparing → dispatched` (manual hand-off; no carrier call)  |
| `POST`  | `/orders/:id/transit`         | `dispatched → shipped` (parcel is en route)                  |
| `POST`  | `/orders/:id/deliver`         | `shipped → delivered` (delivery ≠ collection)                |
| `POST`  | `/orders/:id/delivery-failed` | `shipped → delivery_failed` (stock retained for retry)       |
| `POST`  | `/orders/:id/return`          | `shipped → returned` (releases outstanding stock)            |
| `POST`  | `/orders/:id/no-answer`       | `pending_confirmation`/`confirmed → no_answer` (retryable)   |
| `POST`  | `/orders/:id/wrong-number`    | `pending_confirmation`/`confirmed → wrong_number` (retryable)|
| `PATCH` | `/orders/:id/status`          | Generic transition to an allowed `to_status`                 |

`no_answer` and `wrong_number` are recoverable: the order can go back to
`pending_confirmation`/`confirmed` (or `no_answer ⇄ wrong_number`) for another
attempt. The shipped leg is split so the operator can distinguish "handed to the
carrier" (`dispatched`) from "in transit" (`shipped`); both mirror the shipment
to `shipped`.

All action bodies require `actor` (recorded in history) and accept an optional
`note`; `cancel` also requires `reason`.

### List & export filters

Shared `orderFiltersShape` (see `orders/dto/orders.schemas.ts`):

- `search?` — customer-name substring, wilaya-name substring, order reference
  (`123` or `#123`), or phone (stored E.164 `+213…` **or** a raw local number).
- `status?`, `shipment_status?`, `collection_status?`, `wilaya_code?`.
- `from?` / `to?` — inclusive `created_at` range.
- `sort` (`created_at`|`updated_at`|`total_amount`|`display_id`) + `order`
  (`asc`|`desc`); list adds `page` (default 1) and `pageSize` (default 20, max 100).

The list and the export call the same `buildOrderWhere` / `buildOrderOrderBy`, so
the file always matches what the operator sees (without pagination).

### CSV export

- `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment`.
- Prefixed with a UTF-8 BOM (the Next route handler adds it) so Excel renders
  Arabic correctly.
- Columns are **allow-listed** in `orders/csv.ts` (`ORDER_EXPORT_COLUMNS`).
  `tracking_token` and the `delivery_quote_snapshot` are **never** exported.

## Concurrency & invariants

`applyStatusTransition` is the single guarded mutation path:

- Re-validates with `canTransition` against the state machine.
- Applies a **conditional** update (`WHERE id = ? AND status = <observed>`); two
  concurrent transitions race and exactly one wins, the loser gets `409`
  `INVALID_TRANSITION`.
- Appends exactly one immutable `OrderStatusHistory` row and mirrors
  `shipment_status`.
- On `confirmed`, held reservations become `committed`; on `cancelled`/`returned`,
  outstanding reservations are released **once** (idempotent under retries) and
  only for variants that `manage_inventory`.
- `collection_status` is **not** derived from `delivered` — a delivered order is
  not a collected one. There is no collection/remittance workflow yet (R-18).

## Admin UI routes (storefront)

| Route                     | Purpose                                                                    |
| ------------------------- | -------------------------------------------------------------------------- |
| `/admin/login`            | Paste the admin key; verified then stored in the session cookie            |
| `/admin/orders`           | Filter/sort/paginate list, inline status change, export link                |
| `/admin/orders/:id`       | Detail: snapshots, statuses, items, totals, actions, history, reservations |
| `/admin/orders/:id/print` | Printer-friendly delivery slip (no chrome)                                 |
| `/admin/orders/export`    | Route handler that streams the CSV (key attached server-side)              |

Chrome (`AdminShell`) hides the nav/logout on `/admin/login` and the print view.
The customer storefront lives under the `(store)` route group; the admin under
`admin/`. The root layout owns only `<html>`/`<body>` + locale direction, so
neither chrome leaks into the other.

## Verification

```
pnpm --filter @bita/api typecheck && pnpm --filter @bita/api test && pnpm test:e2e
pnpm --filter @bita/storefront typecheck && pnpm --filter @bita/storefront test
pnpm --filter @bita/storefront build
```

Results for this phase:

- API: **typecheck clean**; unit **81 passed**; e2e **77 passed** (6 suites).
- Storefront: **typecheck clean**; unit **69 passed** (10 files); production
  **build** emits all 12 routes + middleware.
- Runtime smoke (API + `next start`): `/admin/orders` → `307 /admin/login` without
  a cookie and `200` with one; `/admin/login` → `200`; detail + print → `200`;
  `/admin/orders/export` → `200 text/csv` with the allow-listed header; a real
  order rendered its customer, items, timeline, and reservations; the action set
  matched the state machine at `pending_confirmation`, `confirmed`, and `shipped`.

## Unresolved risks / gaps

- **R-17 — Admin auth is a shared key, not per-operator.** No audit of _which_
  human acted beyond a free-text `actor` field; no RBAC; no revocation short of
  rotating the secret. (ADR-0007)
- **R-18 — No collection/remittance tracking.** `collection_status` exists and is
  shown, but nothing moves it past `cod_pending`; courier remittance is future work
  (R-10).
- **R-19 — Public inventory read.** `GET /inventory/...` read endpoints are not
  admin-guarded (pre-existing); they expose stock levels already surfaced via the
  public catalog. Revisit if inventory detail becomes sensitive.
- The admin page-level redirect for a _forged/expired_ cookie is delivered as an
  RSC soft redirect (HTTP 200 at the shell) because the layout streams; the
  browser still navigates to `/admin/login`. The no-cookie case is a hard `307`
  from middleware.
