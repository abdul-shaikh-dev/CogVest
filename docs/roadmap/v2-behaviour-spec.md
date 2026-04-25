# CogVest V2 Behaviour Spec

## Goal

Layer behaviour-aware investing feedback and Minimal Mode onto the stable V1 tracker.

## Target User Value

The user sees patterns in conviction, patience, trading frequency, and tax-relevant holding duration while using a calmer Minimal Mode when desired.

## Included Features

- Minimal Mode across Dashboard, Holdings, Add Trade, Cash, Settings, and History/Asset Detail if present.
- Improved conviction analytics.
- Patience analysis using intended hold periods.
- Trade frequency analysis.
- Behaviour insight cards and insight detail screen.
- Basic LTCG tracker for Indian stocks/ETFs.
- Settings for display mode and Minimal Mode preferences.
- Onboarding nudges for behaviour metadata.

## Explicitly Excluded Features

- Historical charts.
- Advanced asset search.
- Advanced FIFO multi-lot LTCG.
- Import/export.
- Automatic Play Store submission.

## Screens Included

- Dashboard with behaviour insight card.
- Insight detail.
- Settings with Minimal Mode preferences.
- Holdings with basic LTCG states.
- Add Trade with intended hold period.
- History or Asset Detail if V1 deferred them.

## Data Model Changes

- Persist optional intended hold values on trades.
- Persist display mode and Minimal Mode preferences.
- Persist insight dismissal metadata if implemented.
- Keep all insight outputs derived.

## Domain Calculations Required

- `analyseConviction`
- `analysePatienceFromSells`
- `analyseTradeFrequency`
- `generateInsights`
- `calculateBasicLtcgStatus`

## Acceptance Criteria

- Minimal Mode hides daily noise without removing core actions.
- Behaviour fields remain optional.
- Insights never sound scolding.
- Basic LTCG appears only for Indian stocks/ETFs.
- V1 persisted data remains compatible.

## Test Plan

- Unit tests for conviction, patience, frequency, insight generation, and basic LTCG.
- Component tests for Minimal Mode rendering and insight cards.
- Manual tests for mode switching and data compatibility.

## Manual QA Checklist

- Switch Standard/Minimal Mode.
- Confirm Add Trade still works in Minimal Mode.
- Add intended hold period and later sell to test patience analysis.
- Add enough rated trades for conviction insight.
- Verify LTCG hidden for crypto and visible for Indian stock/ETF.

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
