# Historical Identity Preflight (#332)

## Diagnosis

The previous planner enriched a provider asset with each source ISIN, then kept
the first identity and skipped a later conflicting identity. This prevented the
batch from saving but displayed fewer proposed additions without accounting for
the excluded row. The matching UI separately called both groups matched.

The authorized local six-file replay source contained 267 rows at this
inspection, including eight rows across the two reported historical identities.
The owner later confirmed that the successful fresh-device replay used the six
complete, unedited broker exports. The original phone preview's 266 additions is
consistent with excluding the one later-identity row; it was not evidence of a
successful 267-row import.

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

This section records the safety/reporting portion originally delivered for #332.
The later evidence-backed event handling and integrated broker reconciliation are
recorded below.

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

## Integrated closure (2026-09-14)

The split, bonus-share and demerger work in #333-#335 supplied explicit,
catalog-backed continuity for the reported historical identities. Ambiguous or
unsupported relationships still fail before confirmation instead of being
merged by provider ID.

The final #337 replay used CogVest's production parser and planner with all six
complete, unedited annual Tradebooks. The fresh Android preview reported all 267
rows as additions, with zero duplicates, conflicts, unsupported events or rows
needing resolution. The saved portfolio matched the dated broker baseline for
every open-position quantity and matched displayed invested costs within INR
0.10. After restart, reimporting the same files classified all 267 rows as
duplicates and kept confirmation disabled. See
`docs/testing/2026-09-14-corporate-action-reconciliation.md`.

Together, the regression suites cover provider-shaped shared-listing collisions,
renames, exchange alternatives, incompatible currency and ISIN metadata,
already-saved holdings, mixed annual files, complete row accounting, atomic
persistence failure, restart and duplicate-only reimport. This completes #332;
current-value and P&L comparison remains quote-timestamp-dependent rather than an
asset-identity acceptance gap.
