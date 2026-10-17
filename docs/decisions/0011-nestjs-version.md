# ADR-0011 — NestJS major version for the initial build

- Status: Accepted
- Date: 2026-10-11
- Deciders: BITA Agency engineering

## Context

As of October 2026, NestJS 11.1.x is the stable maintenance line and NestJS
12.x (12.1.x) is current. Nest 12 is ESM-first, adds Standard Schema validation,
a rebuilt CLI, and requires Node 20.19+ or 22.12+. Nest 11 requires Node 20+.

The source repository is not on Nest at all (it uses Medusa's framework), so
there is no legacy constraint. The only real trade-off is risk tolerance.

## Options

1. **NestJS 11.x LTS** — lower risk, huge amount of documentation and community
   examples, CommonJS-friendly, no ESM adoption needed for our own code.
2. **NestJS 12.x** — current, ESM packages, Standard Schema validation, modern
   defaults; slight ecosystem/tooling novelty risk.

## Decision

Use **NestJS 11.x** (`@nestjs/common` / `@nestjs/core` /
`@nestjs/platform-express` `11.2.7`, `@nestjs/config` `4.0.4`) for the initial
build. This matches the original default recommendation below.

### Phase 1 spike result (2026-10-11)

The Phase 1 skeleton was first scaffolded on `@nestjs/*` `12.1.2`. The spike
proved that **NestJS 12 is ESM-only**: the published packages set
`"type": "module"` and expose only ESM entries in `exports` (e.g.
`@nestjs/common@12.1.2` ships `index.js` with `import` statements and no CJS
`require` condition). This is incompatible with the rest of the chosen
toolchain:

- Jest 29 + ts-jest run on a CommonJS module runtime and cannot load
  ESM-only dependencies without a full ESM test setup.
- The API builds with `nest build` (tsc, CommonJS), and the Prisma 7 client is
  generated with `moduleFormat = "cjs"` to match.

Rather than migrate the whole API (build, runtime, tests, Prisma output, and
relative import specifiers) to native ESM for a skeleton, we standardised on
NestJS 11 (CommonJS). The stack was verified end to end (unit + e2e tests,
`nest build`, and a running API with a live Prisma/Postgres health check).

Revisit NestJS 12 in a dedicated, tested migration once the core domain modules
(Phase 3) are stable. Migrating will additionally require: native ESM output
(`module: "nodenext"`, `.js` relative import specifiers), an ESM-capable test
runner (Vitest + SWC with `emitDecoratorMetadata`, or Jest in ESM mode), and
`moduleFormat = "esm"` in the Prisma generator.

## Consequences

### If 11.x

- Lower risk; may require an ESM/validation migration to reach 12.x later.
- Modern-enough feature set for a COD commerce API.

### If 12.x

- Current and longer runway before the next major.
- Must verify all chosen libraries (Zod via Standard Schema, Prisma, testing)
  work on Nest 12 before committing.

## Follow-ups

- Spike: scaffold the API on the chosen version and confirm Prisma + Zod +
  Jest/Supertest integration in Phase 1. **Done** (see Phase 1 spike result).
- Plan a dedicated ESM upgrade spike for NestJS 12 after Phase 3.
