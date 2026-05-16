# Issue 79 Multi-Phase Add Holding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Add Holding into a guided Asset → Class → Position → Review flow.

**Architecture:** Keep one `AddOpeningPositionForm` component for now to avoid broad refactors. Add phase state, phase-specific validation, a reusable stepper renderer, and conditional phase cards while preserving the existing store save path and issue #84 lookup dependencies.

**Tech Stack:** React Native, Expo, TypeScript, Jest, React Native Testing Library, existing CogVest premium components.

---

### Task 1: Phase Navigation Tests

**Files:**
- Modify: `src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx`

- [x] Add tests proving the Asset phase is initially visible and later phase fields are hidden.
- [x] Add tests for Asset phase validation blocking progress.
- [x] Add tests for moving Asset → Class → Position → Review.
- [x] Add tests for Back/step navigation to edit earlier phases.

### Task 2: Phase State And UI

**Files:**
- Modify: `src/features/openingPositions/AddOpeningPositionForm.tsx`

- [x] Add `AddHoldingPhase` state and phase metadata.
- [x] Add phase-specific validation helpers.
- [x] Add stepper UI with active/completed states.
- [x] Render Asset, Class, Position, and Review cards conditionally.
- [x] Preserve existing lookup/autofill behavior in Asset phase.

### Task 3: Review And Save Tests

**Files:**
- Modify: `src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx`

- [x] Update manual save test to navigate through phases.
- [x] Assert review phase displays derived preview.
- [x] Assert Save Holding persists asset/opening position and no trade records.
- [x] Update lookup tests to account for Asset phase placement.

### Task 4: Verification And Delivery

**Commands:**
- `npm test -- --runTestsByPath src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx`
- `npm run typecheck`
- `npm test`
- `npm run doctor`
- `git diff --check`

- [x] Verify focused Add Holding tests.
- [x] Verify full static/test/doctor suite.
- [ ] Commit on `v1/issue-79-multi-phase-add-holding`.
- [ ] Push and open PR with `Closes #79`.
