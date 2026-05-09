# V1 Core Flow Test Matrix

## Purpose

This matrix is the canonical V1 PC-only verification map. It replaces
physical-phone manual acceptance with repeatable checks that run on the
developer PC, Android Emulator, adb, Jest, React Native Testing Library, and
optional Maestro.

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
| Add Holding buy flow | `src/features/trades/__tests__/AddTradeForm.test.tsx` | `e2e/add-trade.yaml` uses stable form IDs and saves an opening/buy entry | Saved message or holding appears |
| Add Holding validation | `src/features/trades/__tests__/AddTradeForm.test.tsx`, `src/domain/validators/__tests__/trade.test.ts` | Optional Maestro follow-up for validation text | Invalid oversell and missing fields are rejected |
| Holdings derivation | `src/features/holdings/__tests__/HoldingsScreen.test.tsx`, `src/domain/calculations/__tests__/holdings.test.ts` | `e2e/holdings.yaml` asserts holdings after Add Holding | Holding row shows symbol, quantity, value |
| Quote refresh and fallback | `src/services/quotes/__tests__/quotes.test.ts`, `src/services/quotes/__tests__/useQuoteRefresh.test.tsx`, Holdings tests | Manual emulator pull-to-refresh or Refresh Quotes action where network is available | Failures keep manual prices visible |
| Cash tracking | `src/features/cash/__tests__/CashScreen.test.tsx`, `src/features/cash/__tests__/useCash.test.tsx` | `e2e/cash.yaml` adds cash by stable IDs | Cash balance and cash history update |
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

## Defect Logging

Every failed core flow must become a GitHub issue with:

- Title beginning with `[V1 QA]`.
- Environment: OS, emulator name, Android version, app package, APK source.
- Repro steps.
- Expected result.
- Actual result.
- Evidence: screenshot, UI tree, logcat excerpt, or test output.
- Link to the failed matrix row.

## Uncovered Or Manual-Only Items

These items are intentionally not default PR CI:

- Android Emulator launch and installed APK checks.
- Maestro flows.
- Local APK build/install.
- Any EAS preview or production build.

If a V1 feature cannot be covered by Jest, RNTL, adb, or Maestro, create a
follow-up issue and link it from this matrix.
