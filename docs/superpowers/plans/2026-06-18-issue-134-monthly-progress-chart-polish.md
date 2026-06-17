# Issue 134 Monthly Progress Chart Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Monthly Progress chart privacy, reduced-motion, and line-color contract gaps from issue #134.

**Architecture:** Keep chart data and screen layout unchanged. Add a small reusable reduced-motion hook, thread existing wealth-masking preference into the chart rendering helpers, and update the chart color mapper plus docs/tests to reflect the accepted V1 preview.

**Tech Stack:** React Native `AccessibilityInfo`, React hooks, `react-native-gifted-charts`, TypeScript, Jest / React Native Testing Library.

---

### Task 1: Reduced Motion Hook

**Files:**
- Create: `src/hooks/useReducedMotionPreference.ts`
- Create: `src/hooks/index.ts`
- Test: `src/hooks/__tests__/useReducedMotionPreference.test.tsx`

- [x] Add a hook that initializes from `AccessibilityInfo.isReduceMotionEnabled()`.
- [x] Subscribe to `AccessibilityInfo.addEventListener("reduceMotionChanged", ...)`.
- [x] Remove the subscription on unmount.
- [x] Cover initial false, async true, event update, and cleanup behavior in tests.

### Task 2: Chart Privacy and Color Contract

**Files:**
- Modify: `src/features/progress/ProgressScreen.tsx`
- Modify: `src/features/progress/__tests__/ProgressScreen.test.tsx`
- Modify: `jest.setup.ts`

- [x] Update `getSeriesColor("Portfolio")` to `colors.primary`.
- [x] Update `getSeriesColor("Invested")` to `colors.text.primary`.
- [x] Add chart label masking helper that returns `₹••••` for masked wealth labels.
- [x] Thread `maskWealthValues` into `ProgressTrendCards` and `TrendChart`.
- [x] Pass masked `formatYLabel` into both `LineChart` variants.
- [x] Render masked custom y-axis labels when masking is enabled.
- [x] Use `useReducedMotionPreference()` and set `isAnimated={!reduceMotionEnabled}`.
- [x] Extend the Gifted chart Jest mock to expose chart props for assertions.
- [x] Add tests for masked labels, `formatYLabel`, colors, and reduced motion.

### Task 3: Documentation

**Files:**
- Modify: `docs/design/v1-screen-baseline.md`
- Modify: `docs/superpowers/specs/2026-06-18-issue-134-monthly-progress-chart-polish.md`
- Modify: `docs/superpowers/plans/2026-06-18-issue-134-monthly-progress-chart-polish.md`

- [x] Document Portfolio line = green and Invested line = white.
- [x] Document chart wealth labels must follow value masking.
- [x] Mark this plan complete after verification evidence exists.

### Task 4: Verification and Delivery

**Commands:**
- `npm run typecheck`
- `npm test -- --runInBand src/hooks/__tests__/useReducedMotionPreference.test.tsx src/features/progress/__tests__/ProgressScreen.test.tsx`
- `npm test -- --runInBand`
- `npm run doctor`
- `npm run android:smoke`

- [x] Record exact output for emulator smoke.
- [ ] Commit with a focused message.
- [ ] Push branch and open a PR with `Closes #134`.
