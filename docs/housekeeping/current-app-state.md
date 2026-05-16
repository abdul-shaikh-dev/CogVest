# CogVest Current App State

Date: 2026-05-06

Status: historical review snapshot, updated by later housekeeping where noted.

Base commit reviewed: `bcbeeed Merge pull request #73 from abdul-shaikh-dev/docs/superpowers-workflow-agents`

Known later update: #72 was addressed by PR #78 and merged into `main` at
`1d26750`. Re-run Android/Maestro verification before treating this report as
current runtime evidence.

Branch reviewed: `housekeeping/app-state-review`

## Summary

CogVest has a working V1 app shell with local-first portfolio data, derived
holdings, dashboard summaries, cash tracking, quote refresh plumbing, value
masking, Android PC harness scripts, and Maestro flows.

It is not yet Excel-parity complete. The biggest product gaps are the
Excel-style metadata model, first-class debt support, monthly snapshots,
lightweight asset lookup/autofill, and complete V1 E2E verification.

## Implemented Screens

| Screen | Route | Feature module | Current status |
| --- | --- | --- | --- |
| Dashboard | `app/(tabs)/dashboard.tsx` | `src/features/dashboard` | Implemented. Shows portfolio value, invested, P&L, allocation, this month, quote status, and conviction readiness. |
| Holdings | `app/(tabs)/holdings.tsx` | `src/features/holdings` | Implemented. Shows derived holdings, filters, refresh, quote failures, invested/current/P&L/allocation details. |
| Add Holding | `app/add-holding.tsx` | `src/features/trades` | Implemented as an Add Holding UI backed by trade/opening-entry storage. Supports buy/sell, manual asset creation, review, save, conviction, and manual quote upsert. |
| Cash | `app/(tabs)/cash.tsx` | `src/features/cash` | Implemented. Supports additions and withdrawals, balance, recent ledger, masking. |
| Monthly Progress | `app/(tabs)/progress.tsx` | `src/features/progress` | Partial. Current-month derived summary exists; persistent monthly snapshots are not implemented. Route naming normalized by #76. |
| Settings | `app/(tabs)/settings.tsx` | `src/features/settings` | Implemented. Supports local-first status and value masking toggle. |

## Implemented Data and Domain Areas

| Area | Evidence | Status |
| --- | --- | --- |
| Raw portfolio persistence | `src/store/index.ts` persists assets, trades, cash entries, preferences, and quote cache. | Implemented. |
| Derived holdings | `src/domain/calculations/holdings.ts` derives holdings from assets, trades, and quotes. | Implemented. |
| Cash balance | `calculateCashBalance` and `useCash` derive balance from cash entries. | Implemented. |
| Portfolio total | `calculatePortfolioTotal` combines holdings current value and cash. | Implemented. |
| Allocation | `calculateAllocation` groups by current `AssetClass`. | Partial: groups stock/etf/crypto/cash, but no first-class debt class. |
| Quote refresh | `src/services/quotes/quoteResolver.ts` supports Yahoo/CoinGecko and manual fallback. | Implemented for supported asset classes. |
| Value masking | Settings preference flows into Dashboard, Holdings, Cash, and Progress. | Implemented in core value displays. |
| Conviction | Optional conviction is accepted on Add Holding and dashboard readiness is derived. | Lightweight V1 state implemented. |
| Monthly snapshots | No persisted monthly snapshot model found. | Missing; issue #65 remains open. |

## Excel Parity Gate Status

| Question from #60 | Current status | Evidence / gap |
| --- | --- | --- |
| What do I own? | Partial | Holdings screen derives current holdings from stored assets/trades. Opening position entry exists, but asset metadata is narrow. |
| How much did I invest? | Partial | Dashboard/Holdings derive invested value. Needs consolidated rollup hardening under #64. |
| What is it worth now? | Partial | Current value derives from quote cache/manual quote. Live/manual fallback exists, but unsupported/debt instruments need better handling. |
| What is my P&L and P&L %? | Partial | Holding and dashboard P&L exist. Consolidated tests/rollup issue #64 remains open. |
| How is my portfolio allocated? | Partial | Asset-class allocation exists. No sector/instrument allocation; debt class missing. |
| How much is in equity, debt, crypto, and cash? | Partial | Equity/crypto/cash can be represented. Debt is not first-class; `etf` is currently labelled as Debt in UI config. |
| What changed this month? | Partial | Progress screen derives current-month investment/cash, but no monthly snapshot model or monthly gain persistence. |
| How much did I invest this month? | Partial | Progress screen derives current-month buy totals from trades. |
| What is my savings/investment rate? | Partial | Progress screen computes investment/cash-added percentage if cash was added. Salary/expense rate fields are missing. |
| Can I continue daily tracking without opening Excel? | Not yet | Core data entry exists, but #61-#66 and #72 block the parity gate. |

## GitHub Issue Alignment

| Issue | Review result |
| --- | --- |
| #60 Excel tracker parity MVP | Keep open. Parent issue is not complete. |
| #61 Opening positions | Partial. Add Holding can create a holding, but it is still trade-shaped and lacks required metadata/current-position semantics. |
| #62 Asset metadata | Not complete. Asset model lacks instrument type, sector type, quote source identifier, and debt category. |
| #63 Debt and crypto parity | Partial. Crypto path exists; debt path is missing as a first-class category. |
| #64 Consolidated rollups | Partial. Totals/allocation exist but sector/instrument grouping and allocation details are missing. |
| #65 Monthly snapshots | Not complete. Current progress screen is derived-current-month only. |
| #66 Excel parity gate docs/tests | Not complete. Existing testing docs mention V1 flows but do not provide a full Excel parity checklist. |
| #72 Android release APK navigation | Historical finding. Addressed by PR #78; re-run Maestro before relying on current status. |

## Next Recommended Order

1. Implement #62 before expanding the UI further; metadata is the base for #63 and #64.
2. Implement #84 so Add Holding can lookup/autofill common asset metadata and prices.
3. Implement #61/#79 with explicit multi-phase opening-position semantics after the metadata model is settled.
4. Implement #63 and #64 together or back-to-back because debt support and rollups share the same model boundary.
5. Implement #65 monthly snapshots.
6. Complete #66 and then evaluate #60 for closure.
