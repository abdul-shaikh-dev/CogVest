# Issue 61 Opening Positions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build V1 opening-position entry so Excel tracker holdings can be entered directly and derived across CogVest.

**Architecture:** Add a raw `OpeningPosition` model to the store, migrate persisted snapshots to include it, and extend domain holding calculations to merge opening positions with trades. Add a dedicated Add Holding form for opening positions while preserving the existing Add Trade form.

**Tech Stack:** Expo Router, React Native, TypeScript, Zustand vanilla store, Jest, React Native Testing Library.

---

### Task 1: Raw Model And Store

**Files:**
- Create: `src/types/openingPosition.ts`
- Modify: `src/types/index.ts`
- Modify: `src/store/index.ts`
- Modify: `src/store/selectors.ts`
- Test: `src/store/__tests__/portfolioStore.test.ts`

- [ ] Add `OpeningPosition` with quantity, average cost, optional current price, date, optional conviction, and notes.
- [ ] Add `openingPositions` to `RawPortfolioSnapshot` and store actions.
- [ ] Migrate schema v1 snapshots by defaulting `openingPositions` to an empty array.
- [ ] Persist opening positions as raw data only.
- [ ] Add tests for add/update/remove, persistence, and rehydration.

### Task 2: Domain Derivation

**Files:**
- Modify: `src/domain/calculations/holdings.ts`
- Test: `src/domain/calculations/__tests__/holdings.test.ts`

- [ ] Extend `calculateHolding` and `calculateHoldings` to accept opening positions.
- [ ] Treat opening positions as cost-basis events before trade events.
- [ ] Use quote cache first, then manual opening-position current price.
- [ ] Add tests for opening-only holdings, opening-plus-sell holdings, and allocation/dashboard-compatible output.

### Task 3: Add Holding Flow

**Files:**
- Create: `src/features/openingPositions/openingPositionForm.ts`
- Create: `src/features/openingPositions/AddOpeningPositionForm.tsx`
- Create: `src/features/openingPositions/index.ts`
- Modify: `app/add-holding.tsx`
- Test: `src/features/openingPositions/__tests__/openingPositionForm.test.ts`
- Test: `src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx`

- [ ] Validate asset identity, asset class, quantity, average cost, current price, and acquisition date.
- [ ] Render a focused Add Holding form with derived preview and optional conviction.
- [ ] Save a new asset, opening position, and manual quote cache entry.
- [ ] Keep `app/(tabs)/add-trade.tsx` using `AddTradeForm`.
- [ ] Add component tests for saving a RELIANCE-style opening position.

### Task 4: Dashboard And Holdings Wiring

**Files:**
- Modify: `src/features/holdings/useHoldings.ts`
- Modify: `src/features/dashboard/useDashboard.ts`
- Test: existing hook tests if needed

- [ ] Pass `snapshot.openingPositions` into `calculateHoldings`.
- [ ] Ensure quote refresh manual prices include current cached prices.
- [ ] Update hook tests only if existing assertions require the new raw field.

### Task 5: Verification And Delivery

**Commands:**
- `npm run typecheck`
- `npm test`
- `npm run doctor`

- [ ] Run verification commands and record results.
- [ ] Review changes against issue #61 acceptance.
- [ ] Commit with a focused message.
- [ ] Push branch and open PR with `Closes #61`.

