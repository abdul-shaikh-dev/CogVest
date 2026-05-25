# Issue 104 Add Holding Explicit Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Add Holding lookup explicit-selection-only so search never auto-picks an asset.

**Architecture:** Keep lookup, manual entry, and quote resolution inside `AddOpeningPositionForm`. Remove implicit selection paths and preserve explicit row selection as the single lookup-autofill trigger. Cover the behavior in the existing component test suite.

**Tech Stack:** React Native, Expo, React Native Testing Library, Jest, TypeScript.

---

## File Map

- Modify: `src/features/openingPositions/AddOpeningPositionForm.tsx`
  - Remove exact-match auto-selection effect.
  - Remove preferred-result selection on search submit.
  - Add visible `Select` copy in lookup rows so the choice is explicit.
- Modify: `src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx`
  - Add tests for no autofill before selection.
  - Update fallback test to press the lookup result before expecting fields.

## Task 1: Lock Current Bug With Tests

- [ ] Add a test that searches an exact `bitcoin` lookup result and verifies
  Asset name, Symbol, Ticker, Quote source ID, and Current price remain empty
  until the result is pressed.
- [ ] Add a test assertion that `submitEditing` on the search field does not
  trigger quote lookup or fill fields.
- [ ] Run:

```powershell
npm test -- src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx
```

Expected before implementation: focused test fails because current code
auto-selects exact lookup matches.

## Task 2: Remove Implicit Selection

- [ ] Delete the effect that finds `exactResult` and calls `selectLookupResult`.
- [ ] Remove `getPreferredLookupResult` and `selectPreferredLookupResult`.
- [ ] Remove `onSubmitEditing={selectPreferredLookupResult}` from the lookup
  input.
- [ ] Keep explicit row press behavior calling `selectLookupResult(result)`.
- [ ] Add visible `Select` text to lookup result rows.

## Task 3: Verify Focused Behavior

- [ ] Run:

```powershell
npm test -- src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx
```

Expected: Add Opening Position tests pass and prove explicit selection is
required.

## Task 4: Full Verification

- [ ] Run:

```powershell
npm run typecheck
npm test
npm run doctor
```

Expected: all commands pass.

## Task 5: Publish

- [ ] Commit with a focused message.
- [ ] Push branch `v1/issue-104-add-holding-explicit-selection`.
- [ ] Open PR with `Closes #104`.
