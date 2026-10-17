# Phase 7.2 — Store-Owner Admin: Full CRUD Completion

Delivered on top of Phase 7.1 (admin shell, login, dashboard). This phase wires
every admin form and button to an authorized (server-action → NestJS) mutation,
with the shared interaction requirements from the Phase 7 brief, and locks
deletion integrity for products/variants that appear in order history.

## 1. What shipped

- **Authorized server actions** (`apps/storefront/src/app/admin/actions.ts`),
  rewritten to the `useActionState` contract:
  - `createProductAction`, `updateProductAction`, `addVariantAction`,
    `updateVariantAction` → on success `redirect()`, on
    failure return `{ ok:false, message, errors, values }` (translated via
    `getLocale()`). Product create/update additionally upload operator-selected
    image files and sync the thumbnail (see §7).
  - `saveDeliveryRatesAction` (batch, transactional) and
    `importDeliveryRatesAction` (CSV, validated client-side and again
    server-side).
  - Redirect-based deletes keep the query contract (`?error=history` etc.).
  - `orderAction` revalidates `/admin/orders`, `/admin/orders/[id]`,
    `/admin/customers` and `/admin` after a transition.
- **Shared interaction primitives**
  (`apps/storefront/src/lib/admin/` + `components/admin/`):
  - `submit-button.tsx` — pending-aware submit (`useFormStatus`), takes
    `name`/`value` so multi-action forms can fan out.
  - `confirm-submit.tsx` — destructive-action confirm, now pending-aware.
  - `action-state.ts` — `ActionState`, `FieldErrors`, form-value collection.
  - `delivery-rates.ts` (+ tests) — batch-draft parsing, CSV parsing, editor
    initial values.
  - CSS `.field-error` / `.field-error-text` added to `globals.css`.
- **Backend deletion guard**
  (`apps/api/src/catalog/catalog.service.ts`): `ensureNoOrderHistory` throws
  `HistoryExistsError` (`409 HISTORY_EXISTS`) when a product / variant is
  referenced by any order item. Rationale: the product→variant→inventory→
  movements cascade would otherwise destroy ledger history. UI suggests
  archiving instead.
- **i18n**: new `admin.products.*`, `admin.delivery.*` keys added in `ar` and
  `fr` (parity enforced by the unit suite).

## 2. Per-section CRUD matrix

| Section | Read | Create | Update | Delete | Notes |
|---|---|---|---|---|---|
| Overview `/admin` | Dashboard stats/charts, recent orders, quick links | — | — | — | Phase 7.1 |
| Products `/admin/products` | List (published + deleted flag), pagination/search | — | — | Row `deleteListedProductAction` → `HISTORY_EXISTS` guard (409 → `?error=history`); returns to the same filtered page | Create/update live on the create/detail pages; confirm dialogs on every delete |
| Product create `/admin/products/new` | — | `createProductAction` → `POST /catalog/products` then image upload + thumbnail | — | — | Inline field errors; values preserved on failure |
| Product detail `/admin/products/[id]` | Full product + variants, images, SKU, stock | Variant (`addVariantAction`), images via `ProductImageManager` (deferred on save) | Edit product (`updateProductAction`) incl. add/remove images + primary thumbnail, variant (`updateVariantAction`) | Product/variant deletes → `HISTORY_EXISTS` guard (409 → `?error=history`); archive via status | Confirm dialogs on every delete |
| Orders `/admin/orders` | Search/filter/status, print, CSV export | — | — | — | No unrestricted order deletion (see ADR / order-operations) |
| Order detail `/admin/orders/[id]` | Timeline, items, delivery/shipment/collection status, totals | — | Status transitions via `orderAction` (`confirm`→`deliver`, `delivery-failed`, `return`, `cancel`) | — | Non-cancel actions = `SubmitButton`, cancel = `ConfirmSubmit`; revalidation after action |
| Customers `/admin/customers` | Derived from orders (normalized phone), search/paginate, export | — | — | — | Never deleted via order deletion |
| Delivery `/admin/settings/delivery` | All 69 wilayas × home/stop-desk grid, search filter, export | `saveDeliveryRatesAction` batch (create/update), `importDeliveryRatesAction` CSV | Same batch upsert | Enable/disable is explicit toggling, never silent deletion; batch upsert is transactional | Fee errors highlight the exact row; edits preserved after a rejected submission |
| Login `/admin/login` | — | Session cookie via key verification | — | Logout | Phase 6/7.1 |

## 3. Shared interaction requirements — mapping

| Requirement | Where |
|---|---|
| Pending / disabled submit | `SubmitButton` + `ConfirmSubmit` (`useFormStatus`) animate/disable during action; `aria-busy` |
| Duplicate-submission prevention | Pending state disables submit; checkout still guarded by idempotency key (ADR-0009) |
| Validation error display | `.field-error` border + `.field-error-text` inline under the offending input (products, variants, images, delivery fee rows) |
| Form-data preservation after recoverable failure | `useActionState` failure returns `values`; inputs restore via `defaultValue` / `defaultChecked` |
| Confirmation dialogs | `ConfirmSubmit` on product delete, variant delete, order cancel (not on forward transitions) |

## 4. Decisions

- **Collection/remittance stays out of scope (R-18).** Shipment transitions are
  recorded; `delivered` ≠ `collected` and nothing moves `collection_status` past
  `cod_pending`. Documented in `docs/api/order-operations.md`; no endpoints or UI
  were invented for it.
- Order history is the hard delete wall for catalog records: users are told to
  archive, not destroy, records with ledger history.
- `useActionState` + `useFormStatus` (React 19.3) chosen over redirect-based
  server-action validation so partial failures keep operator input intact.

## 5. Tests & results

| Suite | Result |
|---|---|
| API unit (`pnpm --filter api test`) | 10 suites / 81 tests passed |
| API e2e (`pnpm --filter api test:e2e`) | 7 suites / 88 tests passed, including new "order-history guard" (products/variants delete → 409 `HISTORY_EXISTS` after a checkout) |
| Storefront unit (vitest) | 12 files / 85 tests passed (i18n parity, money, api client, delivery-rate drafts/CSV) |
| Typecheck | `tsc --noEmit` clean (api + storefront) |
| Build | `next build` clean |
| Smoke | All admin routes 200 behind the admin session cookie; product/new & detail forms render; `?error=history|delete|other` map to the right alerts; delivery grid renders 69 wilayas with save/import actions; order detail renders pending-aware transition buttons |

The order-history guard e2e is isolated to wilaya 31 (Oran) so it never
mutates the shared wilaya-16 store rate that the orders / admin-dashboard suites
rely on; its cleanup removes only its own order and rate.

## 6. Out of scope / future work

- Courier / collection remittance reconciliation (R-18), real operator accounts
  with per-role permissions (ADR-0007 stop-gap), order deletion and edit flows.

## 7. Follow-up — product images & list deletion

- **Shared upload UI** `components/admin/product-image-manager.tsx`, embedded
  inside both product forms (never nested): clickable dropzone over a real
  `<input type="file" multiple>`, instant previews for persisted and pending
  images, remove-before-save, and a "primary" (thumbnail) selector. It emits
  `files`, `remove_image_ids`, `primary_file_index` and a resolved `thumbnail`
  hidden value.
- **Server actions** upload via `POST /catalog/products/:id/images/upload` and
  delete via `DELETE /catalog/images/:id`; an existing-image removal is applied
  on save. Create is two-phase (create product → upload → set thumbnail) and, on
  upload failure, redirects to the new product's edit page (`?error=image`)
  rather than discarding the record.
- **Formats**: JPEG / PNG / WebP / **AVIF**, validated by magic bytes on both the
  client (`lib/admin/image-files.ts`, `lib/admin/image-sniff.ts`) and server
  (`MediaService`). AVIF is an ISO-BMFF/HEIF container, so it is detected via the
  `ftyp` box with an `avif`/`avis` brand.
- **Body size**: Next.js server-action default is 1 MB, below the 5 MB per-image
  ceiling, so `next.config.ts` sets `experimental.serverActions.bodySizeLimit`
  to `50mb`.
