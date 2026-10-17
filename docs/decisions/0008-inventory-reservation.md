# ADR-0008 — Inventory reservation model

- Status: Proposed
- Date: 2026-10-11
- Deciders: BITA Agency engineering

## Context

COD orders are not paid up front, so stock must be held while the order is
confirmed by phone, then either converted to a sale or released. Overselling is
a correctness failure. Medusa previously handled this; we now own it.

## Decision

- Track each stock unit per `StockLocation` in `InventoryLevel`
  (`stocked_quantity`, `reserved_quantity`).
- Availability = `stocked_quantity - reserved_quantity`.
- On order placement, create an `InventoryReservation` and increment
  `reserved_quantity` **in one transaction**, using an atomic conditional update
  or `SELECT ... FOR UPDATE` so the update only succeeds when availability is
  sufficient. Insufficient stock → `InsufficientStockError` → HTTP 409.
- Reservations carry a TTL for unconfirmed COD orders; a scheduled job expires
  and releases stale reservations.
- On cancel/return, release the reservation (or restock per policy); record in
  history.
- Backorders are **disabled** initially (mirrors source `allow_backorder: false`).

`InventoryReservation` is the durable ledger; `reserved_quantity` is a
denormalised counter kept consistent inside the transaction.

## Consequences

### Positive

- Prevents overselling under concurrency.
- Releases stock that COD orders never convert.
- Clear audit of holds vs sales.

### Negative

- Concurrency handling requires raw SQL / row locks and careful tests.
- The denormalised counter must always be updated transactionally.

### Follow-ups

- Integration test: N concurrent orders for the last unit → exactly one succeeds.
- Decide TTL length and expiry job schedule (open question).
