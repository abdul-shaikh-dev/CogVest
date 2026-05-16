# Issue #81 Holdings Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Holdings header actions, filters, search, quote status, and summary metrics functional for V1.

**Architecture:** Keep derivation in `useHoldings`; keep `HoldingsScreen` responsible for presentation and user interaction. Reuse existing common components and holding cards.

**Tech Stack:** Expo SDK 54, React Native, TypeScript, Zustand vanilla store, Jest/RNTL.

---

### Task 1: Extend Holdings Hook

**Files:**
- Modify: `src/features/holdings/useHoldings.ts`
- Test: `src/features/holdings/__tests__/useHoldings.test.tsx`

- [ ] Add latest quote date/source metadata and manual fallback count.
- [ ] Add a value-mask toggle action matching Dashboard behavior.
- [ ] Keep refresh quote persistence unchanged.
- [ ] Test quote status metadata and value-mask toggle.

### Task 2: Wire Holdings Screen Interactions

**Files:**
- Modify: `src/features/holdings/HoldingsScreen.tsx`
- Test: `src/features/holdings/__tests__/HoldingsScreen.test.tsx`

- [ ] Add functional Add Holding header plus action when `onAddTrade` exists.
- [ ] Add a search toggle and text input for holdings.
- [ ] Add functional All/Equity/Debt/Crypto/Cash filter chips.
- [ ] Render `Current`, `Invested`, `P&L`, and `Drift` summary metrics.
- [ ] Render compact quote status with latest update and manual fallback count.
- [ ] Test Add Holding, search, filters, quote status, and drift fallback.

### Task 3: Verification And PR

- [ ] Run focused Holdings tests.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run doctor`.
- [ ] Run Android smoke if an emulator is connected.
- [ ] Commit and create PR with `Closes #81`.
