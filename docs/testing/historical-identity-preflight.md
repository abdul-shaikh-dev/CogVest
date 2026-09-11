# Historical Identity Preflight (#332)

## Diagnosis

The previous planner enriched a provider asset with each source ISIN, then kept
the first identity and skipped a later conflicting identity. This prevented the
batch from saving but displayed fewer proposed additions without accounting for
the excluded row. The matching UI separately called both groups matched.

The authorized local six-file replay source still contained 267 rows at this
inspection, including eight rows across the two reported historical identities.
The current files may differ from the owner's edited phone inputs. The original
phone preview's 266 additions is consistent with excluding the one later-identity
row; it is not evidence of a successful 267-row import.

## Current Boundary

- Preflight considers source ISINs, selected/suggested provider identity, ticker
  and exchange, the original Zerodha source listing, and saved canonical aliases
  using the row-enriched identity. Selecting a different quote exchange does not
  establish compatible units for two ISINs on that source listing.
- Distinct historical identities sharing a listing are flagged before batch
  acceptance; every affected row remains accounted for.
- Parsed rows equal proposed additions plus duplicates plus conflicting
  transactions plus rows needing resolution. Other batch-level validation can
  still block the entire command; proposed additions are not saved partially.
- Same-ISIN continuity remains supported. Quote identity alone cannot establish
  historical quantity equivalence.
- No schema, source record, source file or corporate-action conversion changed.

This is the safety/reporting portion of #332, not a fix for reconstructing the
owner's corporate actions. #333-#335 must provide evidence-backed event handling
before these histories can be combined. Keep #332 open until that integrated
path is verified; #337 owns final broker reconciliation.

## Regressions

Synthetic tests cover 267 parsed rows colliding on one provider listing, shared
quote IDs with different asset IDs, an existing saved conflicting ISIN,
ISIN-enriched canonical aliases through renamed listings, input-order invariance,
unrelated rows, same-ISIN deduplication, and collision UI before acceptance.

Native flow: `e2e/standalone/zerodha-identity-collision.yaml`. Push the synthetic
`e2e/fixtures/zerodha-identity-collision.csv` into emulator Downloads first. The
fixture deliberately uses synthetic ISINs with one public live lookup symbol to
reproduce the provider mapping shape. It is not a corporate-action claim about
that symbol. The flow clears disposable app data and requires Yahoo lookup.

The native journey asserts unresolved identities, complete row accounting, no
confirmation action, and an empty portfolio after restart. Use a newly built
standalone APK, not the already installed phone build. Private screenshots and
CSVs must not be committed or uploaded.

## Verification (2026-09-11)

- `npm run test:verify`: typecheck passed; 142 suites passed, one skipped;
  1,363 tests passed, two skipped; Expo Doctor passed 17/17 checks.
- Fresh standalone release APK built locally for x86_64 and installed on
  emulator-5554 (Pixel_10_Pro AVD, API 36, 1280x2856, density 480, font scale 1.0).
  Version 1.0.4/build 5 identifies local QA here, not a new phone release.
- APK SHA-256: `6272D8CCA85B8C83DCB42C84EE9B15410B164167305025A7092E34E4B83AE7B6`.
- Maestro journey passed, including selecting NSE for one historical ISIN and
  BSE for the other: both remained unresolved, all rows were accounted for,
  confirmation stayed unavailable, and no holdings existed after restart.
- The captured native screen was visually inspected. Independent read-only
  review found a canonical-alias gap; it was corrected with a regression test.
  Follow-up review found no remaining issues in that correction or the
  alternate-exchange guard.
- This verifies safe rejection, not corporate-action reconstruction or final
  reconciliation against the owner's broker balances.
