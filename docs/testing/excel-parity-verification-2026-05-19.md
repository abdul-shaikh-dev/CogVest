# Excel Parity Verification Evidence

Date: 2026-05-19  
Branch: `v1/issue-60-excel-parity-closeout`  
Purpose: closeout evidence for #60, the V1 Excel tracker parity parent issue.

## Summary

V1 Excel tracker parity is represented by closed issues #61 through #66 and the
current V1 UI alignment issues #79 through #84. The app stores raw portfolio
records and derives portfolio views through domain functions, matching the #60
principle without recreating Excel as a spreadsheet UI.

This evidence file records the PC-only verification gate and maps every #60
gate question to the current app surface and automated evidence.

## GitHub Issue State

Closed V1 parity sub-issues:

- #61 Add opening positions for Excel-style holdings entry.
- #62 Expand asset metadata for Excel tracker fields.
- #63 Add debt and crypto tracker parity.
- #64 Build consolidated portfolio rollups and allocation details.
- #65 Add monthly progression snapshots.
- #66 Document and test Excel tracker parity gate.

Related closed V1 UI and verification issues:

- #79 Multi-phase Add Holding flow.
- #80 Dashboard Figma/Excel parity alignment.
- #81 Holdings interactions and filters.
- #82 Cash ledger alignment.
- #83 Settings local-first trust model.
- #84 Asset lookup and price autofill.
- #76 Progress route naming.

## PC Gate Evidence

Command:

```powershell
npm run test:v1:pc
```

Result: passed on rerun with elevated network permission.

Evidence:

- `npm run typecheck`: passed.
- `npm test`: passed, 32 suites and 140 tests.
- `npm run doctor`: passed, 17/17 checks.
- `npm run android:doctor`: passed; detected `emulator-5554`, Expo CLI via
  `npx`, required package scripts, and Maestro.
- `npm run android:smoke -- --strict`: passed; detected installed package
  `com.abdulshaikh.cogvest`.

First attempt note:

- The first `npm run test:v1:pc` attempt failed in Expo doctor because Expo API
  and React Native Directory checks hit sandbox network `EACCES`.
- The same command passed when rerun with network permission.

## Optional Maestro Evidence

Command:

```powershell
npm run maestro:test
```

Result: not used as a blocking parity gate in this closeout.

Observed result:

- Maestro launched the installed app on `Pixel_8`.
- The installed dev build showed React Native's `Unable to load script` screen
  because Metro was not running / no release JS bundle was packaged.
- This is an installed dev-build environment state, not evidence that the Excel
  parity data model or screens are missing.

Debug artifact:

```text
C:\Users\abdul\.maestro\tests\2026-05-19_221033
```

Follow-up rule:

- For future Maestro runs against a dev build, start Metro first.
- For release-style no-Metro E2E, install a local release/preview APK with a
  packaged JS bundle.

## Excel Parity Gate Questions

| #60 question | Current V1 answer | Automated evidence | Status |
| --- | --- | --- | --- |
| What do I own? | Holdings and Add Holding opening positions show stored assets and quantities. | `AddOpeningPositionForm.test.tsx`, `HoldingsScreen.test.tsx`, holdings domain tests. | Pass |
| How much did I invest? | Dashboard, Holdings, and Monthly Progress show invested values derived from raw records. | Dashboard, Holdings, Progress, and calculations tests. | Pass |
| What is it worth now? | Quote cache/manual prices feed current values in Dashboard and Holdings. | Quote service tests, Dashboard tests, Holdings tests. | Pass |
| What is my P&L and P&L %? | Portfolio and holding P&L/P&L % are derived and rendered. | Dashboard, Holdings, and calculations tests. | Pass |
| How is my portfolio allocated? | Dashboard and Holdings show allocation by asset class and holding rows. | Dashboard, Holdings, and allocation calculation tests. | Pass |
| How much is in equity, debt, crypto, and cash? | Asset metadata and allocation support equity, debt, crypto, and cash categories. | Asset metadata tests, debt/crypto quote tests, Holdings/Progress tests. | Pass |
| What changed this month? | Monthly Progress snapshots derive monthly gain and gain %. | `ProgressScreen.test.tsx`, monthly summary calculation tests, store persistence tests. | Pass |
| How much did I invest this month? | Monthly Progress snapshot and Cash Ledger metrics show monthly investment context. | Progress tests and Cash metrics tests. | Pass |
| What is my savings/investment rate? | Monthly Progress derives savings rate from monthly investment and salary; Cash Ledger derives monthly invested/added context. | Progress tests and Cash tests. | Pass |
| Can I continue daily tracking without opening Excel? | Add Holding, Holdings, Cash, Dashboard, Monthly Progress, Settings, live/manual quotes, and local persistence cover V1 daily tracking. | `npm run test:v1:pc` passed; strict installed-app smoke passed. | Pass |

## Non-Goals Verified

V1 closeout did not add:

- editable grid/table UI
- formula editor
- macro support
- Excel import/export
- advanced tax calculations
- Minimal Mode
- full behaviour insight engine
- complex historical charting beyond basic monthly progression
- backend, auth, cloud sync, analytics, or push notifications
- EAS cloud build or Play Store submission

## Closeout Decision

#60 is ready to close when this evidence PR is merged, because:

- All #60 sub-issues are closed.
- The V1 PC gate passes.
- Every #60 parity question has a current app answer and automated evidence.
- Optional Maestro failure is documented as a dev-build/Metro setup issue, not a
  missing parity capability.
