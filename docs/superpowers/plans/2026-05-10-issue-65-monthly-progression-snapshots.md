# Issue 65 Monthly Progression Snapshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persisted monthly progression snapshots and derived V1 summary metrics.

**Architecture:** Introduce a raw `MonthlySnapshot` type in `src/types`, store it alongside existing raw records, and derive all progress metrics in pure domain functions. Update Progress UI to save and show snapshots using the existing premium cards/forms.

**Tech Stack:** TypeScript, Expo React Native, Zustand vanilla store, React Native Testing Library, Jest.

---

### Task 1: Monthly Snapshot Domain Model

**Files:**
- Create: `src/types/monthlySnapshot.ts`
- Modify: `src/types/index.ts`
- Modify: `src/domain/calculations/holdings.ts`
- Modify: `src/domain/calculations/index.ts`
- Test: `src/domain/calculations/__tests__/holdings.test.ts`

- [x] Add `MonthlySnapshot` raw type.
- [x] Add `MonthlyProgressSummary` and `MonthlyAssetSnapshotItem` derived types.
- [x] Add `calculateMonthlyProgressSummaries(snapshots)`.
- [x] Test monthly gain, gain %, savings rate, expense rate, and asset class rows.

### Task 2: Store Persistence And Migration

**Files:**
- Modify: `src/store/index.ts`
- Test: `src/store/__tests__/portfolioStore.test.ts`

- [x] Add `monthlySnapshots` to `RawPortfolioSnapshot`.
- [x] Add `addMonthlySnapshot`, `updateMonthlySnapshot`, and `removeMonthlySnapshot`.
- [x] Persist monthly snapshots under `portfolioStorageKey`.
- [x] Migrate older snapshots to `monthlySnapshots: []`.
- [x] Test add/update/remove, persistence, rehydrate, and migration.

### Task 3: Progress Screen Snapshot Flow

**Files:**
- Modify: `src/features/progress/ProgressScreen.tsx`
- Test: `src/features/progress/__tests__/ProgressScreen.test.tsx`

- [x] Render persisted monthly summaries before derived fallback content.
- [x] Add a simple monthly snapshot form.
- [x] Save snapshots through the store.
- [x] Show latest value, monthly gain/gain %, monthly investment, savings rate, expense rate, and asset snapshot.
- [x] Show recent monthly snapshot cards.
- [x] Test empty state, saving a snapshot, and summary rendering.

### Task 4: Verification And Delivery

**Commands:**
- `npm run typecheck`
- `npm test`
- `npm run doctor`
- `git diff --check`

- [x] Verify all commands.
- [ ] Commit on `v1/issue-65-monthly-progression`.
- [ ] Push and open PR with `Closes #65`.
