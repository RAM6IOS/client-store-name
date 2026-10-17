# ADR-0004 — PostgreSQL + Prisma

- Status: Proposed
- Date: 2026-10-11
- Deciders: BITA Agency engineering

## Context

The target stack mandates PostgreSQL and Prisma. The source Medusa repo used
MikroORM through Medusa, so there is no existing Prisma schema or client.
PostgreSQL 16 is already installed locally (16.15).

## Decision

Use **PostgreSQL 16** with **Prisma 7.x** (stable) as the ORM. The Prisma schema
and generated client live in `packages/database` and are imported by the API and
scripts. Prisma migrations are the only schema-change mechanism.

Rationale for Prisma 7 rather than 8: Prisma 8 is a release candidate as of
October 2026 (GA expected this month); production builds should not depend on an
RC. Track 8 for a later upgrade.

## Consequences

### Positive

- Typed data access, migrations, and a single schema source of truth.
- Well-supported PostgreSQL 16 target.
- Team familiarity.

### Negative

- Prisma's query API can obscure complex SQL; raw SQL is an escape hatch for
  performance-critical queries (reservation race, reporting).
- Prisma 8 upgrade will be a follow-up migration.

### Follow-ups

- Pin Prisma version; do not float `latest`.
- Evaluate Prisma 8 after GA for a deliberate, tested upgrade.
- Use explicit transactions and (where needed) raw SQL with row locks for
  inventory reservations (ADR-0008).
