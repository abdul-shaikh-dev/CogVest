# CogVest Code Review Findings

Date: 2026-05-06

Status: historical review snapshot. For current V1 Excel parity closeout
evidence, see `docs/testing/excel-parity-verification-2026-05-19.md`.

Review mode: current-state review against V1 MVP, issue #60 Excel parity, and
Android PC verification requirements.

## Findings

### Resolved / Re-verify: Android release APK touch navigation blocked E2E

- Evidence: `npm run maestro:test` fails in `e2e/navigation.yaml` after tapping
  `tab-holdings`; `holdings-screen` never becomes visible.
- Existing issue: #72.
- Later update: PR #78 addressed the Android navigation entrypoint issue and
  merged into `main`.
- Impact: re-run the Maestro navigation/core-flow suite before deciding whether
  any runtime blocker remains.

### Resolved: Asset metadata is too narrow for Excel parity

- Later update: #62 expanded V1 asset metadata for tracker parity and closed.

### Resolved: Debt is not first-class

- Later update: #63 added debt and crypto tracker parity and closed.

### Resolved: Monthly Progress is derived-current-month only

- Later update: #65 added monthly progression snapshots and closed.

### Resolved: Dashboard action icons appear interactive but have no behavior

- Later update: #75 was verified and closed after `DashboardScreen` wired
  value masking and quote refresh actions with test coverage.

### Resolved: Settings exposes unavailable or non-functional controls

- Later update: #83 aligned Settings rows with real controls, real status, and
  explicit V1-deferred states.

### Resolved: Route naming is inconsistent for Progress

- Later update: #76 normalized the tab route to `app/(tabs)/progress.tsx` and
  removed the duplicate root `app/progress.tsx` route.

### Resolved: Add Holding still stores trade-shaped records

- Later update: #61 and #79 implemented opening-position semantics and the
  multi-phase Add Holding flow.

### Resolved: Tests are broad but not enough for Excel parity

- Later update: #66 added `docs/testing/excel-parity-checklist.md`, and #60
  closeout evidence records the V1 PC gate.

## Recommended Priority

1. Merge the #60 closeout evidence PR if CI passes.
2. Re-run local release/APK verification before V1 dev-complete.
3. Keep V2/V3 issues as future placeholders until V1 closeout is accepted.
