# ADR-0009 — Idempotency for order creation and callbacks

- Status: Proposed
- Date: 2026-10-11
- Deciders: BITA Agency engineering

## Context

COD checkout is a single click from a product landing page; retries, double
clicks, flaky mobile networks and webhook redelivery can all create duplicate
orders. The storefront guards double-submit client-side only, which is not
sufficient.

## Decision

- Order creation accepts a client `Idempotency-Key` (or checkout token). A unique
  `IdempotencyKey` row (`scope + key`) stores the resulting order id; a repeat
  request returns the original order instead of creating a new one.
- Backstops: `CodOrder.order_id` is unique; `IdempotencyKey` is unique by
  `(scope, key)`.
- External callbacks (delivery-company status updates; future payments) are
  idempotent by the provider's external event id.
- Keys have an optional expiry; storage is cheap and keeps replay history.

## Consequences

### Positive

- No duplicate orders or duplicate side effects from retries.
- Safe provider redelivery.

### Negative

- Client must send a stable key (storefront generates one per attempt).
- Requires careful transaction ordering (reserve key and create order together).

### Follow-ups

- E2E test: same key twice → same order id.
- Define key retention/expiry window.
