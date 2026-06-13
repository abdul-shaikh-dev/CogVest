# Issue #110 V1 UI Parity QA

Issue: https://github.com/abdul-shaikh-dev/CogVest/issues/110

## Baseline

- `docs/design/v1-screen-baseline.md`
- `docs/design/v1-research-preview/index.html`
- `docs/design/v1-ux-research-baseline.md`
- `docs/design/figma/issue-69-v1-screens/code.js`

## Commands

| Command | Result | Notes |
| --- | --- | --- |
| `npm run test:verify` | Partial pass, doctor blocked by sandbox network | TypeScript and Jest passed: 36 suites, 149 tests. Expo doctor failed inside the sandbox because Expo API network access was blocked. |
| `npm run doctor` | Pass | Rerun with network access: 17/17 Expo doctor checks passed. |
| `.\android\gradlew.bat -p android :app:assembleDebug` | Pass | Built `android/app/build/outputs/apk/debug/app-debug.apk`, but emulator install failed due insufficient emulator storage. |
| `.\android\gradlew.bat -p android :app:assembleRelease` | Pass | Built installable bundled APK at `android/app/build/outputs/apk/release/app-release.apk`; copied to `G:\tmp\cogvest-current-release.apk`. |
| `adb -s emulator-5554 install -r android\app\build\outputs\apk\release\app-release.apk` | Pass | Fresh install timestamp: `2026-05-28 23:56:30`; package `com.abdulshaikh.cogvest`, version `1.0.0`, versionCode `1`. |
| `npm run android:doctor` | Pass | Emulator `emulator-5554` detected; all package scripts present; Maestro found. |
| `npm run android:smoke -- --strict` | Pass | App package found on emulator. |
| `npm run maestro:check` | Pass | Java, adb, emulator, Maestro `2.5.1`, and app package found. |
| `npm run maestro:test` | Pass | All flows passed after updating stale lookup flow: smoke-launch, navigation, add-trade/manual Add Holding, add-holding-lookup, holdings, cash, value-masking, persistence. |
| `rg -n "ScreenHeader\|HeroMetric\|MetricGroup\|SectionHeader\|EmptyState\|testID\|Add Holding\|Monthly Progress\|Clear local data\|Deferred\|auto\|Select\|portfolioSeries\|assetSeries\|cashValue\|manual fallback\|quote" src/features src/components/cards app docs/design/v1-screen-baseline.md` | Pass | Static scan confirmed implemented screen structure, V1 labels, explicit lookup selection copy/tests, deferred Settings copy, quote/manual fallback copy, and Progress chart series wiring. |

## Screen Review

| Screen | Status | Evidence | Drift / Fix |
| --- | --- | --- | --- |
| Dashboard | Pass | `src/features/dashboard/DashboardScreen.tsx` includes `dashboard-screen`, local portfolio header, mask/refresh actions, `Portfolio Value` hero, invested/P&L/P&L %, allocation, monthly context, quote status, conviction guidance, and Add Holding action copy. | No code drift found in static review. `add-trade-button` remains as a legacy testID only; visible copy is Add Holding. |
| Holdings | Pass | `src/features/holdings/HoldingsScreen.tsx` includes `holdings-screen`, header Add Holding action, search, mask toggle, filters, quote refresh/status, and `HoldingCard`. `src/components/cards/HoldingCard.tsx` shows current value, P&L, P&L %, quantity, invested value, initial allocation, average cost, current price, allocation, and quote freshness. | No code drift found in static review. |
| Add Holding | Pass | `src/features/openingPositions/AddOpeningPositionForm.tsx` implements asset/class/position/review phases, lookup results with visible `Select`, manual fallback fields, classification, position details, optional conviction/note, derived preview, and save. | No code drift found in static review. |
| Monthly Progress | Pass | `src/features/progress/ProgressScreen.tsx` includes `Monthly Progress`, snapshot entry, no-snapshot empty state, portfolio vs invested chart, assets vs months chart, asset class snapshot, recent snapshots, and snapshot form fields. | No code drift found in static review. |
| Cash Ledger | Pass | `src/features/cash/CashScreen.tsx` includes `Cash Ledger`, balance hero, added/invested/available/savings metrics, deposit/withdrawal/investment transfer modes, entry form, and empty/recent ledger states. | No code drift found in static review. |
| Settings | Pass | `src/features/settings/SettingsScreen.tsx` includes local-first privacy rows, value masking toggle, quote/provider/manual fallback status, currency/app info rows, and destructive Clear local data marked `Deferred`. | No code drift found in static review. Unsupported destructive data action is clearly disabled/deferred. |

Emulator screenshot evidence:

- `docs/testing/artifacts/issue-110/fresh-release-dashboard.png` shows the fresh
  release APK launched to Dashboard with no Unmatched Route.

## State Review

| State | Status | Evidence | Drift / Fix |
| --- | --- | --- | --- |
| Empty portfolio | Pass | `src/features/dashboard/__tests__/DashboardScreen.test.tsx` and `src/features/holdings/__tests__/HoldingsScreen.test.tsx` cover empty Dashboard/Holdings states with Add Holding actions. | No code drift found in static review. |
| Empty cash ledger | Pass | `src/features/cash/CashScreen.tsx` renders `No cash entries yet`; covered by Cash screen tests. | No code drift found in static review. |
| No monthly snapshots | Pass | `src/features/progress/__tests__/ProgressScreen.test.tsx` covers `No monthly snapshots yet`. | No code drift found in static review. |
| Quote lookup selection | Pass | `src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx` covers selected lookup autofill and no autofill before explicit selection. | No code drift found in static review. |
| Manual quote fallback/provider error | Pass | Add Holding tests cover failed lookup quote leaving manual current price empty; Dashboard/Holdings/Settings include manual fallback copy/status. | No code drift found in static review. |
| Value masking | Pass | Dashboard, Holdings, Cash, and Settings screens expose value masking; common masked value behavior is covered in `src/components/common/__tests__/commonComponents.test.tsx`. | No code drift found in static review. |

## Accepted V1 Compromises

- Legacy internal names remain in non-visible implementation details:
  `app/(tabs)/add-trade.tsx`, `src/features/trades`, and some test IDs such as
  `add-trade-button`. User-facing copy and route title use Add Holding, and the
  tab is hidden with `href: null`.
- Static review confirms contract parity, but live visual/pixel parity still
  requires emulator inspection in this issue.

## Follow-Ups

- The debug APK is large (`251,804,946` bytes) and failed to install on the
  emulator due insufficient storage. The release APK (`130,984,824` bytes)
  installed successfully and is the recommended local install artifact for
  device/emulator smoke testing.
- `e2e/add-holding-lookup.yaml` was stale. It expected the Continue button
  immediately after search results appeared. It now taps `Select` first, which
  matches the accepted explicit-selection Add Holding contract.
