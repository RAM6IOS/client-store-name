# ADR-0013: Storefront localization without locale-prefixed routes

- Status: Accepted
- Date: 2026-10-11
- Supersedes: none
- Related: ADR-0010 (client isolation), ADR-0012 (shipping/locations)

## Context

The Algerian storefront must serve **Arabic (RTL, default)** and **French (LTR)**
from a single, mobile-first Next.js App Router deployment (one store, one DB,
one deployment — ADR-0010). Two common approaches exist:

1. **Locale-prefixed routes** (`/ar/...`, `/fr/...`): every page exists once per
   locale, `generateStaticParams`/routing is duplicated, and internal links must
   thread the active locale everywhere.
2. **A single route tree with a locale cookie/query**: one canonical URL per
   page; the active locale is resolved per request.

The storefront is fully server-rendered and already reads request cookies in the
root layout, so it can resolve the locale server-side without shipping routing
complexity. The catalog has no localized slugs yet (handles are shared), so
per-locale URLs would not add indexable value today.

## Decision

1. **One canonical route tree.** Pages live at `/`, `/products`,
   `/products/[handle]`, `/categories/[slug]`, `/checkout`, and
   `/order-success/[token]`. There are no `/ar` or `/fr` prefixes.
2. **Locale persists in a cookie (`locale`).** Arabic is the default; the
   shopper switches via `?lang=ar|fr`. `src/middleware.ts` reads the query,
   writes the cookie (one year, `SameSite=Lax`, not `HttpOnly` so the client can
   also read it), then **redirects to the same URL with the query removed** so
   the canonical URL stays clean and the page re-renders server-side.
3. **Server is the source of truth for direction.** The root layout reads the
   cookie and sets `<html lang="ar|fr" dir="rtl|ltr">`; components use logical
   CSS properties (`margin-inline`, `padding-inline`) so the same markup mirrors
   correctly in both directions.
4. **All UI strings come from `src/lib/i18n/dictionaries.ts`.** Arabic and French
   must define the same keys (enforced by a test); no hardcoded copy in
   components. A missing locale value falls back to Arabic rather than erroring.
5. **hreflang alternates point at the same path with `?lang=`.** `seo.ts`
   derives canonical URLs and `alternates.languages` from the path, keeping the
   single tree discoverable in both languages without duplicate routes.

## Consequences

- Clean, stable URLs shared by both languages; no route duplication or
  middleware-based path rewriting for content.
- Locale switching is a single redirect that sets a cookie; deep links work in
  either language and remain shareable.
- The catalog is not yet localized at the data level (product `title`/
  `description` are single-valued). When localized content is introduced, this
  ADR must be revisited (see alternatives).
- Middleware must keep excluding static assets (`_next/static`, `_next/image`,
  `favicon.ico`) to avoid redirecting asset requests.

## Alternatives considered

- **Locale-prefixed routes (`/ar`, `/fr`)** — rejected for now: doubles routing
  and static generation with no localized data to justify it; can be adopted
  later if localized content/slugs are added.
- **Client-only locale state (no cookie)** — rejected: the storefront is
  server-rendered (RTL/LTR, localized metadata, SSR content); locale must be
  known on the server for the first byte.
- **`Accept-Language` negotiation only** — rejected: no explicit shopper choice,
  and it fights caching; an explicit cookie is predictable.
- **`HttpOnly` locale cookie** — rejected: the checkout/cart UI reads the locale
  client-side for formatting; the cookie carries no secret.
