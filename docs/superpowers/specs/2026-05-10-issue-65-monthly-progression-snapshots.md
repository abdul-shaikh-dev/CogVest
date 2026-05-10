# Issue 65 Monthly Progression Snapshots Design

## Goal
Add V1 Excel `Progression` parity by storing monthly snapshot records and deriving month-over-month progress summaries without creating a spreadsheet UI.

## Raw Data
Persist a `MonthlySnapshot` record in the portfolio snapshot:
- `id`
- `month` in `YYYY-MM` format
- `portfolioValue`
- `investedValue`
- `equityValue`
- `debtValue`
- `cryptoValue`
- `cashValue`
- `monthlyInvestment`
- `salary`
- optional `monthlyExpense`
- optional `notes`

`monthlyExpense` is optional because the issue requires expense-rate support, and salary plus investment alone cannot reliably derive expenses. If the user does not track expenses, the UI shows "Not enough data" instead of inventing a rate.

## Derived Data
Add pure domain helpers for monthly progression:
- sort snapshots by month descending for display
- find the latest snapshot
- derive monthly gain and gain percentage from the previous month
- derive savings/investment rate as `monthlyInvestment / salary`
- derive expense rate as `monthlyExpense / salary` only when expense is provided
- derive asset-class snapshot rows from equity, debt, crypto, and cash values

No derived totals are persisted.

## Store
Add `monthlySnapshots` to the raw portfolio store and schema migration. Existing schema versions should hydrate with an empty snapshot array. Add create, update, and remove actions so records are locally editable.

## UI
Update `ProgressScreen` to use persisted snapshots as the primary source. Keep the current derived-current-month context as a fallback only when no snapshots exist.

The screen should show:
- latest monthly portfolio value
- monthly gain and gain %
- monthly investment
- savings/investment rate
- expense rate when tracked
- asset-class snapshot
- a simple "Record monthly snapshot" card
- recent snapshot cards

The UI remains mobile-first and low-noise. No spreadsheet grid, no forecasting, and no advanced historical charting.

## Testing
Cover:
- monthly progression calculations
- store persistence and migration
- Progress screen empty, save, and rendered summary states

