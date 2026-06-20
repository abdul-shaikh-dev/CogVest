# Issue 117 Add Holding Lookup Flow Design

## Context

Issue #117 polishes the Add Holding lookup and selection flow against the
accepted V1 research preview. The current app already supports lookup, explicit
selection, manual fallback, opening-position review, and save. This work should
make those states clearer and more progressive without implementing the richer
Yahoo Finance metadata derivation reserved for issue #124.

## Goals

- Make Add Holding feel lookup-first and assisted, not like a dense spreadsheet
  form.
- Keep explicit selection: search results must never auto-fill fields until the
  user taps `Select`.
- After selection, collapse the asset search area into a selected-asset summary
  with a clear `Change` action.
- Present provider-derived metadata as reviewable suggestions before position
  details.
- Preserve manual entry and manual price fallback when lookup or quote fetch
  fails.
- Preserve current opening-position domain behavior and storage model.

## Non-Goals

- Do not implement #124 metadata derivation beyond current Yahoo lookup fields.
- Do not add a backend or Python yfinance.
- Do not change holdings, dashboard, or portfolio calculations.
- Do not redesign the full Add Holding visual system beyond the required flow
  states.

## Design

### Flow Structure

The screen remains a progressive flow:

1. `Asset` - search, inspect results, select, or enter manually.
2. `Metadata` - review provider suggestions and asset classification.
3. `Position` - quantity, average cost, current price, date, conviction, notes.
4. `Review` - derived preview and save.

The accepted design references mention a five-step mature state. For this issue,
we will not split the save confirmation into a separate route or add fake
intermediate behavior. Instead, the UI will make the current four persisted
phases clearer while using copy such as `Confirm details` and `Position details`
to match the intended journey. A future visual-only split can happen if the V1
preview is revised.

### Selected Asset Summary

When a lookup result or existing asset is selected, the Asset phase shows a
compact summary card:

- asset name
- symbol, ticker, source/exchange context
- `Change` action

The summary should reduce visual noise by replacing the feeling that the user
must edit every identity field. Manual fields remain available for correction
and fallback.

### Metadata Review

The Metadata phase shows classification and provider-suggested fields as
reviewable. Copy should clearly say these values are suggestions. The user can
edit instrument type and sector type before continuing.

### Manual Fallback

Lookup failure and quote failure states remain non-blocking. Users can continue
by entering details manually. Quote failure clears current price and keeps the
manual current-price input available in the Position phase.

## Testing Strategy

- Extend Add Holding screen tests for:
  - result list state with explicit `Select`;
  - selected asset summary after selecting a lookup result;
  - `Change` action returning to a selectable/manual asset state;
  - metadata review copy and editable suggestion fields;
  - manual fallback state still allowing continuation.
- Keep existing Maestro testIDs stable where practical.
- Run typecheck, focused Add Holding tests, full Jest, Expo doctor, and Android
  smoke before opening the PR.
