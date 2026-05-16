# Issue #81 Holdings Interactions Spec

## Goal

Align the V1 Holdings screen with the Figma direction and Excel parity by
turning visual placeholders into useful controls without creating a spreadsheet
UI.

## Scope

- Add a functional Add Holding header action when `onAddTrade` is available.
- Replace the inactive search icon with a real search toggle and search field.
- Make filter chips functional for All, Equity, Debt, Crypto, and Cash.
- Keep the summary strip aligned with Figma: Current, Invested, P&L, Drift.
- Use a clear Drift fallback state when historical allocation drift is not
  available.
- Add compact quote status copy showing latest quote freshness and manual
  fallback count.
- Preserve existing holding card content and mobile-first row layout.

## Non-Goals

- No spreadsheet/grid UI.
- No advanced asset search work.
- No V2/V3 historical drift engine.
- No fake debt/crypto/cash holdings.
- No broad redesign outside Holdings.

## Data Rules

- Filters use actual asset classes from derived holdings.
- Equity filter includes `stock` and `etf`.
- Debt filter includes `debt`.
- Crypto filter includes `crypto`.
- Cash filter shows a calm empty state because cash is tracked in the Cash tab,
  not as holding rows.
- Quote status derives from persisted quote cache and holding metadata.
- Manual fallback count is the count of visible holdings whose latest quote
  source is `manual`.

## UX Rules

- Header controls must be wired or absent.
- Search is opt-in and low-noise; it filters by holding name, symbol, ticker,
  asset class, instrument type, or sector type.
- Filter chips show selected state and visible list count changes.
- Add Holding remains the main creation path from Holdings.
- Drift is explicitly `Not enough data` in V1 rather than misleading.

## Acceptance Checklist

- Holdings has no inactive-looking controls.
- User can open Add Holding from Holdings.
- Search filters holdings.
- Filter chips change visible holdings.
- Quote status shows freshness and manual fallback count.
- Summary strip uses Current, Invested, P&L, and Drift.
- Tests cover filters, Add Holding, search, and quote status.
