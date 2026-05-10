# Issue 64 Consolidated Rollups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Derive consolidated portfolio rows and allocation details equivalent to the useful parts of Excel `All`.

**Architecture:** Add pure rollup helpers in domain calculations, expose them through dashboard/holdings hooks, and render compact premium summary cards. Keep persistence unchanged.

**Tech Stack:** TypeScript, Expo React Native, Zustand vanilla store, Jest, React Native Testing Library.

---

### Task 1: Domain Consolidated Rows

**Files:**
- Modify: `src/domain/calculations/holdings.ts`
- Modify: `src/domain/calculations/index.ts`
- Test: `src/domain/calculations/__tests__/holdings.test.ts`

- [x] Add `ConsolidatedHoldingRow` and `PortfolioRollupTotals`.
- [x] Add `calculateConsolidatedHoldingRows(holdings)`.
- [x] Add `calculatePortfolioRollupTotals(rows, cashBalance?)`.
- [x] Test invested/current/P&L/P&L % and initial/current allocation.

### Task 2: Hook Wiring

**Files:**
- Modify: `src/features/dashboard/useDashboard.ts`
- Modify: `src/features/holdings/useHoldings.ts`
- Test: `src/features/dashboard/__tests__/useDashboard.test.tsx`
- Test: `src/features/holdings/__tests__/useHoldings.test.tsx`

- [x] Expose consolidated rows and rollup totals from dashboard.
- [x] Expose consolidated rows and totals from holdings.
- [x] Keep existing API fields compatible where tests depend on them.

### Task 3: UI Summaries

**Files:**
- Modify: `src/features/dashboard/DashboardScreen.tsx`
- Modify: `src/features/holdings/HoldingsScreen.tsx`
- Modify: `src/components/cards/HoldingCard.tsx`
- Test: `src/features/dashboard/__tests__/DashboardScreen.test.tsx`
- Test: `src/features/holdings/__tests__/HoldingsScreen.test.tsx`

- [x] Dashboard uses rollup totals for invested/P&L/P&L %.
- [x] Dashboard shows compact sector/instrument snapshots when available.
- [x] Holding cards show invested value, current allocation, and initial allocation.
- [x] Holdings summary includes P&L % without adding a table.

### Task 4: Verification And Delivery

**Commands:**
- `npm run typecheck`
- `npm test`
- `npm run doctor`
- `git diff --check`

- [x] Verify all commands.
- [ ] Commit on `v1/issue-64-consolidated-rollups`.
- [ ] Push and open PR with `Closes #64`.
