# BITA COD Starter — Risk register

Scale: Likelihood and Impact are Low / Medium / High. Score is a coarse
priority (H/H highest). Owner is the accountable role.

| ID | Risk | Likelihood | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | Re-implementing commerce primitives (catalog, inventory, pricing) introduces bugs Medusa handled | High | High | H/H | Port existing COD/domain tests first; integration tests against real Postgres; phased build with gates | Eng lead |
| R-02 | Migration of existing Medusa data loses or corrupts orders/customers | Medium | High | M/H | Export/transform/reconcile script in Phase 6; run in parallel before cutover; keep source DB intact | Eng lead |
| R-03 | Overselling under concurrent COD orders | Medium | High | M/H | Atomic reservation transaction + row locks; concurrency integration test (ADR-0008) | Backend |
| R-04 | Duplicate orders from retries/double-submit | High | Medium | H/M | Idempotency keys + unique constraints; e2e test (ADR-0009) | Backend |
| R-05 | Version drift / blind upgrades (Nest 12, Prisma 8 RC, Next major) | Medium | Medium | M/M | Pin versions; upgrade deliberately with tests; avoid RC in prod (ADR-0004, version report) | Eng lead |
| R-06 | Client-fork drift: fixes not propagated to other clients | High | Medium | H/M | Documented core-propagation process; shared `packages/*`; per-client upgrade checklist (ADR-0010) | Eng lead |
| R-07 | Auth/session vulnerabilities (token theft, weak reset) | Low | High | L/H | Argon2id, short-lived tokens, rotation/revocation, rate limiting, security tests (ADR-0007) | Backend |
| R-08 | Money rounding/precision errors | Medium | High | M/H | Integer minor units + shared Money object + server-side recompute + tests (ADR-0005) | Backend |
| R-09 | Admin UI scope creep (rebuild whole dashboard) | High | Medium | H/M | Port only needed screens (COD, product create, orders); no Medusa parity chase | Product |
| R-10 | Delivery-company integration ambiguity (couriers, webhooks, reconciliation) | Medium | Medium | M/M | Confirm couriers/API first; idempotent callbacks; design remittance later | Product |
| R-11 | Losing COD UX nuance during storefront port (quote, delivery verification, i18n) | Medium | Medium | M/M | Port `product-landing/*` + `lib/data/cod.ts` intent; Playwright E2E parity | Frontend |
| R-12 | Single-developer / knowledge concentration | Medium | High | M/H | ADRs + docs (this set), tests, documented provisioning | Eng lead |
| R-13 | Unused/cruft dependencies carried over (e.g. storefront `pg`) | Low | Low | L/L | Audit deps during Phase 1 scaffold; keep lockfile clean | Eng lead |
| R-14 | Secrets leakage during migration (`.env` handling) | Low | High | L/H | Never print/copy secrets; use `.env.example`; rotate secrets at cutover; keep existing `.env` off-limits | Eng lead |
| R-15 | Search feature regression (dropping instantsearch adapter) | Medium | Low | M/L | Start with SQL search; decide Meilisearch/Algolia (open question) | Product |
| R-16 | Scope creep into microservices / multi-tenant prematurity | Low | Medium | L/M | Constraints fixed: no microservices; deployment isolation (ADR-0002, ADR-0010) | Eng lead |
| R-17 | Admin operations use one shared key; no per-operator identity, roles, or revocation (Phase 6) | Medium | High | M/H | Interim only: key held in httpOnly cookie, never in client JS; actor recorded in history; replace with JWT + RBAC (ADR-0007) before multi-user/production ops | Backend |
| R-18 | No collection/remittance workflow; `collection_status` stuck at `cod_pending` | Medium | Medium | M/M | Model + surface the status now; add courier remittance later with R-10 | Product |
| R-19 | Public inventory read endpoints expose stock levels (pre-existing) | Low | Low | L/L | Already surfaced via the public catalog; revisit if inventory detail becomes sensitive | Backend |

## Accepted / monitored

- R-05 and R-15 are accepted for Phase 1 with the stated mitigations and
  revisited at the relevant open-question decision points.
- R-02, R-03, R-04 are release-blocking; they must have green tests before
  cutover.
- R-17 is accepted for the single-store Phase 6 operations UI: it is a UX
  affordance over the existing admin guard, not a new trust boundary, and must be
  replaced by ADR-0007 before multiple operators or sensitive data are involved.
