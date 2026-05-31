# Seeded Visual QA Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic local Android visual QA harness for V1 screen parity.

**Architecture:** Add a focused seed module that resets and populates the runtime portfolio store through existing actions. Expose it through a hidden Expo Router route guarded by development mode or the local visual QA token, then drive it from a Node/adb screenshot script.

**Tech Stack:** Expo Router, React Native, Zustand store actions, MMKV persistence, Node `child_process`, adb.

---

### Task 1: Seed Data Module

**Files:**
- Create: `src/testing/visualQaSeed.ts`
- Test: `src/testing/__tests__/visualQaSeed.test.ts`

- [ ] Add deterministic assets, opening positions, cash entries, quote cache, and monthly snapshots.
- [ ] Add `resetPortfolioStoreForVisualQa(store)` using existing remove/clear actions.
- [ ] Add `seedVisualQaPortfolio(store)` that resets then seeds the dataset.
- [ ] Test that seeded state includes equity, debt, crypto, cash, quotes, conviction, and at least two monthly snapshots.

### Task 2: Hidden Seed Route

**Files:**
- Create: `app/visual-qa-seed.tsx`
- Modify: `app/_layout.tsx`
- Test: `src/__tests__/rootLayout.test.tsx`

- [ ] Add a hidden stack route.
- [ ] In `__DEV__` or with the local visual QA token, call `seedVisualQaPortfolio(getPortfolioStore())`.
- [ ] Without `__DEV__` or the token, render a blocked message and do not seed.
- [ ] Redirect to Dashboard after seeding.

### Task 3: Android Screenshot Script

**Files:**
- Create: `scripts/android-visual-qa.mjs`
- Modify: `package.json`

- [ ] Add `visual-qa:android` script.
- [ ] Verify adb and connected emulator.
- [ ] Open `cogvest:///visual-qa-seed`.
- [ ] Capture Dashboard, Holdings, Add Holding, Cash, Progress, and Settings screenshots to `docs/testing/artifacts/visual-qa/latest`.
- [ ] Keep this local-only and out of CI.

### Task 4: Documentation And Verification

**Files:**
- Create: `docs/testing/seeded-visual-qa.md`

- [ ] Document prerequisites, command flow, output folder, and comparison process.
- [ ] Run `npm run test:verify`.
- [ ] Run `npm run android:doctor`.
- [ ] Run `npm run android:smoke -- --strict`.
- [ ] Run `npm run visual-qa:android` if an emulator and local dev build are available.
