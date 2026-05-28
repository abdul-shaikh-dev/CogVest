# Issue #110 UI Parity and Emulator QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify CogVest V1 against the accepted premium UI baseline, fix small parity defects, and record emulator QA evidence for issue #110.

**Architecture:** Treat the markdown baseline as the contract and the HTML/Figma assets as visual references. Keep changes small and screen-local unless a shared component is clearly the source of repeated drift. Preserve existing feature hook/controller boundaries.

**Tech Stack:** Expo SDK 54, React Native, Expo Router, TypeScript, Zustand, MMKV, React Native Testing Library, Jest, adb/Android Emulator, optional Maestro.

---

## File Structure

- Modify if needed: `src/features/dashboard/DashboardScreen.tsx`
- Modify if needed: `src/features/holdings/HoldingsScreen.tsx`
- Modify if needed: `src/features/openingPositions/AddOpeningPositionForm.tsx`
- Modify if needed: `src/features/progress/ProgressScreen.tsx`
- Modify if needed: `src/features/cash/CashScreen.tsx`
- Modify if needed: `src/features/settings/SettingsScreen.tsx`
- Modify if needed: `src/components/cards/HoldingCard.tsx`
- Modify if needed: `src/components/common/*`
- Modify tests near changed screens under `src/features/**/__tests__/`
- Create: `docs/testing/issue-110-ui-parity-qa.md`

## Task 1: Baseline Checklist and QA Doc

**Files:**
- Create: `docs/testing/issue-110-ui-parity-qa.md`

- [ ] **Step 1: Create the QA evidence document**

Create `docs/testing/issue-110-ui-parity-qa.md` with this structure:

```markdown
# Issue #110 V1 UI Parity QA

Issue: https://github.com/abdul-shaikh-dev/CogVest/issues/110

## Baseline

- `docs/design/v1-screen-baseline.md`
- `docs/design/issue-86-premium-preview/index.html`
- `docs/design/figma/issue-69-v1-screens/code.js`

## Commands

| Command | Result | Notes |
| --- | --- | --- |
| `npm run test:verify` | Not run yet | |
| `npm run android:doctor` | Not run yet | |
| `npm run android:smoke` | Not run yet | |
| `npm run maestro:check` | Not run yet | |
| `npm run maestro:test` | Not run yet | |

## Screen Review

| Screen | Status | Evidence | Drift / Fix |
| --- | --- | --- | --- |
| Dashboard | Pending | | |
| Holdings | Pending | | |
| Add Holding | Pending | | |
| Monthly Progress | Pending | | |
| Cash Ledger | Pending | | |
| Settings | Pending | | |

## State Review

| State | Status | Evidence | Drift / Fix |
| --- | --- | --- | --- |
| Empty portfolio | Pending | | |
| Empty cash ledger | Pending | | |
| No monthly snapshots | Pending | | |
| Quote lookup selection | Pending | | |
| Manual quote fallback/provider error | Pending | | |
| Value masking | Pending | | |

## Accepted V1 Compromises

- None recorded yet.

## Follow-Ups

- None recorded yet.
```

- [ ] **Step 2: Commit the initial planning/QA docs**

Run:

```powershell
git add docs/superpowers/specs/2026-05-28-issue-110-ui-parity-qa.md docs/superpowers/plans/2026-05-28-issue-110-ui-parity-qa.md docs/testing/issue-110-ui-parity-qa.md
git commit -m "docs: plan issue 110 ui parity qa"
```

Expected: commit succeeds on a non-main branch.

## Task 2: Static Baseline Review

**Files:**
- Read: `docs/design/v1-screen-baseline.md`
- Read: `docs/design/issue-86-premium-preview/index.html`
- Read: `src/features/*/*.tsx`
- Update: `docs/testing/issue-110-ui-parity-qa.md`

- [ ] **Step 1: Compare each screen to the baseline**

Inspect the six screen files and record whether required elements exist:

```powershell
rg -n "ScreenHeader|HeroMetric|MetricGroup|SectionHeader|EmptyState|testID" src/features src/components/cards
```

Expected: command lists the implemented screen structure and test IDs.

- [ ] **Step 2: Record static findings**

Update `docs/testing/issue-110-ui-parity-qa.md` with code-inspection evidence.
Use `Pass`, `Needs fix`, or `Accepted compromise`; do not leave rows as
`Pending` after this step.

- [ ] **Step 3: Identify only actionable drift**

Actionable drift examples:

```text
Settings row appears interactive but has no behavior.
Add Holding search result auto-selects without tapping Select.
Holdings row omits allocation or quote state.
Progress asset chart includes cash.
Visible label says Add Trade instead of Add Holding.
```

Expected: a short list of concrete fixes or explicit `No code drift found`.

## Task 3: Add or Adjust Tests Before Fixes

**Files:**
- Modify as needed: `src/features/**/__tests__/*.test.tsx`
- Modify as needed: `src/components/**/__tests__/*.test.tsx`

- [ ] **Step 1: Add tests for each actionable drift**

Use existing test patterns. Example for Settings deferred data action:

```tsx
it("marks destructive data action as deferred instead of active", () => {
  const { getByText } = render(<SettingsScreen store={store} />);

  expect(getByText("Clear local data")).toBeTruthy();
  expect(getByText("Deferred")).toBeTruthy();
  expect(getByText("Disabled until a confirmation flow is implemented.")).toBeTruthy();
});
```

Example for Add Holding explicit selection:

```tsx
it("does not autofill asset fields until a lookup result is selected", async () => {
  const { getByTestId, queryByDisplayValue } = render(
    <AddOpeningPositionForm
      store={store}
      searchAssetLookupResults={async () => [lookupResult]}
      resolveQuote={async () => quoteResult}
    />,
  );

  fireEvent.changeText(getByTestId("asset-lookup-input"), "hdfc");

  await waitFor(() => expect(getByTestId("asset-lookup-result-hdfc")).toBeTruthy());
  expect(queryByDisplayValue("HDFC Bank")).toBeNull();
});
```

- [ ] **Step 2: Run targeted tests and verify failure before fixes**

Run targeted tests for changed files:

```powershell
npm test -- src/features/settings/__tests__/SettingsScreen.test.tsx
npm test -- src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx
```

Expected: any new regression test for an unfixed defect fails. If there is no
code drift, skip this step and record `No new regression tests needed`.

## Task 4: Implement Minimal Parity Fixes

**Files:**
- Modify only files implicated by Task 2/3.

- [ ] **Step 1: Fix screen-local drift**

Keep each fix narrow. Examples:

```tsx
<GroupedListRow
  destructive
  icon="trash-outline"
  title="Clear local data"
  meta="Disabled until a confirmation flow is implemented."
  value="Deferred"
/>
```

```tsx
<IconButton
  accessibilityLabel="Add Holding"
  icon="add-outline"
  onPress={onAddTrade}
  testID="holdings-add-button"
/>
```

- [ ] **Step 2: Avoid scope expansion**

Before saving a fix, check it against non-goals:

```text
No Minimal Mode.
No LTCG UI.
No import/export.
No auth/backend/cloud/analytics/push.
No fake production data.
```

- [ ] **Step 3: Run targeted tests**

Run:

```powershell
npm test -- src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx src/features/holdings/__tests__/HoldingsScreen.test.tsx src/features/progress/__tests__/ProgressScreen.test.tsx src/features/settings/__tests__/SettingsScreen.test.tsx
```

Expected: all targeted tests pass.

- [ ] **Step 4: Commit fixes**

Run:

```powershell
git add src docs/testing/issue-110-ui-parity-qa.md
git commit -m "fix: close v1 ui parity gaps"
```

Expected: commit succeeds only if files changed.

## Task 5: Android Emulator QA

**Files:**
- Update: `docs/testing/issue-110-ui-parity-qa.md`

- [ ] **Step 1: Check emulator harness**

Run:

```powershell
npm run android:doctor
npm run android:smoke
npm run maestro:check
```

Expected: record PASS/WARNING/FAIL rows in the QA doc.

- [ ] **Step 2: Launch the app on emulator**

Use one of the documented loops:

```powershell
npm run start:clear
```

Then press `a`, or run:

```powershell
npm run android
```

Expected: CogVest opens on the Android emulator without Unmatched Route.

- [ ] **Step 3: Verify navigation**

Verify:

```text
Dashboard opens.
Holdings opens.
Add Holding opens from Dashboard or Holdings.
Progress opens.
Cash opens.
Settings opens.
Bottom navigation remains usable.
```

Record observations and screenshot paths if screenshots are captured.

- [ ] **Step 4: Run Maestro if available**

Run:

```powershell
npm run maestro:test
```

Expected: PASS if Maestro is installed and app is reachable. If unavailable,
record the exact reason in the QA doc.

## Task 6: Final Verification and PR

**Files:**
- Update: `docs/testing/issue-110-ui-parity-qa.md`

- [ ] **Step 1: Run static gate**

Run:

```powershell
npm run test:verify
```

Expected: typecheck, Jest, and Expo doctor pass. If Expo doctor fails due to
network access, rerun `npm run doctor` with network access and record both
results.

- [ ] **Step 2: Run diff checks**

Run:

```powershell
git diff --check
git status --short --branch
```

Expected: no whitespace errors; branch has only intended changes.

- [ ] **Step 3: Create PR**

Run:

```powershell
git push -u origin v1/issue-110-ui-parity-qa-plan
gh pr create --base main --head v1/issue-110-ui-parity-qa-plan --title "[V1] Close UI parity and emulator QA gaps" --body "## Summary
- Verified V1 screens against the accepted baseline.
- Fixed or documented remaining UI parity drift.
- Recorded emulator/static QA evidence.

## Verification
- npm run test:verify
- npm run android:doctor
- npm run android:smoke
- npm run maestro:check
- npm run maestro:test, if available

Closes #110"
```

Expected: PR opens and links issue #110 through `Closes #110`.

## Plan Self-Review

- Spec coverage: covered issue creation, baseline review, tests, fixes,
  emulator QA, documentation, and PR closure.
- Placeholder scan: no `TBD` or unresolved implementation placeholders remain.
- Scope check: this is one focused V1 parity/QA slice, not a V2/V3 feature.
- Type consistency: examples use existing screen/component names and test
  locations.
