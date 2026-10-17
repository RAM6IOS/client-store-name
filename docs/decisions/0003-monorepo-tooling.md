# ADR-0003 — pnpm workspace + Turborepo monorepo

- Status: Proposed
- Date: 2026-10-11
- Deciders: BITA Agency engineering

## Context

The source repository already uses a pnpm workspace + Turborepo monorepo, and
the target needs to share contracts, the database client, and config across API,
storefront and admin. pnpm is already the established package manager.

## Decision

Keep **pnpm workspaces** as the package manager and **Turborepo** as the task
runner. One lockfile at the root. Apps live in `apps/*`, shared packages in
`packages/*`.

## Consequences

### Positive

- Reuses the existing tooling mental model and CI shape.
- Shared `packages/contracts` prevents API/UI drift; shared Prisma client is
  built once.
- Turborepo caching keeps CI fast.

### Negative

- Workspace hoisting/peer-dependency quirks (already seen in the source repo,
  e.g. React type overrides).
- Adds build-graph complexity for new contributors.

### Follow-ups

- Pin `packageManager` exactly (pnpm 10.x).
- Declare Turborepo task `outputs` for every task (source repo's own rule).
