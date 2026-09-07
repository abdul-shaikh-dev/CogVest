# CogVest V2 Behaviour Spec

## Goal

Layer behaviour-aware investing feedback and Minimal Mode onto the stable V1 tracker.

## Target User Value

The user sees patterns in conviction, patience, trading frequency, and tax-relevant holding duration while using a calmer Minimal Mode when desired.

## Included Features

- Minimal Mode across Dashboard, Holdings, Add Holding, Progress, Cash, Settings, and Asset Detail if present.
- Improved conviction analytics.
- Patience analysis using intended hold periods.
- Trade frequency analysis.
- Behaviour insight cards and insight detail screen.
- Informational holding-duration reference with unavailable states for ambiguous instruments/history (#20).
- Settings for display mode and Minimal Mode preferences.
- Onboarding nudges for behaviour metadata.

## Explicitly Excluded Features

- Advanced per-asset market-price history.
- Advanced asset search.
- Advanced FIFO multi-lot LTCG.
- Import/export.
- Automatic Play Store submission.

## Screens Included

- Dashboard with behaviour insight card.
- Insight detail.
- Settings with Minimal Mode preferences.
- Holdings secondary analysis links to Holding duration; no tax badges on position rows.
- Add Holding with intended hold period.
- Progress or Asset Detail if V1 deferred them.

## Data Model Changes

### Insight Detail Contract (#19)

Dashboard's Investment patterns section opens conviction, planned holding-period,
and trading-frequency details. Each detail shows its observation period,
contributing counts, optional progressively revealed records, methodology, and
limitations. Insufficient history explains the threshold without encouraging
transactions or requiring optional ratings. All evidence is derived from current
records, including corrections and deletions; route parameters carry only the
insight kind, never a cached result.

Value masking hides summaries, periods, counts, and supporting records. Minimal
Mode hides the Dashboard entries and suppresses details reached by a direct link.
Back and Done close the detail, with Dashboard as the no-history fallback.
Unknown insight links provide the same safe exit. The engine exposes no dismissal
state, so persistent per-insight dismissal is not implemented and no schema is
added. These observations are descriptive, not financial or tax advice.

- Persist optional intended hold values on trades.
- Persist display mode and Minimal Mode preferences.
- Persist insight dismissal metadata if implemented.
- Keep all insight outputs derived.

## Domain Calculations Required

- `analyseConviction`
- `analysePatienceFromSells`
- `analyseTradeFrequency`
- `generateInsights`
- `getHoldingDuration` (informational; never returns tax eligibility)

## Acceptance Criteria

- Minimal Mode hides daily noise without removing core actions.
- Behaviour fields remain optional.
- Insights never sound scolding.
- Duration comparison is limited to explicitly classified INR stocks listed on NSE/BSE, with one dated acquisition and no disposals/transfers or aggregate opening cutover. ETFs remain unavailable without reliable fund classification; the legacy `isTaxEligible` flag is not evidence.
- V1 persisted data remains compatible.

## Test Plan

- Unit tests for conviction, patience, frequency, insight generation, and basic LTCG.
- Component tests for Minimal Mode rendering and insight cards.
- Manual tests for mode switching and data compatibility.

## Manual QA Checklist

- Switch Standard/Minimal Mode.
- Confirm Add Holding still works in Minimal Mode.
- Add intended hold period and later sell to test patience analysis.
- Add enough rated trades for conviction insight.
- Verify no tax labels on crypto/debt/foreign assets, and explicit unavailable results for ETFs, unknown instruments and ambiguous histories.

## Definition of Done

- V1 release gate still passes.
- V2 behaviour and Minimal Mode test coverage passes.
- Existing V1 local data opens without destructive reset.

## Release Gate

- V1 gate still passes.
- Minimal Mode works across supported screens.
- Behaviour insights render and can be dismissed or navigated.
- Patience/frequency/basic LTCG have tests.

## Release/Build Requirements

- Preview APK generated for V2 validation.
- Production AAB optional unless V2 is a store release.

## Local Data/Versioning Impact

Adds optional persisted preferences and optional trade metadata. Migration should default missing fields safely.

## Privacy/Security Notes

Behaviour metadata never leaves the device. Quote APIs still receive only identifiers.

## Known Risks/Deferred Decisions

- Insight thresholds may need tuning after V1 data exists.
- Basic LTCG may need clearer disclaimers before production release.
