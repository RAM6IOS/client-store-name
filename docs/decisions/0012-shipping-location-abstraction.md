# ADR-0012: Algeria location data & shipping/delivery abstraction

- Status: Accepted
- Date: 2026-10-11
- Supersedes: none
- Related: ADR-0005 (money), ADR-0007 (auth), ADR-0010 (client isolation)

## Context

BITA COD is a cash-on-delivery store for Algeria. Every order must resolve to a
real administrative destination (wilaya + commune) and to a **configured**
delivery price. Algeria's 2026 territorial division (loi n° 26-06, Journal
Officiel n° 25) created 11 new wilayas, bringing the total to **69 wilayas /
1541 communes**. Historically the source material was only the 48/58-wilaya
division, so codes and commune assignments must be verified, not assumed.

At the same time, delivery in Algeria is performed either by the store itself
(home delivery) or through third-party carriers that also expose stop-desks and
their own location codes. We must design for those carriers **without** calling
them yet, without inventing their data, and without leaking credentials or
coupling the storefront to any one provider (single store, single DB, single
deployment — ADR-0010).

## Decision

1. **Administrative data is a committed, versioned dataset.** The 69 wilayas and
   1541 communes are committed at
   `apps/api/src/common/dz/data/dz-locations.json` with provenance (source,
   license, retrieval date, legal basis) and a **per-row verification status**
   (`verified` / `spelling_variant` / `unmatched` / `unchecked`). Server code
   reads it only through `apps/api/src/common/dz/locations.ts`; no hardcoded
   codes or names.
2. **Rows that could not be confirmed against the law are flagged, never
   silently accepted.** Name differences are recorded with the official label
   and a similarity score and surfaced through
   `GET /api/locations/verification` and `docs/shipping-location-data.md`.
3. **Stable internal identity + explicit external mappings.** `Wilaya.code` and
   `Commune.code` are the internal identifiers. Carrier/legacy codes live in a
   separate `LegacyLocationCode` table (`provider`, `legacy_code` →
   `wilaya_code`/`commune_code`). Carrier coverage is **never** conflated with
   administrative data, and no carrier support is invented for the new wilayas.
4. **Delivery price is configuration, never a guess.** `DeliveryRate`
   (wilaya × method × currency × provider) holds the tariff. An unknown or
   disabled destination, or a missing active rate, returns an explicit
   `DELIVERY_UNAVAILABLE` (HTTP 422) instead of a default price.
5. **Stop-desks come from a provider interface only.** When no provider is
   configured the list is empty; stop-desk values supplied by a client are
   stored as an order snapshot but never treated as provider-verified. A fake
   provider is used in tests only.
6. **Provider credentials are server-side configuration.** They are read from
   the environment and never returned by any endpoint; admin provider status is
   secret-free.
7. **Order snapshots are immutable.** The applicable quote (rate id, fee, method,
   currency, provider, wilaya names, issue/expiry timestamps) and the resolved
   commune/stop-desk are copied onto the order at checkout, so later config or
   dataset edits never rewrite history.

## Consequences

- The storefront can render wilayas/communes and live quotes from one source of
  truth and can add a carrier later by implementing `ShippingProvider` and
  setting `SHIPPING_PROVIDER`, with no schema or storefront changes.
- Money stays in integer minor units (ADR-0005); quotes carry `BigInt` fees
  serialised as strings.
- Automated tests never make live carrier calls and never create real shipments.
- Residual spelling differences (17 rows at the time of writing) are visible and
  reviewable; correcting them is a data edit, not a code change.
- Zones/geographic grouping and live carrier integrations remain future work.

## Alternatives considered

- **Import the dataset blindly** — rejected: new-wilaya codes and commune
  assignments must be verified against the JO; unverified rows are flagged.
- **Hardcode 58 wilayas** — rejected: the store must serve the 2026 division.
- **Model carrier codes on the wilaya/commune tables** — rejected: conflates
  administrative and commercial data and breaks when a carrier changes codes.
- **Return a default rate when none is configured** — rejected: shipping is a
  real cost; guessing produces wrong totals and disputes.
- **Store a static list of stop-desks** — rejected: would require fabricating
  desks; desks must come from a live provider.
