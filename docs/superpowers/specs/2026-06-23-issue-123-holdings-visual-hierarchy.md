# Issue 123 Holdings Visual Hierarchy Spec

## Goal

Upgrade Holdings from a plain list/table replacement into a premium V1
position-review screen. Holdings should help the user decide what needs
attention across positions without duplicating Dashboard's portfolio-value hero.

## Product Context

CogVest V1 is a local-first Android portfolio tracker replacing the user's
Excel investment tracker. Holdings must preserve Excel-grade tracking concepts,
but present them as mobile-first review information rather than spreadsheet
density.

Use:

- `PRODUCT.md`
- `DESIGN.md`
- `docs/design/v1-screen-baseline.md`
- `docs/design/v1-ux-research-baseline.md`
- `docs/design/v1-research-preview/index.html`
- GitHub issue #123

## Locked Visual Direction

The accepted preview target is
`docs/design/holdings-options-preview/index.html`. This is the locked V1
Holdings direction unless the user explicitly reopens the design.

The screen should feel like a position-review list, not another dashboard:

- Header: `Holdings` plus position count and quote freshness.
- Header actions: Search and Add Holding.
- No portfolio/current-value hero.
- Top insight band has exactly two cards:
  - Dominant position.
  - Best return.
- Exposure is a single combined component:
  - Asset-class mix bar.
  - Top 3 concentration percentage.
  - Equity, Debt, and Crypto percentages plus position counts inside the same
    card.
  - Do not render a separate Equity/Debt/Crypto card grid below it.
- Smart filter chips:
  - `All`
  - `Winners`
  - `Losers`
  - `High alloc.`
- Position list:
  - Default state is compact for every holding.
  - Compact rows show asset-class icon, holding name, classification,
    current value, P&L %, invested value, allocation %, and an expand cue.
  - Compact rows do not show `Live price` or `Manual price`.
  - Tapping a holding expands that row into a richer detail card.
  - Expanded state shows invested value, current value, P&L amount, P&L %,
    allocation, allocation rail, price source/status, quantity, average cost,
    current price, and notes/context where available.
  - Only the tapped card should be expanded at a time.
- Icons:
  - Use asset-class icons, not per-holding or per-company icons.
  - Equity = trend/sparkline.
  - Debt = shield/bond.
  - Crypto = coin.
  - Cash does not normally appear in Holdings; it belongs in Cash Ledger.

## Functional Requirements

- Preserve existing Add Holding entry point from Holdings.
- Preserve search across name, symbol, ticker, asset class, instrument type, and
  sector type.
- Preserve pull-to-refresh or explicit quote refresh behavior where it already
  exists.
- Preserve value masking for INR amounts.
- Preserve empty state with Add Holding action.
- Preserve no-LTCG V1 boundary.
- Keep quantity, average cost, current price, sector, instrument type, and notes
  available in the row/detail content. Do not cram every value into the first
  visual line.

## Derived Review Rules

For V1, derive review summaries from existing holdings and rollup rows:

- Largest position: holding with highest current allocation percentage.
- Needs review: holdings with manual quote source, no refreshed quote, high
  allocation, or negative P&L.
- Best return: holding with highest positive P&L percentage.
- Weakest holding: holding with lowest P&L percentage.
- High allocation threshold: current allocation greater than or equal to 10%.
- Gainer: unrealised P&L is greater than or equal to zero.
- Loser: unrealised P&L is less than zero.
- Exposure mix: aggregate current value by asset class group:
  - Equity = `stock` + `etf`.
  - Debt = `debt`.
  - Crypto = `crypto`.
  - Cash holdings are not expected in Holdings; cash remains in Cash Ledger.
- Concentration score: sum of top three current allocation percentages.

## Non-Goals

- Do not implement new portfolio domain logic unrelated to Holdings review.
- Do not add import/export, Minimal Mode, LTCG, behavior engine, cloud sync, or
  V2/V3 scope.
- Do not introduce a spreadsheet grid or editable table.
- Do not replace native app verification with HTML-only preview work.

## Acceptance Criteria

- Holdings reads as a position-review screen, not a spreadsheet or plain list.
- Dashboard-style portfolio value hero is removed from Holdings.
- Two-card insight band, combined exposure mix, smart filters, compact rows,
  and tap-to-expand row detail are implemented.
- Compact rows include invested value and allocation percentage.
- Compact rows do not expose price source/status.
- Asset icons are asset-class based, not unique per holding.
- Exposure mix is not duplicated by a separate asset-class grid.
- Populated and empty states are covered by tests.
- Masked values hide INR amounts while preserving quantities and percentages.
- Add Holding remains reachable.
- Maestro navigation can still reach Holdings.
- Android emulator evidence is collected after implementation when feasible.
- `npm run test:v1:pc` passes or failures are documented as defects.
