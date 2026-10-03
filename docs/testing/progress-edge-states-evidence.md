# Progress native edge-state evidence

3 October 2026. Related to #512. The tracker remains open.

## Scope

This pass exercises the real Progress screen with single-month, missing-month,
zero-only, empty, building and failed-price history. A development-only route
requires the local QA token and creates an isolated in-memory portfolio. It
neither reads nor replaces the persistent portfolio. No real financial documents
or provider requests are used.

The native review found a status defect: a portfolio containing saved snapshots
but no underlying activity records said "Waiting for the first month-end".
The status now recognizes stored history. Current-month-only activity still
waits for its first month-end. Calculations, generation rules and stored values
are unchanged.

The chart's portfolio/invested summary also clipped the magnitude suffix in
INR 12K and INR 10K at normal text size. The value column now has a 144dp minimum
width, while the adjacent comparison column can shrink. Amount text fills the
remaining row width instead of relying on its too-narrow native intrinsic
measurement. Enlarged text retains
the existing stacked layout. No font scaling or digits are removed.
[Before correction](../reviews/artifacts/2026-10-03-progress-edge/before/clipped-chart-values.png).

## Environment

CogVest_UX_Proof, Android API 36, density 480, reduced motion enabled with
animator duration scale 0. Normal captures use 1280x2856 and font scale 1.0.
Large captures use 1080x2400 and font scale 1.3. Restart after configuration
changes; these are settled layouts, not a live font-scale transition test.

Build command: `npm run android:apk:emulator`, followed by `adb install -r`.
Freshly rebuilt and installed x86_64 debug APK; current JavaScript served through
local Metro. Base commit `296135a`, with the changes in this PR. Debug APK SHA-256:
`4EED0BD682ED7AD7D548B3BF78A4B42FB2752A505084F29BD40B7F8F93AA8B06`.
The native binary hash is unchanged from the preceding build because this pass
changes JavaScript and test fixtures, not native code.

## Data and assertions

- Single: August 2026 holds INR 12,000 against INR 10,000 invested. No trend is
  drawn; the screen explains that two monthly snapshots are needed.
- Gap: May holds INR 10,000, July INR 13,000 and August INR 12,000. June is absent.
  Both charts leave the May-to-July segment blank and connect July to August.
- Zero: July and August hold zero. The portfolio line stays at zero; the asset
  section says there is no asset-class value. History omits its bar scale and
  does not present a calculated return against a zero invested baseline.
- Building: June's existing INR 12,000 snapshot stays visible while the real
  generation process awaits a deferred synthetic quote. "Finish synthetic
  fetch" is a QA control, not a product action. It releases the quote at INR
  1,500 for ten units, producing July and August at INR 15,000 each.
- Failure: unavailable synthetic quotes leave only June. Retry runs the actual
  generation path again without inventing July or August values.
- Empty: no portfolio history. The fixture omits real editing/navigation
  callbacks, so this capture does not prove the setup action's destination.

`e2e/visual/progress-edge-states.yaml` asserts exact August and June detail
values after generation, absent July/August records after failure, zero-value
detail, masking and hidden History scales. Component tests additionally verify
unchanged record arrays during review/masking and failed fetches, exact generated
values, actual retry attempts, isolated storage, and the release/token guard.

## Run notes

Initial flow attempts exposed test problems: an unquoted YAML expression,
scroll position before masking, expecting an asset chart for zero-only values,
and using an accessibility label rather than the native status-card test ID.
Retry also dismisses the status sheet, so the flow explicitly reopens it.
Those attempts are not passing runs. The development warning toast is dismissed
conditionally. Re-entering the same standalone fixture initially retained its
masked state; the chart flow now visits the empty fixture first to reset it.

Normal Standard and Minimal full flows passed before the final amount-width
correction. Their affected chart summaries were then recaptured on the final
source and fresh installed APK. The unchanged single, History, building, error
and empty layouts are represented by passing full or focused flows. A component-remount
experiment did not fix the clipping and was removed. Native bounds confirmed
that amount TextViews were too narrow; the final fix gives them available row
width. No passing screenshot claim relies on that rejected experiment.

## Limits

This is not a signed-preview, phone, TalkBack, performance or live-provider
result. The release-equivalent live font-scale transition and final tracker
disposition review remain separate. No schema, dependency, font or color token
changes were made.

## Verification result

The full Maestro flow passed in Standard and Minimal at both recorded display
configurations. Both large-text runs used the final source; the normal-text
amount summaries have final-source focused recaptures as detailed above. The
published review found no remaining clipped amount suffixes in those corrected
summaries. The large error sheet wraps into a narrow text column but remains
readable, with retry and close reachable.

`npm run test:v1:pc` passed on the final source: 191 suites, 2,023 tests,
typecheck, Expo Doctor 17/17, Android Doctor and strict installed-package smoke.
One suite and three tests remain skipped. The eight new route/fixture tests
cover the stated data outcomes and guards. The reports do not treat a native
text assertion as proof of visible glyphs; the clipped suffix was found by
inspecting the screenshots after the assertions passed.

All 35 published image links resolve. The emulator was restored to 1280x2856
and font scale 1.0, and the real Progress route reopened. Task-owned Metro and
its reverse-port forwarding were stopped. The isolated fixtures did not replace
saved portfolio records or display-mode preferences.

## Published captures

Large-text charts and their lower summaries need separate viewports.
[Standard lower summary](../reviews/artifacts/2026-10-03-progress-edge/large/standard-gap-summary.png)
and [Minimal lower summary](../reviews/artifacts/2026-10-03-progress-edge/large/minimal-gap-summary.png)
show the complete portfolio/invested amounts after scrolling.

| Configuration | Single month | Portfolio gap | Asset gap | Zero History | Masked History | Building | Failure | Empty |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| normal standard | [Image](../reviews/artifacts/2026-10-03-progress-edge/normal/standard-single-overview.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/normal/standard-gap-portfolio.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/normal/standard-gap-asset.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/normal/standard-zero-history.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/normal/standard-gap-masked.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/normal/standard-building.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/normal/standard-error.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/normal/standard-empty.png) |
| normal minimal | [Image](../reviews/artifacts/2026-10-03-progress-edge/normal/minimal-single-overview.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/normal/minimal-gap-portfolio.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/normal/minimal-gap-asset.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/normal/minimal-zero-history.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/normal/minimal-gap-masked.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/normal/minimal-building.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/normal/minimal-error.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/normal/minimal-empty.png) |
| large standard | [Image](../reviews/artifacts/2026-10-03-progress-edge/large/standard-single-overview.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/large/standard-gap-portfolio.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/large/standard-gap-asset.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/large/standard-zero-history.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/large/standard-gap-masked.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/large/standard-building.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/large/standard-error.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/large/standard-empty.png) |
| large minimal | [Image](../reviews/artifacts/2026-10-03-progress-edge/large/minimal-single-overview.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/large/minimal-gap-portfolio.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/large/minimal-gap-asset.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/large/minimal-zero-history.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/large/minimal-gap-masked.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/large/minimal-building.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/large/minimal-error.png) | [Image](../reviews/artifacts/2026-10-03-progress-edge/large/minimal-empty.png) |
