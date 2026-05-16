# Issue #83 Settings Trust Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Settings with V1 local-first trust, real quote status, and explicit deferred/destructive states.

**Architecture:** Extend `useSettings` to derive a small settings status view model from the store. Keep `SettingsScreen` focused on rendering classified rows and the existing value masking control.

**Tech Stack:** Expo SDK 54, React Native, TypeScript, Zustand vanilla store, Jest/RNTL.

---

### Task 1: Settings Status Model

**Files:**
- Modify: `src/features/settings/useSettings.ts`
- Test: `src/features/settings/__tests__/useSettings.test.tsx`

- [x] Add quote status fields derived from `quoteCache`.
- [x] Cover empty quote cache, live quote cache, and manual fallback count.
- [x] Keep value masking toggle behavior unchanged.

### Task 2: Settings Screen Classification

**Files:**
- Modify: `src/features/settings/SettingsScreen.tsx`
- Test: `src/features/settings/__tests__/SettingsScreen.test.tsx`

- [x] Render Privacy rows as explicit local-first statuses.
- [x] Render Quotes rows using real quote status from `useSettings`.
- [x] Mark Display and Data rows as V1 deferred/locked where unsupported.
- [x] Ensure Clear local data is not pressable and is labelled deferred.
- [x] Keep V2/V3 controls out of V1 Settings.

### Task 3: Verification And PR

- [x] Run focused Settings tests.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run doctor`.
- [x] Run Android smoke if an emulator is connected.
- [ ] Commit and create PR with `Closes #83`.
