# ADR-0010 — Client isolation by deployment

- Status: Proposed
- Date: 2026-10-11
- Deciders: BITA Agency engineering

## Context

The target model is "independent project, database, credentials, and
infrastructure for every client". This is effectively single-tenant per
deployment. A naive multi-tenant schema (shared tables + `tenant_id`) would add
complexity and risk that the business does not ask for.

## Decision

**Primary isolation: one deployment per client** — own project, own PostgreSQL
database, own secrets/credentials, own hosting and object storage. No shared
runtime or shared database across clients. Configuration lives in `StoreSetting`
and environment variables, never in code.

**Defense in depth (optional):** tenant-owned tables may carry a `store_id`, and
queries are scoped by it. This does not make the product multi-tenant; it guards
against accidental cross-environment data import and lowers the cost of any
future consolidation. Adopting `store_id` everywhere is pending (see open
questions).

Copying the repository does **not** synchronise future updates, so each client
fork needs a documented core-change propagation process.

## Consequences

### Positive

- Strong isolation and simple blast radius.
- Straightforward backups, secrets and compliance per client.
- No multi-tenant query/leak risk.

### Negative

- Fixes and features must be propagated to each client fork/branch.
- More environments to operate as the client count grows.

### Follow-ups

- Document the per-client provisioning checklist (Phase 7).
- Choose the propagation mechanism (shared `packages/*` published per client vs
  fork/merge) — open question.
