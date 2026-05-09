# Issue 61 Opening Positions Design

## Goal
Add a V1 Add Holding path that lets the user enter existing portfolio positions from the Excel tracker without reconstructing historical trades.

## Product Boundary
CogVest should persist an opening position record and derive holdings, dashboard totals, allocation, and P&L from domain functions. This must not turn into an editable spreadsheet grid, and it must not remove or rewrite the existing Add Trade flow.

## Data Model
Create a raw `OpeningPosition` record with asset id, quantity, average cost, optional manual current price, acquisition/start date, optional conviction, and notes. Store opening positions alongside assets, trades, cash entries, and preferences in the raw portfolio snapshot.

Opening positions are raw input data. Derived values such as invested value, current value, P&L, P&L %, and allocation stay out of persistence.

## Domain Derivation
`calculateHolding` treats opening positions as initial buy-like cost basis events. Later buy/sell trades continue to adjust units and weighted average cost as they do today. `calculateHoldings` includes assets that have either opening positions or trades.

Quote priority is live/manual quote cache first, then opening-position manual current price, then zero. This keeps live quote refresh authoritative while still supporting offline/manual Excel parity.

## UI Flow
`app/add-holding.tsx` becomes the opening-position flow. The existing tab trade form remains unchanged for normal buy/sell trades.

The Add Holding screen captures asset identity, asset class, quantity, average cost, current/manual price, acquisition date, optional conviction, and notes. It shows a derived preview before saving and then stores the asset, opening position, and manual quote cache entry.

## Testing
Add tests for domain derivation, raw persistence/rehydration, form validation, and the Add Holding save flow. Existing trade tests must continue to pass.

