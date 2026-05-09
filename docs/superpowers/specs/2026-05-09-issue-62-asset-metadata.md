# Issue 62 Asset Metadata Design

## Goal
Expand CogVest assets so V1 can preserve the Excel tracker metadata that drives grouping, filters, allocation, and rollups without recreating a spreadsheet UI.

## Data Model
Asset remains the source record. Add optional raw metadata fields:
- `instrumentType`
- `sectorType`
- `quoteSourceId`

Existing fields keep their current meaning: `assetClass`, `currency`, `exchange`, `ticker`, `symbol`, and `name`.

## Defaults And Migration
Stored assets from previous schema versions must load safely. Missing metadata is defaulted from `assetClass`: stock to stock/equity, ETF to ETF/diversified, debt to debt/fixed-income, crypto to crypto/digital asset, and cash to cash/liquidity. `quoteSourceId` defaults to `ticker`.

## UI
Add Holding and Add Trade should capture metadata lightly in the Asset section. The fields should be plain, optional-feeling text fields with practical defaults, not an Excel-style metadata grid.

## Derivation
Add domain allocation helpers for instrument and sector allocation so future dashboard/holdings screens can derive rollups from raw metadata. Do not persist these derived totals.

## Testing
Cover migration/defaulting, metadata persistence, Add Holding metadata save, Add Trade metadata save, and derived sector/instrument allocation.

