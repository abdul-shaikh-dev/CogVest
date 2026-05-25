# Issue 105 Monthly Progress Baseline Graphs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Monthly Progress placeholder with stored-snapshot-driven Portfolio vs Invested and Assets vs Months graph sections.

**Architecture:** Keep graph-data derivation in pure domain functions under `src/domain/calculations/`. Keep UI rendering in `ProgressScreen.tsx` with a small SVG chart component that consumes derived series data. Tests cover domain mapping separately from rendering details.

**Tech Stack:** React Native, Expo SDK 54, TypeScript, Jest, React Native Testing Library, `react-native-svg`.

---

## Files

- Create: `src/domain/calculations/__tests__/monthlyProgressCharts.test.ts`
- Create: `src/domain/calculations/monthlyProgressCharts.ts`
- Modify: `src/domain/calculations/index.ts`
- Modify: `src/features/progress/ProgressScreen.tsx`
- Modify: `src/features/progress/__tests__/ProgressScreen.test.tsx`

## Task 1: Domain Graph Data

- [x] Write failing tests in `src/domain/calculations/__tests__/monthlyProgressCharts.test.ts` for:
  - fewer than two snapshots returning insufficient history.
  - chronological month ordering.
  - portfolio and invested values by month.
  - asset trend values for stock, debt, and crypto only.
  - cash excluded from asset series.

- [x] Run `npm test -- src/domain/calculations/__tests__/monthlyProgressCharts.test.ts` and verify it fails because the module does not exist.

- [x] Implement `src/domain/calculations/monthlyProgressCharts.ts` with:
  - `buildMonthlyProgressChartData(snapshots: MonthlySnapshot[])`
  - `hasEnoughHistory: boolean`
  - `monthLabels: string[]`
  - `portfolioSeries`
  - `assetSeries`

- [x] Export the function from `src/domain/calculations/index.ts`.

- [x] Re-run the focused domain test and verify it passes.

## Task 2: Screen Rendering

- [x] Add failing tests in `src/features/progress/__tests__/ProgressScreen.test.tsx` for:
  - one snapshot shows an insufficient chart-history state.
  - two snapshots render `Portfolio vs Invested` and `Assets vs Months`.
  - the asset graph legend includes Equity, Debt, Crypto and excludes Cash.

- [x] Run `npm test -- src/features/progress/__tests__/ProgressScreen.test.tsx` and verify the new tests fail against the current placeholder.

- [x] Update `src/features/progress/ProgressScreen.tsx`:
  - import `Svg`, `Polyline`, and `Circle` from `react-native-svg`.
  - import `buildMonthlyProgressChartData`.
  - add a reusable lightweight line chart component.
  - replace the `Progress trend` placeholder with the two accepted chart cards.
  - show a premium insufficient-history state when `hasEnoughHistory` is false.

- [x] Re-run the focused progress screen test and verify it passes.

## Task 3: Full Verification and PR

- [x] Run `npm run typecheck`.
- [x] Run `npm test -- src/features/progress/__tests__/ProgressScreen.test.tsx`.
- [x] Run `npm test`.
- [x] Run `npm run doctor`.
- [x] If emulator is available and time permits, run PC smoke/manual verification for Monthly Progress.
- [x] Review the diff against issue #105 and `docs/design/v1-screen-baseline.md`.
- [ ] Commit with `feat(progress): add monthly snapshot trend graphs`.
- [ ] Push and create a PR with `Closes #105`.
