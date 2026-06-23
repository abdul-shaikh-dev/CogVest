# Issue 123 Holdings Visual Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use
> `superpowers:executing-plans` or `superpowers:subagent-driven-development`
> to implement this task-by-task.

## Goal

Implement the locked Holdings design from
`docs/design/holdings-options-preview/index.html`.

Holdings must become a position-review screen with compact rows by default and
tap-to-expand detail, without duplicating Dashboard or exposing quote plumbing in
the compact list.

## Locked Design Contract

- Header: `Holdings`, position count, quote freshness, Search, Add Holding.
- No portfolio value hero.
- Top insight band: exactly two cards:
  - Dominant position.
  - Best return.
- Exposure mix: one combined component with:
  - Asset-class bar.
  - Top 3 concentration percentage.
  - Equity, Debt, Crypto percentages and position counts inside the same card.
- Filters:
  - `All`
  - `Winners`
  - `Losers`
  - `High alloc.`
- Rows:
  - Compact by default.
  - Compact row shows asset-class icon, name, classification, current value,
    P&L %, invested value, allocation %, and expand cue.
  - Compact row does not show `Live price`, `Manual price`, or fallback/API
    language.
  - Tap expands the row into useful details.
  - Only one row is expanded at a time.
- Expanded row detail shows:
  - Invested value.
  - Current value.
  - P&L amount.
  - P&L %.
  - Allocation and allocation rail.
  - Quantity.
  - Average cost.
  - Current price.
  - Price source/status.
  - Notes/context where available.
- Icons:
  - Asset-class based only.
  - Equity = trend/sparkline.
  - Debt = shield/bond.
  - Crypto = coin.

## File Structure

- Modify: `src/features/holdings/HoldingsScreen.tsx`
- Modify: `src/features/holdings/__tests__/HoldingsScreen.test.tsx`
- Modify if needed: `src/components/icons/CategoryIcon.tsx` or equivalent
  asset-class icon component.
- Keep as visual reference: `docs/design/holdings-options-preview/index.html`

## Task 1: Update Tests First

**Files:**
- `src/features/holdings/__tests__/HoldingsScreen.test.tsx`

- [ ] Replace old assertions for Dashboard-like metrics and dense `HoldingCard`
  behavior.
- [ ] Add a populated test that verifies:
  - `Dominant position`
  - `Best return`
  - `Exposure mix`
  - `Top 3`
  - `All`
  - `Winners`
  - `Losers`
  - `High alloc.`
- [ ] Assert compact rows show:
  - holding name
  - classification
  - current value
  - P&L %
  - invested value
  - allocation %
- [ ] Assert compact rows do not show `Live price`, `Manual price`, or fallback
  language.
- [ ] Add a row-expansion test:
  - initially no expanded detail is visible.
  - tapping a row shows quantity, average cost, current price, P&L amount, price
    source/status, and allocation rail context.
  - tapping another row collapses the previous expanded row.
- [ ] Add a filter test for `Winners`, `Losers`, and `High alloc.`.
- [ ] Run the focused test and confirm it fails before implementation:

```powershell
npm test -- src/features/holdings/__tests__/HoldingsScreen.test.tsx
```

## Task 2: Add Review View Model Helpers

**Files:**
- `src/features/holdings/HoldingsScreen.tsx`

- [ ] Create local view-model types:
  - `HoldingFilter`
  - `HoldingReviewItem`
  - `ExposureSegment`
- [ ] Build review items from holdings plus rollup rows.
- [ ] Derive:
  - dominant position by current allocation percentage.
  - best return by unrealised P&L percentage.
  - winners where unrealised P&L >= 0.
  - losers where unrealised P&L < 0.
  - high allocation where current allocation >= 10%.
  - top 3 concentration from allocation percentages.
- [ ] Build exposure segments by asset class:
  - equity = stock + ETF.
  - debt = debt.
  - crypto = crypto.
- [ ] Keep these helpers pure and local, or move to a small domain/view-model
  helper if the file becomes crowded.

## Task 3: Render Top Review And Exposure

**Files:**
- `src/features/holdings/HoldingsScreen.tsx`

- [ ] Remove Dashboard-style metric group from Holdings.
- [ ] Render `PositionReviewBand` with exactly two tiles:
  - `Dominant position`
  - `Best return`
- [ ] Render one `ExposurePanel` that contains:
  - title `Exposure mix`
  - summary copy
  - top 3 concentration
  - segmented exposure bar
  - Equity/Debt/Crypto percentages and position counts
- [ ] Do not render a separate Equity/Debt/Crypto grid below the exposure panel.

## Task 4: Render Compact Rows And Expansion

**Files:**
- `src/features/holdings/HoldingsScreen.tsx`

- [ ] Track expanded row state by holding/asset id.
- [ ] Render all rows compact by default.
- [ ] Compact row content:
  - asset-class icon
  - holding name
  - classification
  - current value
  - P&L %
  - invested value
  - allocation %
  - expand cue
- [ ] Compact row must not show price source/status.
- [ ] On row tap, expand that row.
- [ ] If another row is tapped, collapse the previous expanded row.
- [ ] Expanded detail content:
  - invested value
  - current value
  - P&L amount
  - P&L %
  - allocation and allocation rail
  - quantity
  - average cost
  - current price
  - price source/status
  - notes/context where available

## Task 5: Use Asset-Class Icons

**Files:**
- `src/features/holdings/HoldingsScreen.tsx`
- `src/components/icons/CategoryIcon.tsx` or equivalent

- [ ] Do not use per-company or per-holding icons.
- [ ] Map icons by asset class:
  - equity -> trend/sparkline
  - debt -> shield/bond
  - crypto -> coin
- [ ] Ensure icons are calm line icons and use restrained category color.

## Task 6: Verification

- [ ] Run focused tests:

```powershell
npm test -- src/features/holdings/__tests__/HoldingsScreen.test.tsx
```

- [ ] Run static verification:

```powershell
npm run typecheck
npm test
npm run doctor
```

- [ ] Run V1 PC gate if emulator/app state is ready:

```powershell
npm run test:v1:pc
```

- [ ] Run Impeccable detector on touched UI files:

```powershell
node C:\Users\abdul\.agents\skills\impeccable\scripts\detect.mjs --json src\features\holdings\HoldingsScreen.tsx docs\design\holdings-options-preview\index.html
```

Expected detector result: no findings for the preview. For React Native files,
document any false positives or product-register acceptable warnings.

## Task 7: Commit And PR

- [ ] Commit the preview, spec, plan, and implementation together once tests
  pass.
- [ ] PR body must include:

```text
Closes #123
```

## Self-Review

- Locked preview path is explicit.
- Stale four-card insight and duplicate asset-grid direction has been removed.
- Compact and expanded row states are specified separately.
- Price source/status is explicitly excluded from compact rows.
- Asset icons are asset-class based, not holding-specific.
