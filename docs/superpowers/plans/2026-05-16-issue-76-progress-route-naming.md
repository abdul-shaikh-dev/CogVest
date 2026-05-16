# Issue #76 Progress Route Naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize Expo Router Progress naming without changing user-facing behavior.

**Architecture:** Keep `ProgressScreen` unchanged. Update only route files, tab layout route names, and tests that assert file-based routing.

**Tech Stack:** Expo Router, React Native, TypeScript, Jest/RNTL, Maestro YAML IDs.

---

### Task 1: Route Test

**Files:**
- Modify: `src/__tests__/rootLayout.test.tsx`
- Modify: `src/__tests__/rootRoute.test.ts`

- [x] Add/update assertions that the tab route is named `progress`.
- [x] Assert stale `history` route code is not required by tests.
- [x] Run route tests and verify they fail before the route rename.

### Task 2: Rename Progress Tab Route

**Files:**
- Move: `app/(tabs)/history.tsx` to `app/(tabs)/progress.tsx`
- Delete: `app/progress.tsx`
- Modify: `app/(tabs)/_layout.tsx`

- [x] Rename the route component from `HistoryScreen` to `ProgressTabScreen`.
- [x] Change tab icon map key from `history` to `progress`.
- [x] Change `<Tabs.Screen name="history">` to `<Tabs.Screen name="progress">`.
- [x] Preserve `tabBarButtonTestID: "tab-progress"` and title `Progress`.
- [x] Remove duplicate root `app/progress.tsx`.

### Task 3: Verification And PR

- [x] Run focused route and Progress tests.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run doctor`.
- [x] Run Android smoke if an emulator is connected.
- [ ] Commit and create PR with `Closes #76`.
