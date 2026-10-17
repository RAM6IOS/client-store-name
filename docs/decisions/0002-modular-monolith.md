# ADR-0002 — Modular monolith, not microservices

- Status: Proposed
- Date: 2026-10-11
- Deciders: BITA Agency engineering

## Context

The system is a single COD storefront + admin + API for one client per
deployment. The team is small. Constraints explicitly forbid microservices.

## Decision

One deployable NestJS API containing strictly separated domain modules
(`catalog`, `inventory`, `pricing`, `shipping`, `orders`, `cod`, `customers`,
`settings`, `auth`). Modules communicate through service interfaces, never by
reaching into another module's tables. All multi-step writes use DB
transactions.

## Consequences

### Positive

- Simple operations and deployment; one database; transactional integrity.
- Fast to build and reason about.
- Clear seams if a module ever needs extraction later.

### Negative

- Module boundaries must be enforced by convention/review (no compiler
  enforcement).
- One deploy scales the whole API.

### Follow-ups

- Document the module boundary rules in `docs/architecture.md` (Part B.3).
- Consider an ESLint boundary rule or dependency-cruiser in Phase 1.
