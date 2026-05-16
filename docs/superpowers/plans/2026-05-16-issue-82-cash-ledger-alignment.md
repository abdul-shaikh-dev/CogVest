# Issue #82 Cash Ledger Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Cash Ledger with Figma V1 and Excel parity metrics without changing raw storage semantics.

**Architecture:** Extend `useCash` with derived monthly metrics from store data. Keep `CashScreen` responsible for entry mode UI and map Investment Transfer to a stored withdrawal.

**Tech Stack:** Expo SDK 54, React Native, TypeScript, Zustand vanilla store, Jest/RNTL.

---

### Task 1: Cash Hook Metrics

**Files:**
- Modify: `src/features/cash/useCash.ts`
- Test: `src/features/cash/__tests__/useCash.test.tsx`

- [x] Add `monthlyMetrics` with added, invested, available, and savings rate.
- [x] Derive invested from current-month buy trades and opening positions.
- [x] Add tests for metrics and not-enough-data savings state.

### Task 2: Cash Screen Entry Modes And Metrics

**Files:**
- Modify: `src/features/cash/CashScreen.tsx`
- Test: `src/features/cash/__tests__/CashScreen.test.tsx`

- [x] Add Deposit, Withdraw, and Investment Transfer segmented controls.
- [x] Map Investment Transfer to stored withdrawal entries.
- [x] Replace the existing metric strip with Added, Invested, Available, Savings.
- [x] Add a masked-preview line near the hero balance.
- [x] Improve recent ledger card copy and keep masked amounts.
- [x] Test deposit, withdrawal, transfer, metrics, and masking.

### Task 3: Verification And PR

- [x] Run focused Cash tests.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run doctor`.
- [x] Run Android smoke if an emulator is connected.
- [ ] Commit and create PR with `Closes #82`.
