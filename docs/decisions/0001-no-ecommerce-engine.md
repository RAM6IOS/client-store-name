# ADR-0001 — Do not use Medusa (or any ecommerce engine)

- Status: Proposed
- Date: 2026-10-11
- Deciders: BITA Agency engineering

## Context

The existing `bita-ecommerce-starter` is a Medusa DTC Starter fork. Medusa owns
the catalog, cart, checkout, pricing, inventory and order model; BITA's COD logic
is bolted on as a custom module, workflows, subscribers, admin extensions and a
storefront checkout. This imposes:

- A large vendored framework surface (`@medusajs/framework`,
  `@medusajs/types`, admin dashboard) that we do not control.
- Impedance mismatch: COD is not a first-class concept, so order lifecycle and
  admin operations fight the host model (metadata flags such as
  `delivery_intent=cod`, `payment_method=cod`).
- Upgrade pressure from `medusajs-update-action` and frequent `@medusajs/*`
  version bumps.
- Server/platform coupling (module loader, workflow engine, MikroORM data layer)
  that constrains the target stack (NestJS + Prisma).

The product is COD-first and geographically narrow (Algeria). Most Medusa
features (multi-region, promotions, payment providers, complex fulfillment) are
unused.

## Decision

Build the commerce domain as **owned code** on the target stack. Do not use
Medusa or any other ecommerce engine as the commerce backend.

## Consequences

### Positive

- Domain model matches the business exactly (COD state machine, wilayas,
  delivery types are first-class).
- Full control of data model, API contracts, admin UX, and upgrade cadence.
- Stack consistency: NestJS + Prisma + Next.js across the project.
- Smaller dependency and security surface.

### Negative

- We re-implement catalog, inventory, order and pricing primitives.
- No upstream community fixes/features; we own them.
- Migration from the existing Medusa database is required (Phase 6).

### Follow-ups

- Port the COD state machine and validation tests verbatim where possible.
- Keep `bita-ecommerce-starter` intact until Phase 6 cutover.
