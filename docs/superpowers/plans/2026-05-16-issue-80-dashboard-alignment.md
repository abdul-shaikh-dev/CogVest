# Issue #80 Dashboard Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the V1 Dashboard with the approved Figma direction by wiring actions and correcting monthly metric semantics.

**Architecture:** Keep raw data in the store and extend `useDashboard` with derived monthly metrics plus quote refresh actions. Keep `DashboardScreen` presentational, using existing common components.

**Tech Stack:** Expo SDK 54, React Native, TypeScript, Zustand vanilla store, Jest/RNTL.

---

### Task 1: Dashboard Hook Data And Actions

**Files:**
- Modify: `src/features/dashboard/useDashboard.ts`
- Test: `src/features/dashboard/__tests__/useDashboard.test.tsx`

- [ ] Add a `refreshQuotes` dependency, `isRefreshing`, `quoteFailures`, `refresh`, `toggleMaskWealthValues`, and `monthlyMetrics` to `useDashboard`.
- [ ] Reuse the existing quote refresh service signature from `src/features/holdings/useHoldings.ts`.
- [ ] Derive monthly investment from current-month buy trades and opening positions.
- [ ] Derive monthly cash change from current-month cash entries.
- [ ] Derive savings rate only when monthly additions are greater than zero.
- [ ] Add hook tests for monthly metrics, value-mask toggling, and quote refresh persistence.

### Task 2: Dashboard Screen Wiring

**Files:**
- Modify: `src/features/dashboard/DashboardScreen.tsx`
- Test: `src/features/dashboard/__tests__/DashboardScreen.test.tsx`

- [ ] Pass optional `refreshQuotes` into `useDashboard` for tests.
- [ ] Wire the eye header icon to `toggleMaskWealthValues`.
- [ ] Wire the refresh header icon to `refresh`.
- [ ] Keep Add Holding CTA visible when `onAddTrade` is available.
- [ ] Change `This Month` metrics to `Invested`, `Savings`, and `Cash change`.
- [ ] Change quote status copy to describe fresh quote, fallback, refreshing, and failure states.
- [ ] Add screen tests for Add Holding, masking, refresh action, and monthly labels.

### Task 3: Verification And PR

**Files:**
- Modify: none expected beyond Tasks 1-2.

- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run doctor`.
- [ ] Run a focused Android smoke only if the emulator is already available and the app is installed.
- [ ] Commit with a focused message and open a PR containing `Closes #80`.
