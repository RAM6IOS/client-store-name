# Architectural Decision Records

Architecture Decision Records (ADRs) for the BITA COD Starter. Each ADR captures
one significant, hard-to-reverse decision: context, the decision, consequences,
and status.

Status values: `Proposed`, `Accepted`, `Superseded`, `Deprecated`.

| ADR                                             | Title                                                  | Status   |
| ----------------------------------------------- | ------------------------------------------------------ | -------- |
| [0001](./0001-no-ecommerce-engine.md)           | Do not use Medusa (or any ecommerce engine)            | Proposed |
| [0002](./0002-modular-monolith.md)              | Modular monolith, not microservices                    | Proposed |
| [0003](./0003-monorepo-tooling.md)              | pnpm workspace + Turborepo monorepo                    | Proposed |
| [0004](./0004-postgres-prisma.md)               | PostgreSQL + Prisma                                    | Proposed |
| [0005](./0005-money-minor-units.md)             | Money as integer minor units                           | Proposed |
| [0006](./0006-cod-state-machine.md)             | COD order state machine                                | Proposed |
| [0007](./0007-auth-rbac.md)                     | JWT + Argon2id authentication and RBAC                 | Proposed |
| [0008](./0008-inventory-reservation.md)         | Inventory reservation model                            | Proposed |
| [0009](./0009-idempotency.md)                   | Idempotency for order creation and callbacks           | Proposed |
| [0010](./0010-client-isolation.md)              | Client isolation by deployment                         | Proposed |
| [0011](./0011-nestjs-version.md)                | NestJS major version for the initial build             | Accepted |
| [0012](./0012-shipping-location-abstraction.md) | Algeria location data & shipping/delivery abstraction  | Accepted |
| [0013](./0013-storefront-i18n.md)               | Storefront localization without locale-prefixed routes | Accepted |

## Template

```md
# ADR-NNNN — Title

- Status: Proposed
- Date: YYYY-MM-DD
- Deciders: ...
- Related: ...

## Context

## Decision

## Consequences

### Positive

### Negative

### Follow-ups
```
