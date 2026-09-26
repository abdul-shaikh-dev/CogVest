# Add Holding discovery verification

Issue #412. Screenshots and emulator records use synthetic QA data only.

## Installed build

- Fresh `EXPO_OFFLINE=1 npm run android:apk:emulator` build, installed with
  `adb install -r`. Debug APK with current branch JavaScript served by restarted
  Metro, not a bundled-release test. No EAS build or physical-phone operation.
- APK SHA-256: `D383C9506E2FEC2CAB6A6A60EBA5D9098DADF61DED478932DE63544E13CE3F2A`.
- Pixel_10_Pro / emulator-5554, API 36, x86_64. Default 1280x2856 / 480 dpi
  (about 427dp), font scale 1.0. Narrow: 1080x2400 / 480 dpi (360dp), font 1.3.
- Restored the default display size and font scale after narrow-screen checks.

## Scope and review

Search leads the discovery phase with compact accessible progress and one active
filter value. Saved and provider rows lead with the full name, followed by
instrument, venue, identifiers and currency. Provider source and explicit
Select/Use actions remain visible. Only identical symbol/ticker text is deduplicated.

No controller, financial calculation, persistence, provider lookup, ranking or
filtering behavior changed. Later phases retain their existing navigation and
financial review safeguards. The optional compact selection field leaves other
callers unchanged.

The visual correction pass replaced independently wrapping identity badges with
one naturally wrapping text line, avoiding awkward exchange-label breaks.

## Verification

- `npm run test:v1:pc`: passed, including typecheck, 167 suites / 1,767 tests,
  Expo Doctor 17/17, Android Doctor and strict installed-package smoke. The
  existing one skipped suite / three skipped tests remain unchanged.
- Default-size discovery and fallback Maestro journeys passed: filter empty
  state, manual entry, keyboard, saved fund and provider identities, explicit
  BSE selection, recent searches, history clearing, lookup failure and retry.
  Selection asserts 500 synthetic assets and zero openings, not only navigation.
- Unit tests cover progress semantics, the single active filter, long names,
  identifier deduplication and explicit selection callbacks.
- `e2e/add-holding-manual-semantics.yaml`: passed after restoring normal display.
  Saved one holding with zero duplicates, quantity 2, average cost INR 1,200,
  invested INR 2,400 and current value INR 2,600. Identity, classification,
  currency, missing provider quote, unknown date, note and INR 1,300 manual
  price matched the stored-data assertions.
- The discovery and fallback journeys also passed at 360dp / 130% text,
  including readable long names, instrument/venue identity and BSE selection.
- Owned-diff review and `git diff --check` passed. Review checked optional
  compact-field isolation, touch targets, accessible progress, retained identity
  and unchanged later-phase safeguards.
- Spoken TalkBack output was not independently recorded. No complete
  screen-reader audit, release-bundle, external-provider or performance claim.
- Legacy discovery flows were updated for combined native Text identity lines;
  the stress/performance flow was not rerun for this presentation-only change.

## Visual evidence

Evidence uses the production form. The asset-search QA route adds a fixed
diagnostics header and memory-only fixtures; that header is not production UI.
Initial enlarged-text automation swiped over that header rather than the form.
Bounded swipes within the lower form area target the actual scroll container.

| Surface | Evidence |
| --- | --- |
| Before | [Original discovery](artifacts/2026-09-26-add-holding-discovery/before.png) |
| After, default size | [Discovery](artifacts/2026-09-26-add-holding-discovery/default-discovery.png) |
| Provider identity | [NSE, BSE, ETF and crypto](artifacts/2026-09-26-add-holding-discovery/default-listings.png) |
| 360dp / 130% | [Discovery](artifacts/2026-09-26-add-holding-discovery/narrow-discovery.png) |
| Keyboard, 360dp / 130% | [Search remains visible](artifacts/2026-09-26-add-holding-discovery/narrow-keyboard.png) |
| Long saved fund | [Full identity and Use](artifacts/2026-09-26-add-holding-discovery/narrow-saved-fund.png) |
| Long provider name | [ETF and crypto distinction](artifacts/2026-09-26-add-holding-discovery/narrow-crypto.png) |
| Recent searches | [Expanded disclosure](artifacts/2026-09-26-add-holding-discovery/narrow-recent.png) |
| Provider failure | [Retry and manual fallback](artifacts/2026-09-26-add-holding-discovery/narrow-failure.png) |

The compact toolbar wraps at enlarged text rather than clipping. Long names,
instrument/venue labels and selection actions remain readable. The search input
stays above the docked keyboard. No production row uses ellipsis to hide identity.
