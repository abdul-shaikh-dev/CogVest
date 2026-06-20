# Issue 117 Add Holding Lookup Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish Add Holding lookup and selection states so users explicitly select, review provider suggestions, and can change/manual-fallback before saving.

**Architecture:** Keep the existing `useAddOpeningPosition` controller and opening-position domain model. Add small selection-summary state to the controller, then refine `AddOpeningPositionForm` copy/layout/tests without changing portfolio calculations.

**Tech Stack:** Expo React Native, TypeScript, React Native Testing Library, existing Yahoo Finance lookup service.

---

### Task 1: Controller Selection Summary

**Files:**
- Modify: `src/features/openingPositions/useAddOpeningPosition.ts`
- Modify: `src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx`

- [x] Track the selected lookup result summary separately from persisted existing assets.
- [x] Clear the selected lookup summary when the user changes manual identity fields.
- [x] Add a controller action that clears selected asset/lookup state for the UI `Change` action.
- [x] Keep quote fallback behavior unchanged.

### Task 2: Add Holding UI State Polish

**Files:**
- Modify: `src/features/openingPositions/AddOpeningPositionForm.tsx`

- [x] Rename visible `Class` phase copy to `Metadata` while preserving compatible testIDs.
- [x] Show a selected asset summary card with `Change` after lookup/existing asset selection.
- [x] Keep lookup result list visible only before selection.
- [x] Add provider suggestion/review copy in the metadata phase.
- [x] Keep manual fields available for fallback and correction.
- [x] Update CTA copy to `Review and save` where it moves into derived preview.

### Task 3: Tests and E2E Coverage

**Files:**
- Modify: `src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx`
- Modify: `e2e/add-holding-lookup.yaml` if needed

- [x] Add tests for lookup result list and explicit `Select`.
- [x] Add tests for selected asset summary and `Change`.
- [x] Add tests for metadata review copy.
- [x] Confirm current lookup Maestro flow testIDs remain valid or update them.

### Task 4: Verification and Delivery

**Commands:**
- `npm run typecheck`
- `npm test -- --runInBand src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx src/features/openingPositions/__tests__/useAddOpeningPosition.test.tsx`
- `npm test -- --runInBand`
- `npm run doctor`
- `npm run android:smoke`

- [x] Record exact smoke output.
- [x] Commit with a focused message.
- [x] Push branch and open PR with `Closes #117`.
