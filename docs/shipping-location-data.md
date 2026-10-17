# Algeria location data (wilayas & communes)

Single source of truth for administrative divisions used by the API:

- Runtime helpers: `apps/api/src/common/dz/locations.ts`
- Committed dataset: `apps/api/src/common/dz/data/dz-locations.json`
- Legacy/carrier mappings: `apps/api/src/common/dz/data/legacy-location-codes.json`

The dataset is imported into the database by `apps/api/prisma/seed.ts` (wilayas
and communes) and exposed read-only over
[`/api/locations/*`](api/shipping-and-locations.md).

## Legal basis

- **Loi n° 26-06** portant découpage territorial — **69 wilayas, 1541 communes**.
- **Journal Officiel de la République Algérienne n° 25**, 17 Chaoual 1447 /
  **5 avril 2026**.

Algeria's older division had 48 then 58 wilayas; the 2026 law adds wilayas
**59–69**. Codes and commune assignments for the new wilayas therefore must be
verified against the law rather than inferred from older lists.

## Source & license

| Field      | Value                                                           |
| ---------- | --------------------------------------------------------------- |
| Repository | `https://github.com/riadh2002/algeria-69-wilayas-1541-communes` |
| Files      | `data/wilayas.json`, `data/communes.json`, `docs/JO-25-2026.md` |
| License    | MIT (see the repository's `LICENSE` / `NOTICE`)                 |
| Retrieved  | 2026-10-11                                                      |

The source is a **starting point only**; it is cross-checked against the JO
before use.

## What the dataset contains

`dz-locations.json` has three top-level keys:

- `metadata` — title, `legal_basis`, `source`, `counts`, `counts_by_wilaya`, and
  a `verification` block (see below).
- `wilayas[69]` — `code`, `name_fr`, `name_ar`, `latitude`, `longitude`.
- `communes[1541]` — `code` (internal), `post_code` (5 chars, unique),
  `name_fr`, `name_ar`, `daira`, `daira_ar`, `wilaya_code`, `latitude`,
  `longitude`, `verification_status`, `verification_note`.

`verification_status` is one of:

| Status             | Meaning                                                         |
| ------------------ | --------------------------------------------------------------- |
| `verified`         | Name matches the official JO label.                             |
| `spelling_variant` | Same place, different transliteration of the Arabic name.       |
| `unmatched`        | Name differs materially — **requires manual review**.           |
| `unchecked`        | Not individually name-checked (count verified at wilaya level). |

## Verification performed

1. **Headcounts** for every JO-cited wilaya were compared against the dataset.
   All 21 checks passed, including the new wilayas: 59→12, 60→8, 61→5, 62→4,
   63→4, 64→6, 65→10, 66→8, 67→21, 68→23, 69→7.
2. **New wilayas (59–69)** were cross-checked commune-by-commune against JO
   articles 52 bis 10–20.
3. **Wilaya names** for 59–69 match the JO.
4. **Every JO label** was matched to a dataset row; `unmatched_law_labels` is
   empty (no law label was dropped).
5. **Name differences** were recorded rather than accepted silently.

Counts reported by `GET /api/locations/verification` (sum = 1541):
`verified 91`, `spelling_variant 10`, `unmatched 7`, `unchecked 1433`.

### Rows flagged for review (17)

Recorded with the source name, the JO label and a similarity score:

| Wilaya | post_code | source name        | JO label                  | status           |
| ------ | --------- | ------------------ | ------------------------- | ---------------- |
| 59     | 59012     | Beidha             | El Beïdha                 | spelling_variant |
| 60     | 05015     | Metkaouak          | Abdelkader Azil           | unmatched        |
| 60     | 05055     | M'doukel           | M'Doukal                  | spelling_variant |
| 61     | 07020     | Djemorah           | Djemourah                 | spelling_variant |
| 62     | 62013     | El Ogla            | El Ogla El Melha          | unmatched        |
| 64     | 14009     | Zmalet El Emir Aek | Zmalet El Emir Abdelkader | unmatched        |
| 64     | 64039     | Serghine           | Serguine                  | spelling_variant |
| 65     | 17009     | Bouira Lahdeb      | Bouira Lahdab             | spelling_variant |
| 65     | 65031     | Ain Oussera        | Aïn Ouessara              | spelling_variant |
| 66     | 17007     | Feidh El Botma     | Faïdh El Botma            | spelling_variant |
| 67     | 26042     | Oum El Djalil      | Oum El Djallil            | spelling_variant |
| 67     | 26049     | Meftaha            | M'Fatha                   | unmatched        |
| 68     | 28034     | Oued Chair         | Menaâ                     | unmatched        |
| 68     | 28039     | Ouled Atia         | Mouhamed Boudiaf          | unmatched        |
| 68     | 68041     | Ain El Melh        | Aïn El Meleh              | spelling_variant |
| 68     | 28046     | Oultene            | Oultem                    | unmatched        |
| 69     | 69019     | El Mehara          | El Meharra                | spelling_variant |

These are transliteration/renaming questions, not missing rows. Correcting them
is a data edit in `dz-locations.json` followed by a re-seed.

## Carrier / legacy codes

Carrier-specific codes are **not** part of the administrative data. They live in
`legacy-location-codes.json` (`provider`, `legacy_code`, `wilaya_code`,
`commune_code`, `label`) and in the `legacy_location_codes` table. The file is
**empty by default**: no carrier codes are invented. Add verified mappings only,
then re-seed. `commune_code` refers to the internal `Commune.code`, not the
postal code.

## Updating the dataset

1. Replace `wilayas` / `communes` from an authoritative source.
2. Re-run the verification (headcounts + law cross-check) and refresh the
   `metadata.verification` block.
3. Re-run `pnpm --filter @bita/api db:seed` (idempotent: wilayas are upserted and
   communes are rebuilt atomically).
4. Confirm `GET /api/locations/meta` and `/api/locations/verification`.

Never invent a commune assignment or a carrier mapping: flag it instead.
