# Issue #132 V1 Screen Baseline Verification

## Scope

This note records the local verification evidence for issue #132: validating
the six accepted V1 screens against the research-preview screen contract using
the Android PC harness and seeded visual QA.

## Environment

- Branch: `v1/issue-132-screen-baseline-verification`
- Device: Pixel 8 Android Emulator, `emulator-5554`
- Package: `com.abdulshaikh.cogvest`
- Build: local release APK with `EXPO_PUBLIC_COGVEST_VISUAL_QA=1`
- No EAS cloud build was triggered.

## Evidence

Seeded visual QA completed successfully with:

```powershell
npm run visual-qa:android
```

Captured screenshots:

- `docs/testing/artifacts/visual-qa/latest/dashboard.png`
- `docs/testing/artifacts/visual-qa/latest/holdings.png`
- `docs/testing/artifacts/visual-qa/latest/add-holding-initial.png`
- `docs/testing/artifacts/visual-qa/latest/add-holding-lookup.png`
- `docs/testing/artifacts/visual-qa/latest/add-holding-review.png`
- `docs/testing/artifacts/visual-qa/latest/cash.png`
- `docs/testing/artifacts/visual-qa/latest/progress.png`
- `docs/testing/artifacts/visual-qa/latest/progress-assets-chart.png`
- `docs/testing/artifacts/visual-qa/latest/settings.png`

## Findings

- The seeded visual QA harness can capture the accepted V1 screen set.
- The app-owned Add Holding and Settings premium headers are preserved by
  hiding native stack headers for those routes.
- Settings is captured through the bottom-tab route so the screenshot reflects
  the real V1 user-facing tab screen.
- A dataset-quality drift remains: the current seed produces crypto-heavy and
  extreme Progress values rather than the calm research baseline.

## Follow-Up

Dataset drift is tracked separately in GitHub issue #153:

`[V1 QA] Rebalance visual QA seed data to match calm V1 baseline`

