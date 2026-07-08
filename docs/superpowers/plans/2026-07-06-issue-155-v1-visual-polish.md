# Issue #155 V1 Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the visual density, typography, spacing, color restraint, and layout rhythm of CogVest V1 screens.

**Architecture:** Apply most scale changes through shared theme and premium primitives, then make targeted screen-local fixes for layout issues that shared tokens cannot solve. Preserve domain hooks and selectors.

**Tech Stack:** Expo SDK 54, React Native, TypeScript, Expo Router, existing local theme primitives, Jest, Android Emulator visual QA.

---

## File Structure

- Modify `src/theme/index.ts`: shared typography, spacing, and radius tuning.
- Modify `src/components/common/AppText.tsx`: line-height tuning for the new scale.
- Modify `src/components/common/AppButton.tsx`: calmer CTA height/padding.
- Modify `src/components/common/Premium.tsx`: card, header, icon button, metric group, and shared pill density.
- Modify `src/components/forms/FormTextField.tsx`: input height/padding alignment.
- Modify `app/(tabs)/_layout.tsx`: bottom tab density if needed.
- Modify `src/features/dashboard/DashboardScreen.tsx`: hero and allocation visual rhythm.
- Modify `src/features/holdings/HoldingsScreen.tsx`: exposure mix truncation and row density.
- Modify `src/features/openingPositions/AddOpeningPositionForm.tsx`: step chips, existing assets, lookup/manual separation, review metric grid.
- Modify `src/features/cash/CashScreen.tsx`: cash hero, metric strip, mode controls, form rhythm.
- Modify `src/features/progress/ProgressScreen.tsx`: snapshot CTA and chart card rhythm.
- Modify `src/features/settings/SettingsScreen.tsx`: card density and row alignment.
- Update tests only where snapshots/assertions depend on changed structure or text order.

## Tasks

### Task 1: Shared Visual Scale

- [ ] Tighten `src/theme/index.ts`:
  - reduce `radii.card` from `20` to a calmer value around `18`
  - reduce `radii.button` from `16` to around `14`
  - reduce `typography.sizes.body` from `16` to `15`
  - reduce `typography.sizes.title` from `20` to `19`
  - reduce `typography.sizes.hero` from `42` to around `38`
  - add a `controlHeight` or use existing spacing to avoid very tall CTAs
- [ ] Update `src/components/common/AppText.tsx` line heights to match the new type scale.
- [ ] Update `src/components/common/AppButton.tsx` so primary buttons remain accessible but less oversized.
- [ ] Update `src/components/common/Premium.tsx` card padding, icon button size, metric pill padding, and grouped row height.
- [ ] Update `src/components/forms/FormTextField.tsx` inputs to feel compact but still Android-touch friendly.
- [ ] Run `npm test -- src/theme/__tests__/theme.test.ts src/components/common/__tests__/commonComponents.test.tsx`.

### Task 2: Dashboard Polish

- [ ] Use compact portfolio display for the Dashboard hero where available.
- [ ] Reduce hero card vertical whitespace and daily-change pill dominance.
- [ ] Tighten allocation card row spacing and keep `Open Holdings` visually secondary.
- [ ] Confirm Dashboard tests still validate ordering and actions.
- [ ] Run `npm test -- src/features/dashboard/__tests__/DashboardScreen.test.tsx`.

### Task 3: Holdings Polish

- [ ] Fix exposure mix count truncation by adjusting legend layout/copy sizing.
- [ ] Reduce top insight-card and filter-chip visual bulk.
- [ ] Refine holding rows: smaller asset-class icon container, tighter metadata, stable right-aligned value/P&L/allocation.
- [ ] Keep Add, Search, and value masking actions available.
- [ ] Run `npm test -- src/features/holdings/__tests__/HoldingsScreen.test.tsx`.

### Task 4: Add Holding Polish

- [ ] Reduce step chip height/padding and inactive visual weight.
- [ ] Reduce existing-asset card size and make it feel like quick selection, not primary content.
- [ ] Make lookup results visually distinct from manual fallback fields.
- [ ] Replace review state's tall single-column derived values with a compact metric grid.
- [ ] Keep explicit asset selection behavior unchanged.
- [ ] Run `npm test -- src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx`.

### Task 5: Cash, Progress, and Settings Polish

- [ ] Cash: reduce deployable-cash hero dominance and metric-strip crowding.
- [ ] Cash: tighten mode segmented control and entry form spacing.
- [ ] Progress: reduce snapshot CTA card dominance and tighten chart-card rhythm without changing chart data.
- [ ] Settings: reduce tall card padding, improve switch alignment, and tighten grouped rows.
- [ ] Run:
  - `npm test -- src/features/cash/__tests__/CashScreen.test.tsx`
  - `npm test -- src/features/progress/__tests__/ProgressScreen.test.tsx`
  - `npm test -- src/features/settings/__tests__/SettingsScreen.test.tsx`

### Task 6: Full Verification and Evidence

- [ ] Run `npm run test:v1:pc`.
- [ ] Run `npm run visual-qa:android`.
- [ ] Inspect refreshed screenshots under `docs/testing/artifacts/visual-qa/latest`.
- [ ] If emulator screenshots show major remaining visual defects, fix them before PR.
- [ ] Commit with a message referencing issue #155.
- [ ] Push branch and open PR with `Closes #155`.

