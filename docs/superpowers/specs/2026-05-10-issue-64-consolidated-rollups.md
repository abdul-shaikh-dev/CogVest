# Issue 64 Consolidated Rollups Design

## Goal
Add Excel `All` sheet parity through derived consolidated portfolio rows and totals without adding a spreadsheet grid.

## Domain Model
Create pure calculation helpers that derive a `ConsolidatedHoldingRow` per holding. Each row includes invested value, current value, P&L, P&L %, initial allocation, current allocation, asset class, instrument type, and sector type.

Create portfolio totals from those rows: total invested, total current value, P&L, P&L %, plus cash-inclusive current value where needed.

## UI
Dashboard should use consolidated totals for the hero metric group and show lightweight sector/instrument snapshots. Holdings should show both invested/current allocation values through the existing card list, not a dense table.

## Persistence
No rollups or allocation totals are persisted. Raw assets, opening positions, trades, cash, and quote/manual prices remain the only source data.

## Testing
Cover consolidated row calculations, initial/current allocation percentages, metadata grouping, and screen rendering of the new summary values.

