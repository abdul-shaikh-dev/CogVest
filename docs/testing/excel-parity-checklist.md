# Excel Parity Checklist

## Purpose

This is the V1 Excel tracker parity gate. V1 is not dev-complete until this
checklist passes or every failed row has a linked defect.

CogVest should replace the useful tracking concepts from `Portfolio.xlsm`
without recreating Excel as a spreadsheet UI. The app should stay mobile-first,
calm, local-first, and aligned with `DESIGN.md`.

## Product Principle

Excel stores rows and formulas.

CogVest should store user-entered records and derive portfolio views from
domain functions.

Persist:
- holdings/opening positions
- transactions
- cash entries
- monthly snapshots
- quote/manual price records

Derive:
- invested value
- current value
- P&L
- P&L %
- allocation
- total investment
- total current value
- monthly progression summaries

## Non-Goals

V1 parity must not recreate Excel as a spreadsheet UI.

Do not add:
- editable grid/table UI
- formula editor
- macro support
- Excel import/export
- advanced tax calculations
- Minimal Mode
- full behaviour insight engine
- complex historical charting beyond basic monthly progression

## Workbook-To-App Map

| Excel tracker capability | CogVest V1 feature | Issue slice | Automated coverage | PC verification |
| --- | --- | --- | --- | --- |
| Opening positions / holdings inventory | Add Holding opening-position records | #61 | `src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx`, `src/domain/calculations/__tests__/holdings.test.ts` | Add an opening position on emulator; Holdings shows quantity, invested value, current value, and P&L. |
| Asset metadata | Asset class, instrument type, sector type, quote source metadata | #62 | `src/domain/assets/__tests__/metadata.test.ts`, store migration tests | Add or inspect equity, debt, crypto, and cash-like records; metadata appears without spreadsheet columns. |
| Debt / liquid / cash-like instruments | Debt and manual-price asset support | #63 | `src/services/quotes/__tests__/quotes.test.ts`, holdings calculation tests | Add a manual debt/liquid holding; app keeps manual price fallback and allocation. |
| Consolidated `All` view | Dashboard/Holdings rollups and allocation details | #64 | dashboard, holdings, and calculation tests | Dashboard and Holdings answer invested/current/P&L/allocation without a grid. |
| Monthly `Progression` sheet | Monthly Progress snapshots | #65 | `src/features/progress/__tests__/ProgressScreen.test.tsx`, store persistence tests | Record two monthly snapshots; Progress shows gain, gain %, investment, savings rate, and asset split. |
| Daily cash tracking | Cash Ledger | V1 cash flow | `src/features/cash/__tests__/CashScreen.test.tsx`, `src/features/cash/__tests__/useCash.test.tsx` | Add deposit/withdrawal; Dashboard and Cash reflect balance. |
| Current quote or manual price | Live quote refresh plus manual fallback | V1 quote flow | quote service tests, holdings screen tests | Refresh quotes when network is available; failed quotes keep manual prices visible. |
| Privacy while checking values | Value masking | V1 settings flow | Settings and masked-value tests | Toggle value masking; INR values hide while quantities and percentages remain readable. |

## Excel Parity Gate Questions

| Question | V1 answer location | Required evidence |
| --- | --- | --- |
| What do I own? | Holdings | Holding rows show asset name/symbol/category and quantity. |
| How much did I invest? | Dashboard, Holdings, Monthly Progress | Invested value appears in portfolio summary and holding cards. |
| What is it worth now? | Dashboard, Holdings | Current value appears from quotes/manual prices. |
| What is my P&L and P&L %? | Dashboard, Holdings | P&L amount and percentage render for the portfolio/holding where useful. |
| How is my portfolio allocated? | Dashboard, Holdings | Current allocation appears by class and holding. |
| How much is in equity, debt, crypto, and cash? | Dashboard, Monthly Progress | Allocation and monthly asset snapshot show equity/debt/crypto/cash values. |
| What changed this month? | Monthly Progress | Latest snapshot shows monthly gain and gain %. |
| How much did I invest this month? | Monthly Progress | Snapshot shows monthly investment. |
| What is my savings/investment rate? | Monthly Progress | Snapshot shows savings/investment rate from monthly investment and salary. |
| Can I continue daily tracking without opening Excel? | Add Holding, Cash, Holdings, Dashboard, Monthly Progress, Settings | PC verification completes all rows above, and no failed row remains without a defect. |

## PC-Only Verification Flow

Run the static and local Android gate first:

```powershell
npm run test:v1:pc
```

Then verify on Android Emulator:
- Launch CogVest and confirm Dashboard opens.
- Add an opening holding for an equity asset.
- Add a debt or liquid/manual-price holding.
- Add or verify a crypto/manual fallback holding if available.
- Refresh quotes or confirm manual fallback remains usable.
- Open Holdings and verify invested/current/P&L/P&L %/allocation.
- Add cash deposit and withdrawal.
- Open Dashboard and verify total current value, invested value, allocation, and quote status.
- Open Monthly Progress and save two monthly snapshots.
- Verify monthly gain, gain %, monthly investment, savings rate, and asset split.
- Toggle value masking in Settings.
- Close and reopen the app and verify local data remains.

## Pass / Fail Rules

Pass only when:
- every parity question has a visible app answer or documented empty state
- automated tests pass
- Android Emulator smoke/app launch passes
- manual PC verification rows pass
- the UI remains mobile-first and does not expose spreadsheet grids

Fail when:
- a required Excel tracker question cannot be answered
- data disappears after restart
- derived values are persisted instead of calculated from raw records
- the app introduces Excel import/export or spreadsheet UI in V1
- any parity row has no test, no manual evidence, and no linked defect

## Defect Logging

For every failed row, create a GitHub issue titled:

```text
[V1 QA] Excel parity: <failed capability>
```

Include:
- failed checklist row
- branch/commit
- emulator name and Android version
- command output or Maestro result if relevant
- screenshot, UI tree, or logcat excerpt
- expected result
- actual result

