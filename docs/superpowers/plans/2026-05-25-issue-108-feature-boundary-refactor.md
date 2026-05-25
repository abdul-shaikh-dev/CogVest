# Issue 108 Feature Boundary Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move feature orchestration from large screen components into feature hooks/controllers without changing V1 behavior.

**Architecture:** Each affected feature gets a local hook that owns store subscription, form state, derived values, validation, and persistence actions. Screens keep rendering JSX and wire UI events to hook actions. Domain, services, and store boundaries remain unchanged.

**Tech Stack:** Expo Router, React Native, TypeScript, Zustand vanilla store, Jest, React Native Testing Library.

---

## Files

- Create: `src/features/openingPositions/useAddOpeningPosition.ts`
- Create: `src/features/openingPositions/__tests__/useAddOpeningPosition.test.tsx`
- Modify: `src/features/openingPositions/AddOpeningPositionForm.tsx`
- Create: `src/features/trades/useAddTrade.ts`
- Create: `src/features/trades/__tests__/useAddTrade.test.tsx`
- Modify: `src/features/trades/add-trade-form.tsx`
- Create: `src/features/progress/useProgress.ts`
- Create: `src/features/progress/__tests__/useProgress.test.tsx`
- Modify: `src/features/progress/ProgressScreen.tsx`

## Tasks

- [x] Extract Monthly Progress orchestration into `useProgress` with tests for save/update snapshot and derived chart state.
- [x] Update `ProgressScreen.tsx` to consume `useProgress` and keep existing screen tests green.
- [x] Extract Add Trade orchestration into `useAddTrade` with tests for manual asset validation, review, confirm, and persistence.
- [x] Update `add-trade-form.tsx` to consume `useAddTrade` and keep existing screen tests green.
- [x] Extract Add Holding orchestration into `useAddOpeningPosition` with tests for lookup selection, review, confirm, and persistence.
- [x] Update `AddOpeningPositionForm.tsx` to consume `useAddOpeningPosition` and keep existing screen tests green.
- [x] Run required verification commands and architecture checks.
- [ ] Commit, push, and open PR with `Closes #108`.
