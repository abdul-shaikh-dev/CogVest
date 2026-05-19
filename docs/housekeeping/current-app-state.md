# CogVest Current App State

Date: 2026-05-06

Status: historical review snapshot, updated by later housekeeping where noted.
For current V1 Excel parity closeout evidence, see
`docs/testing/excel-parity-verification-2026-05-19.md`.

Base commit reviewed: `bcbeeed Merge pull request #73 from abdul-shaikh-dev/docs/superpowers-workflow-agents`

Known later update: #72 was addressed by PR #78 and merged into `main` at
`1d26750`. Re-run Android/Maestro verification before treating this report as
current runtime evidence.

Branch reviewed: `housekeeping/app-state-review`

## Summary

CogVest has a working V1 app shell with local-first portfolio data, derived
holdings, dashboard summaries, cash tracking, quote refresh plumbing, value
masking, Android PC harness scripts, and Maestro flows.

Later V1 work closed the Excel parity slices for metadata, debt/crypto support,
monthly snapshots, asset lookup/autofill, rollups, and the parity gate. Treat
the detailed findings below as historical unless they are still reproduced on
current `main`.

## Implemented Screens

| Screen | Route | Feature module | Current status |
| --- | --- | --- | --- |
| Dashboard | `app/(tabs)/dashboard.tsx` | `src/features/dashboard` | Implemented. Shows portfolio value, invested, P&L, allocation, this month, quote status, and conviction readiness. |
| Holdings | `app/(tabs)/holdings.tsx` | `src/features/holdings` | Implemented. Shows derived holdings, filters, refresh, quote failures, invested/current/P&L/allocation details. |
| Add Holding | `app/add-holding.tsx` | `src/features/trades` | Implemented as an Add Holding UI backed by trade/opening-entry storage. Supports buy/sell, manual asset creation, review, save, conviction, and manual quote upsert. |
| Cash | `app/(tabs)/cash.tsx` | `src/features/cash` | Implemented. Supports additions and withdrawals, balance, recent ledger, masking. |
| Monthly Progress | `app/(tabs)/progress.tsx` | `src/features/progress` | Implemented for V1 snapshots and route naming; see #65 and #76 closeout. |
| Settings | `app/(tabs)/settings.tsx` | `src/features/settings` | Implemented. Supports local-first status and value masking toggle. |

## Implemented Data and Domain Areas

| Area | Evidence | Status |
| --- | --- | --- |
| Raw portfolio persistence | `src/store/index.ts` persists assets, trades, cash entries, preferences, and quote cache. | Implemented. |
| Derived holdings | `src/domain/calculations/holdings.ts` derives holdings from assets, trades, and quotes. | Implemented. |
| Cash balance | `calculateCashBalance` and `useCash` derive balance from cash entries. | Implemented. |
| Portfolio total | `calculatePortfolioTotal` combines holdings current value and cash. | Implemented. |
| Allocation | `calculateAllocation` groups by current `AssetClass`. | Implemented for V1 equity/debt/crypto/cash parity. |
| Quote refresh | `src/services/quotes/quoteResolver.ts` supports Yahoo/CoinGecko and manual fallback. | Implemented for supported asset classes. |
| Value masking | Settings preference flows into Dashboard, Holdings, Cash, and Progress. | Implemented in core value displays. |
| Conviction | Optional conviction is accepted on Add Holding and dashboard readiness is derived. | Lightweight V1 state implemented. |
| Monthly snapshots | `src/store/index.ts` persists monthly snapshots and `calculateMonthlyProgressSummaries` derives summaries. | Implemented by #65. |

## Excel Parity Gate Status

| Question from #60 | Current status | Evidence / gap |
| --- | --- | --- |
| What do I own? | Pass in closeout evidence | Holdings and Add Holding opening-position flow cover stored assets and quantities. |
| How much did I invest? | Pass in closeout evidence | Dashboard, Holdings, Monthly Progress, and calculations tests cover invested values. |
| What is it worth now? | Pass in closeout evidence | Quote/manual prices drive Dashboard and Holdings current values. |
| What is my P&L and P&L %? | Pass in closeout evidence | Dashboard, Holdings, and calculations tests cover P&L amount and percentage. |
| How is my portfolio allocated? | Pass in closeout evidence | Dashboard/Holdings allocation and rollups are covered by #64 and later UI alignment. |
| How much is in equity, debt, crypto, and cash? | Pass in closeout evidence | Asset metadata, debt/crypto parity, cash, and Progress snapshots are covered. |
| What changed this month? | Pass in closeout evidence | Monthly Progress snapshots cover monthly gain and gain %. |
| How much did I invest this month? | Pass in closeout evidence | Monthly Progress and Cash Ledger metrics cover monthly investment context. |
| What is my savings/investment rate? | Pass in closeout evidence | Monthly Progress and Cash Ledger metrics cover savings/investment rate context. |
| Can I continue daily tracking without opening Excel? | Pass in closeout evidence | #61-#66 are closed and `docs/testing/excel-parity-verification-2026-05-19.md` records the V1 PC gate. |

## GitHub Issue Alignment

| Issue | Review result |
| --- | --- |
| #60 Excel tracker parity MVP | Closeout PR pending. See `docs/testing/excel-parity-verification-2026-05-19.md`. |
| #61 Opening positions | Closed. |
| #62 Asset metadata | Closed. |
| #63 Debt and crypto parity | Closed. |
| #64 Consolidated rollups | Closed. |
| #65 Monthly snapshots | Closed. |
| #66 Excel parity gate docs/tests | Closed. |
| #72 Android release APK navigation | Historical finding. Addressed by PR #78; re-run Maestro before relying on current status. |

## Next Recommended Order

1. Merge the #60 closeout evidence PR if CI passes.
2. Re-run local release/APK verification before V1 dev-complete.
3. Keep V2/V3 issues as future placeholders until V1 closeout is accepted.
