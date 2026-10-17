# ADR-0005 — Money as integer minor units

- Status: Proposed
- Date: 2026-10-11
- Deciders: BITA Agency engineering

## Context

Money was handled inside Medusa (its own amount conventions). The new system
owns totals. Floating-point arithmetic on money is a correctness bug; DZD is the
primary (and initially only) currency.

## Decision

Store every monetary amount as an **integer in minor units** (`BIGINT` in
Postgres, Prisma `BigInt`) alongside an ISO-4217 `currency_code`. A shared
`Money` value object in `packages/contracts` handles parsing, formatting,
addition and comparison. Currency-specific `minor_digits` is stored in
`Currency`.

All arithmetic happens in the API. The storefront's displayed quote is advisory;
the API recomputes the authoritative totals at order creation from variant
prices + shipping rate + adjustments.

## Consequences

### Positive

- No floating-point rounding errors.
- Single, testable money abstraction; easy currency formatting per locale.

### Negative

- All amounts must be converted at the boundaries; `BigInt` needs care in JSON
  serialization (serialize as string, not number, to avoid precision loss).
- Per-currency display rules must be maintained.

### Follow-ups

- Define rounding policy once (half-up at line/total boundary) and test it.
- API DTOs serialize money as strings.
