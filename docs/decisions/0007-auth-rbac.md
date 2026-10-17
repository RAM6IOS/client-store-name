# ADR-0007 — JWT + Argon2id authentication and RBAC

- Status: Proposed
- Date: 2026-10-11
- Deciders: BITA Agency engineering

## Context

The source system delegated auth to Medusa (`authenticated` admin routes,
publishable keys, JWT secret in `medusa-config.ts`). The new API owns auth.

> **Interim (Phase 6).** Until this ADR is implemented, administrative endpoints
> are protected by the shared `ADMIN_API_KEY` (`AdminApiKeyGuard`,
> `x-admin-api-key`). The Phase 6 admin UI holds that key in an httpOnly session
> cookie and attaches it server-side; it never reaches the browser. This is a
> single shared secret with no per-operator identity, roles, or revocation — see
> R-17 in the risk register. It must be replaced by the JWT + RBAC design below
> before multiple operators or sensitive data are involved.

COD checkout must work for **guests** (name + phone); requiring accounts would
add friction and is not how the current storefront works.

## Decision

- **Staff/admin**: email + password hashed with **Argon2id**. Short-lived JWT
  access token; rotating refresh token whose hash is stored server-side and can
  be revoked. Access token via `Authorization: Bearer` (SPA) or httpOnly
  `SameSite=Lax Secure` cookie (server-rendered admin).
- **Customers**: guest-first for Phase 1. Accounts (phone OTP or email/password)
  are optional and must never block guest COD.
- **Storefront public API**: a per-deployment publishable key scopes public
  endpoints.
- **Authorization**: RBAC with roles `OWNER`, `MANAGER`, `OPERATOR`, `VIEWER`.
  Guards enforce role per route; services enforce resource scoping. Actor
  identity flows into COD status history.

Hardening: rate-limit auth and public order creation, account lockout on
repeated failures, no secret/token logging.

## Consequences

### Positive

- Self-contained auth; no framework coupling.
- Guest COD preserved.
- Audit trail of who performed each COD transition.

### Negative

- We own session security, token rotation, and password reset flows.
- More code to test (auth is security-sensitive).

### Follow-ups

- Implement and test refresh-token rotation and revocation.
- Add rate limiting at the edge or via NestJS guard/interceptor.
