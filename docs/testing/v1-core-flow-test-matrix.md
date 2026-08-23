# V1 Core Flow Test Matrix

## Purpose

This matrix is the canonical V1 PC-only verification map. It replaces
physical-phone manual acceptance with repeatable checks that run on the
developer PC, Android Emulator, adb, Jest, React Native Testing Library, and
optional Maestro.

Excel tracker parity is verified through
`docs/testing/excel-parity-checklist.md`. V1 core-flow verification is not
complete until that checklist passes or failed rows have linked defects.

Default PR CI must stay lightweight. Emulator, APK install, and Maestro checks
are local verification gates, not required pull-request checks.

## Required PC Gate

Run before marking V1 core flows verified:

```powershell
npm run test:v1:pc
```

This runs:

```powershell
npm run typecheck
npm test
npm run doctor
npm run android:doctor
npm run android:smoke -- --strict
```

If the installed Android app needs to be refreshed locally, build and install a
local APK from this machine. Do not run EAS cloud builds unless explicitly
approved.

## Feature Matrix

| V1 feature | Primary verification | Emulator / E2E coverage | Evidence |
| --- | --- | --- | --- |
| Cold launch | `src/__tests__/rootRoute.test.ts` | `e2e/smoke-launch.yaml` launches `com.abdulshaikh.cogvest` and asserts `dashboard-screen` | UI tree or Maestro output shows Dashboard, not Unmatched Route |
| Dashboard empty state | `src/features/dashboard/__tests__/DashboardScreen.test.tsx` | `e2e/smoke-launch.yaml` asserts `dashboard-screen` and tab labels | Dashboard shows portfolio value and Add Holding path |
| Quick Portfolio Setup | Quick Setup session/screen/route tests, Add Opening Position duplicate tests, and `src/testing/__tests__/e2eEvidence.test.ts` | `e2e/quick-portfolio-setup.yaml` proves two explicit provider selections, immediate saves, restart recovery, known and unknown dates, provider failure/manual fallback, pending valuation, dedicated PPF, final review, and Dashboard completion | `docs/testing/quick-portfolio-setup-evidence.md` records the fresh APK, exact derived totals, zero duplicates, screenshots, and deterministic-provider limitation |
| Holdings CSV onboarding | CSV parser, import planner/screen/route tests, and atomic batch store tests | `e2e/holdings-csv-import.yaml` selects a pushed UTF-8 template through Android DocumentsUI, resolves rows, confirms one atomic import, and verifies Dashboard totals | `docs/onboarding/holdings-csv-import.md` defines the format; fresh APK Maestro output and screenshots prove picker and installed-app behavior |
| Transaction history CSV onboarding | `src/domain/__tests__/transactionCsv.test.ts`, `src/features/transactionImport/__tests__/transactionImport.test.ts`, `src/store/__tests__/transactionImportStore.test.ts`, reconciliation tests, and schema/migration tests prove Supplemental/Full history, retry/conflict, ordering, cutover, and rollback behavior | `e2e/transactions-csv-import.yaml` selects a representative multi-year file through Android DocumentsUI, reviews an exact Full history replacement, confirms persistence, and asserts imported transactions, derived holdings, and unchanged Cash Ledger counts | `docs/onboarding/transaction-csv-import.md` defines the broker-neutral format and cutover rules; a fresh local APK is required for installed-app evidence |
| Add Holding opening-position flow | `src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx`, `src/features/openingPositions/__tests__/useAddOpeningPosition.test.tsx`, `src/testing/__tests__/e2eEvidence.test.ts` | `e2e/add-holding-lookup.yaml`, `e2e/add-holding-manual-semantics.yaml`, `e2e/add-holding-pending-valuation.yaml`, and `e2e/add-holding-edited-quote.yaml` assert persisted lookup/manual paths, provider failure, pending valuation, and later manual resolution | Read-only evidence asserts identity, class, currency, exchange/provider ID, quote provenance, invested/current values, position count, and zero canonical conflicts; Dashboard confirms the resolved aggregate; success copy alone is insufficient |
| Add Holding validation | `src/features/openingPositions/__tests__/openingPositionForm.test.ts`, Add Holding component/controller tests | `e2e/add-holding-asset-switch.yaml` proves stale position fields are rejected/reset after changing assets; lookup flow proves repeated provider selection reuses one canonical asset | Missing fields, impossible/future dates, stale selection state, duplicate saves, and unsupported currency behavior are rejected |
| Holdings derivation | `src/features/holdings/__tests__/HoldingsScreen.test.tsx`, `src/domain/calculations/__tests__/holdings.test.ts` | `e2e/holdings.yaml` asserts holdings after Add Holding | Holding row shows symbol, quantity, value |
| PPF account and confirmed ledger | `src/domain/ppf/__tests__`, `src/features/ppf/__tests__`, schema/store tests, Dashboard/Holdings integration tests | `e2e/ppf-account.yaml` creates a confirmed baseline and verifies the dedicated Holdings account value | Confirmed PPF value enters Debt/invested totals; estimated interest stays separate; contribution, correction/deletion, and invalid timeline paths are covered deterministically by Jest |
| Quote refresh and fallback | `src/services/quotes/__tests__/quotes.test.ts`, `src/services/quotes/__tests__/useQuoteRefresh.test.tsx`, Holdings tests | Manual emulator pull-to-refresh or Refresh Quotes action where network is available | Failures keep manual prices visible |
| Cash tracking | `src/features/cash/__tests__/CashScreen.test.tsx`, `src/features/cash/__tests__/useCash.test.tsx` | `e2e/cash.yaml` adds cash by stable IDs | Cash balance and cash history update |
| Monthly Progress snapshots | `src/features/progress/__tests__/ProgressScreen.test.tsx`, `src/features/progress/__tests__/useProgress.test.tsx`, `src/domain/calculations/__tests__/monthEndSnapshots.test.ts`, `src/store/__tests__/portfolioStore.test.ts` | Manual emulator flow opens Progress after seeded portfolio data and verifies the compact month-end snapshot status | Missing previous-month snapshot is generated automatically; review/edit stays available in the dedicated `Review Snapshot` screen; Progress shows monthly gain, investment, savings rate where derivable, and asset split |
| Excel parity gate | `docs/testing/excel-parity-checklist.md` and linked feature tests | Manual PC-only flow in the checklist | Every parity question passes or has a `[V1 QA]` defect |
| Value masking | `src/features/settings/__tests__/SettingsScreen.test.tsx`, dashboard/holdings/cash masked-value tests | `e2e/value-masking.yaml` opens `cogvest://settings` and toggles `value-mask-toggle` | Wealth values mask; quantities and percentages remain visible |
| Persistence after close/reopen | `src/store/__tests__/portfolioStore.test.ts`, storage tests | `e2e/persistence.yaml` saves data, stops app, relaunches, and verifies data remains | State remains after app restart |
| No backend/auth/cloud | Smoke tests and release review | Manual repo inspection before release | No backend, auth, analytics, cloud sync, or push notification feature is added |

## Optional Maestro Command Set

Install Maestro separately if needed. The repo does not add Maestro as a npm
dependency.

```powershell
npm run maestro:check
npm run maestro:test
```

To run one flow:

```powershell
npm run maestro:test -- e2e/smoke-launch.yaml
```

If Maestro is unavailable, record that as:

```text
Maestro E2E not run: Maestro unavailable.
```

## Monthly Progress Snapshot Verification

- Open Progress after seeded portfolio data exists.
- Verify the missing previous completed month snapshot is generated automatically.
- Verify Progress shows the compact `Month-end snapshot` status card by default.
- Verify `Review snapshot` opens the dedicated Review Snapshot screen for correction/manual override.
- Verify generated snapshots update Progress charts after enough monthly history exists.
- Verify fallback/status text appears when historical provider lookup is unavailable and the app uses latest local or manual prices.

## Defect Logging

Every failed core flow must become a GitHub issue with:

- Title beginning with `[V1 QA]`.
- Environment: OS, emulator name, Android version, app package, APK source.
- Repro steps.
- Expected result.
- Actual result.
- Evidence: screenshot, UI tree, logcat excerpt, or test output.
- Link to the failed matrix row.
- Link to the failed `docs/testing/excel-parity-checklist.md` row if the
  defect blocks Excel parity.

## Uncovered Or Manual-Only Items

These items are intentionally not default PR CI:

- Android Emulator launch and installed APK checks.
- Maestro flows.
- Local APK build/install.
- Any EAS preview or production build.

If a V1 feature cannot be covered by Jest, RNTL, adb, or Maestro, create a
follow-up issue and link it from this matrix.
