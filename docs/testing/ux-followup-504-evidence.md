# UX follow-up #504

Implemented against `c7aed2a`, checked on 2 October 2026. This is a scoped
follow-up, not certification of every CogVest screen or a performance result.

## Changes and review

- Progress uses the same investment-only comparison as Monthly History. The
  chart's total portfolio series still includes cash. Invalid or zero basis does
  not produce a percentage, and PPF-excluded history still has no comparison.
- The plot precedes selected-month navigation and the selected values. The range
  stays above it; the selected month stays with its values. Estimate warnings,
  custom ranges and missing-month breaks remain intact.
- Dashboard activity and allocation sections have less vertical padding. Two
  unmasked zero metrics become `No net investment or cash change`. This does not
  claim that no offsetting transactions occurred. Masked values retain the
  masked metric presentation rather than revealing that they are zero.
- Holding details put position metrics immediately after valuation/provenance.
  Purchase now preserves the selected holding on return, as sale already did.
- Add Holding and Record purchase share search-field wording and step progress,
  use the same saved/listing row components, and group discovery in a card.
  Purchase still uses an explicit provider search; Add Holding retains its
  existing debounced search and manual fallback. Their accounting is unchanged.
- Holdings' Add menu opens the existing Futures screen, whether a wallet exists
  or not. The menu does not create accounts or expand contract support.

Owned-diff review checked range-index alignment, zero/invalid basis, masking,
partial PPF history, modal focus/return, saved asset identity and absence of
persistence changes. No new dependency or storage migration was introduced.

## Build and automated checks

- Fresh local release-mode x86_64 APK, version 1.0.15 / code 16.
- SHA256: `02A525B9142B4CFE469F2CAF3785C8EFE8522D7320F45310CD2F99022D62D61C`.
- Local debug signing for emulator testing only, not a distribution build.
- `CogVest_UX_Proof`, Android API 36, density 480, software renderer.
- Normal: 1280x2856, font 1.0. Enlarged: 1080x2400, 360dp width, font 1.3.
- `npm run test:v1:pc` passed on the final source and installed APK: TypeScript,
  189 suites / 1,978 tests, 17/17 Expo checks, Android doctor and strict smoke.
  One suite containing three tests remains skipped, not counted as verified.
- Tests cover nonzero/zero/cash-heavy balances, losses, zero invested basis,
  estimates, gaps, range alignment, masks, plot order, shared entry cues,
  purchase return and Futures discovery without writes. Existing purchase tests
  assert persisted units, fees, linked Cash and failure-path atomicity.

## Native evidence

The synthetic portfolio was retained. No real statement or private screenshot
is included. Background quote refresh was not disabled; current prices can
change between captures. Stored April comparison is the stable assertion.

`e2e/visual/ux-followup-504.yaml` checks Dashboard, holding detail, purchase/sale
return, Futures discovery, both search keyboards and Progress at normal and
enlarged text. September now displays +558.83%, matching the history baseline,
rather than the old cash-inclusive +562.87%. Selecting April displays -3.46%.
The flow asserts Cash remains INR 50,000 and the transaction list stays empty.

`history-invested-comparison.yaml` checks April's history row and detail at
-3.46%, its INR 58,000 shortfall, the separate monthly portfolio change, and
masked history/detail. `purchase-review-layout.yaml` checks quantity 2, price
INR 100, fees INR 5 and Cash debit INR 205, then Back and discard without saving.

The final APK passed the main walkthrough at both sizes and the history/purchase
flows at normal size. History/purchase also passed at 130% on the preceding local
build, before the final purchase-return correction. The final enlarged walkthrough
then verified that correction and both keyboard states.

`ux504-futures-return.yaml` passed at normal size. It creates a temporary
1,000 USDT wallet, reopens it from Holdings, verifies the same balance rather
than a creation form, deletes that temporary wallet, and verifies Cash is still
INR 50,000. Its first attempt lacked a cold-start readiness wait and failed before
creating the wallet. Adding explicit screen-readiness waits resolved that test.
The original display size and font scale were restored after verification.

The first walkthrough failed only at its final assertion against the disabled
developer evidence route. It was corrected to assert the production transaction
list and rerun. An early Progress capture caught the preceding route; the flow
now waits for the Progress selector before capture. Neither rejected capture is
used as evidence.

## Before and after

Before captures are the research baseline from #504, APK 1.0.14/code15, containing
the #502 UI changes. They are historical evidence, not captures of this build.

| View | Before | After, normal | After, 130% |
| --- | --- | --- | --- |
| Dashboard | [Before](../reviews/artifacts/2026-10-02-ux504/before/01-dashboard.png) | [After](../reviews/artifacts/2026-10-02-ux504/normal/dashboard.png) | [Large](../reviews/artifacts/2026-10-02-ux504/large/dashboard.png) |
| Progress | [Before](../reviews/artifacts/2026-10-02-ux504/before/03-progress.png) | [After](../reviews/artifacts/2026-10-02-ux504/normal/progress.png) | [Large](../reviews/artifacts/2026-10-02-ux504/large/progress.png) |
| Chart | [Before, large](../reviews/artifacts/2026-10-02-ux504/before/16-progress-large.png) | [After](../reviews/artifacts/2026-10-02-ux504/normal/chart.png) | [Large](../reviews/artifacts/2026-10-02-ux504/large/chart.png) |
| Holding detail | [Before](../reviews/artifacts/2026-10-02-ux504/before/14-holding-detail.png) | [After](../reviews/artifacts/2026-10-02-ux504/normal/holding-detail.png) | [Large](../reviews/artifacts/2026-10-02-ux504/large/holding-detail.png) |
| Add Holding | [Before](../reviews/artifacts/2026-10-02-ux504/before/06-add-holding.png) | [After](../reviews/artifacts/2026-10-02-ux504/normal/add-holding.png) | [Keyboard](../reviews/artifacts/2026-10-02-ux504/large/add-keyboard.png) |
| Record purchase | [Before](../reviews/artifacts/2026-10-02-ux504/before/07-record-purchase.png) | [After](../reviews/artifacts/2026-10-02-ux504/normal/purchase.png) | [Keyboard](../reviews/artifacts/2026-10-02-ux504/large/purchase-keyboard.png) |

The chart no longer requires scrolling past the month-navigation row and the
comparison panel. At 130% text it still requires scrolling past the summary and
estimate status. Those remain readable; no text or touch target was shrunk to
force the entire chart into the initial viewport. Position metrics appear before
management actions at both sizes. Search fields remain above the keyboard.

## Limits

No physical-phone, TalkBack, cloud build, import rerun or backup round-trip claim.
Provider failure/empty states and unusually long identities retain their existing
logic and automated coverage; this native pass did not exercise every remote
provider response. #299 frame-pacing and #218 encryption remain separate.
