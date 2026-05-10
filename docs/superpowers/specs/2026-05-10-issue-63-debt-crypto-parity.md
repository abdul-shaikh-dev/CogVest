# Issue 63 Debt And Crypto Parity Design

## Goal
Make debt and crypto first-class V1 portfolio categories without adding separate spreadsheet-like modules.

## Scope
Debt and crypto remain normal `Asset` records with category-specific metadata, opening positions/trades, quote cache entries, and manual prices. Views derive current value, invested value, P&L, P&L %, category allocation, and consolidated totals from the existing holding pipeline.

## Debt Handling
Debt-like assets such as PPF, liquid funds, arbitrage funds, bonds, and fixed deposits should be supported through manual current prices. Live quote refresh must be fallback-safe and should not require a quote API for instruments that cannot refresh.

## Crypto Handling
Crypto assets should display in INR like every other holding. CoinGecko can provide live quotes when `quoteSourceId` is available; manual prices remain the fallback.

## UI
Add Holding and Add Trade keep the same calm metadata fields from #62. Debt and crypto need practical defaults so the user can enter PPF, liquid funds, and Bitcoin-like assets without fighting stock-specific assumptions.

## Testing
Tests must cover manual debt holdings, crypto INR quote handling, manual fallback behavior, and consolidated dashboard/allocation inclusion.

