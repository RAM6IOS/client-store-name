# ADR-0006 — COD order state machine

- Status: Proposed
- Date: 2026-10-11
- Deciders: BITA Agency engineering

## Context

The source repository already defines a COD lifecycle in
`apps/backend/src/modules/cod/types.ts`. It is the most valuable framework-
agnostic asset in the repo, and it encodes operational reality.

Statuses: `new, no_answer, confirmed, preparing, with_delivery_company,
delivered, returned, cancelled`.

Transitions:

| From | To |
| --- | --- |
| `new` | `no_answer`, `confirmed`, `cancelled` |
| `no_answer` | `no_answer`, `confirmed`, `cancelled` |
| `confirmed` | `preparing`, `cancelled` |
| `preparing` | `with_delivery_company`, `cancelled` |
| `with_delivery_company` | `delivered`, `returned` |
| `delivered` / `returned` / `cancelled` | terminal |

## Decision

Adopt this state machine as-is, defined once in `packages/contracts` and consumed
by the API, admin UI and tests. The API enforces transitions server-side;
illegal transitions return HTTP 409. Every transition appends exactly one
immutable `CodStatusHistory` row (from, to, actor id + name, note, timestamp)
within the same transaction as the status change.

## Consequences

### Positive

- Preserves proven operational flow; no re-discovery of requirements.
- One definition removes drift between API, admin and tests.
- Append-only history gives auditability (who confirmed/changed what and when).

### Negative

- New operational states require a contract change + migration.

### Follow-ups

- Port `transition-cod-order.unit.spec.ts` to lock the table.
- Decide whether `Order.status` and `CodStatus` are kept in lockstep or allowed
  to diverge (open question in architecture.md).
