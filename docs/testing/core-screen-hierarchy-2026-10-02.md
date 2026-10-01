# Core screen hierarchy: 2 October 2026

Follow-up: the Futures draft blocker recorded below was resolved in the
[standalone verification](futures-post-export-verification-2026-10-02.md).
This document retains the original debug-run results and limitations.

## Scope

Incremental presentation pass following the Holdings direction: open routine
sections, clearer financial hierarchy, fewer redundant subtitles, tabular money
values, and flat Cash ledger rows. Dashboard, Progress, Cash, Settings, PPF,
Futures, asset management, insights, setup, imports, and transaction surfaces
share the treatment. Existing navigation, asset names, accounting, masking,
warnings, input validation, and confirmation behavior are unchanged.

This branch starts from `f88ee98` and is independent of Holdings PR #467. It does
not reintroduce the reverted asset-name shortening experiment. It is not a
redesign of every form or dialog; decision and warning cards remain contained.

## Environment

- Fresh locally built x86_64 debug APK, installed with the existing local QA key.
- `npm run android:apk:emulator`, then install of `.expo/core-screen-qa.apk`.
- APK SHA-256: `F1BB34DB1F0C39747E0733541B39225EF231DAB72C874E1BCA6411B6E75AF701`.
- Current task JavaScript served by Metro on port 8081. This is native debug
  verification, **not a standalone release APK or performance measurement**.
- AVD `CogVest_Perf`, emulator-5554, Android API 36, density 480.
- Normal: 1280 x 2856, font scale 1.0.
- Narrow/enlarged: 1080 x 2400 (360 dp wide), font scale 1.3.
- Synthetic developer seed and disposable PPF/Futures data only. Seeded history
  may be extended by the app's normal background process; screenshots validate
  layout, not reconciliation against a real statement.
- Display overrides restored to normal after the enlarged-text run.

## Verification

- `npm run test:v1:pc`: passed, including Android doctor and strict package smoke.
- After the chart-background correction, `npm run test:verify`: passed, 185
  suites / 1,904 tests; 1 suite / 3 tests remain skipped. Expo doctor: 17/17.
- `e2e/visual/final-primary-tabs.yaml`: passed empty/populated tabs and actual
  masking assertions, then restored masking off.
- `e2e/visual/final-secondary-screens.yaml`: passed holding quantity/price,
  asset management, review, import-source/help, backup-warning, and history checks.
- `maestro test -e SHOT=normal e2e/visual/core-screen-hierarchy.yaml`: passed.
- Same capture flow with `SHOT=large` at the narrow/enlarged configuration: passed.
- `e2e/ppf-account.yaml`: passed account validation, saved INR 100,000 balance,
  retained/discarded draft handling, and reopening with the same balance.
- `e2e/futures-manual-wallet.yaml`: wallet creation, execution, fee deduction to
  999 USDT, and correction to quantity 1 / entry 120 USDT passed. The complete
  flow did **not** pass: Android's picker started at its forbidden storage root.
  Added a conditional Documents selection, accepting either apostrophe form in
  the system message. A continuation using the same synthetic account confirmed
  export succeeds, but stopped when the delete-wallet confirmation did not
  appear. Restore/relaunch assertions were not reached. This is an unresolved
  extended-journey verification gap, not a claimed restore pass.
  A separate restart-and-open check displayed the confirmation and Cancel
  worked. The immediate post-export path still failed after adding a scroll
  settle wait. Its cause is not established; this PR remains draft rather than
  treating that failure as proven environmental or a completed release gate.
- E2E inventory/evidence tests: 2 suites / 5 tests passed.
- `e2e/visual/core-futures-summary.yaml`: passed after adding startup readiness;
  reviewed the populated wallet capture with 999 USDT and the corrected position.

The initial Settings unit-test assertion expected a deliberately removed
subtitle; corrected to assert it is absent. The first capture attempt inherited
an open Monthly History sheet from the preceding flow. The new capture harness
restarts without clearing data and waits for transitions. It then passed in both
configurations. No application navigation fix was necessary for that harness
failure.

The Futures capture helper also initially opened a link before startup completed.
Added a Dashboard readiness wait to both new capture flows.

## Visual review and correction

Reviewed native Dashboard, Cash, Settings, Progress, import, transaction-history,
insight, asset-management, and PPF surfaces. Larger text preserves readable
amounts and stacks Cash rows. Financial scope, stale-price notices, selected
source controls, and primary actions remain visible or reachable by scrolling.

The first Progress capture exposed a card-coloured rectangle inside the new
open chart section. Corrected the chart surface to transparent and recaptured.
Two earlier secondary captures were mid-transition; the settled captures below
replace those as evidence. Historical evidence files were not modified.

| Surface | Normal | Narrow, 130% text |
| --- | --- | --- |
| Dashboard | [Image](artifacts/core-screen-hierarchy-2026-10-02/normal/dashboard.png) | [Image](artifacts/core-screen-hierarchy-2026-10-02/large/dashboard.png) |
| Cash | [Image](artifacts/core-screen-hierarchy-2026-10-02/normal/cash.png) | [Image](artifacts/core-screen-hierarchy-2026-10-02/large/cash.png) |
| Settings | [Image](artifacts/core-screen-hierarchy-2026-10-02/normal/settings.png) | [Image](artifacts/core-screen-hierarchy-2026-10-02/large/settings.png) |
| Progress chart | [Image](artifacts/core-screen-hierarchy-2026-10-02/normal/progress.png) | [Image](artifacts/core-screen-hierarchy-2026-10-02/large/progress.png) |
| Import source | [Image](artifacts/core-screen-hierarchy-2026-10-02/normal/import.png) | [Image](artifacts/core-screen-hierarchy-2026-10-02/large/import.png) |
| Transaction history, empty | [Image](artifacts/core-screen-hierarchy-2026-10-02/normal/holding-records.png) | [Image](artifacts/core-screen-hierarchy-2026-10-02/large/holding-records.png) |
| Insight | [Image](artifacts/core-screen-hierarchy-2026-10-02/normal/insight.png) | [Image](artifacts/core-screen-hierarchy-2026-10-02/large/insight.png) |
| PPF account | [Image](artifacts/core-screen-hierarchy-2026-10-02/normal/ppf.png) | Not recaptured in this pass |
| Futures wallet | [Image](artifacts/core-screen-hierarchy-2026-10-02/normal/futures-wallet.png) | Not recaptured in this pass |

## Limits

Not a claim that every data/error state, physical device, TalkBack interaction,
or release-build rendering was inspected. Real CAS/tradebook files were not
reimported in this presentation-only pass. Larger-text captures cover the listed
surfaces, not every scroll position. No financial model, provider, persistence,
or performance change is included.
