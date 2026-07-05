# Issue #132 V1 Screen Baseline Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify and close the V1 research-based screen baseline with local preview evidence, seeded Android screenshots, updated tracker state, and passing V1 PC checks.

**Architecture:** This branch is a verification closeout. It uses existing preview and visual QA harnesses, then records evidence and tracker updates without changing app behavior unless a small direct blocker is found.

**Tech Stack:** Expo SDK 54, React Native, Android Emulator, adb, Jest, Expo doctor, repo preview server, GitHub CLI.

---

## File Structure

- Create: `docs/superpowers/specs/2026-07-06-issue-132-v1-screen-baseline-verification.md`
  - Defines #132 verification scope, baseline references, acceptance criteria,
    and defect policy.
- Create: `docs/superpowers/plans/2026-07-06-issue-132-v1-screen-baseline-verification.md`
  - Defines the exact verification steps for this branch.
- Modify if evidence requires it: `docs/testing/seeded-visual-qa.md`
  - Only update if command behavior or evidence location differs from current
    docs.
- Modify if closeout requires it: GitHub issue #136
  - Mark #132 complete only after visual QA evidence exists.
- Modify if closeout requires it: GitHub issue #132
  - Add evidence summary and close once accepted criteria are met.

## Task 1: Commit Spec And Plan

**Files:**

- Create: `docs/superpowers/specs/2026-07-06-issue-132-v1-screen-baseline-verification.md`
- Create: `docs/superpowers/plans/2026-07-06-issue-132-v1-screen-baseline-verification.md`

- [ ] **Step 1: Review staged diff**

Run:

```powershell
git diff -- docs/superpowers/specs/2026-07-06-issue-132-v1-screen-baseline-verification.md docs/superpowers/plans/2026-07-06-issue-132-v1-screen-baseline-verification.md
```

Expected: diff contains only #132 spec and plan docs.

- [ ] **Step 2: Commit spec and plan**

Run:

```powershell
git add docs/superpowers/specs/2026-07-06-issue-132-v1-screen-baseline-verification.md docs/superpowers/plans/2026-07-06-issue-132-v1-screen-baseline-verification.md
git commit -m "Add V1 screen baseline verification plan"
```

Expected: commit succeeds on `v1/issue-132-screen-baseline-verification`.

## Task 2: Verify Research Preview Server

**Files:**

- Read: `docs/design/v1-research-preview/README.md`
- Read: `scripts/preview-server.mjs`

- [ ] **Step 1: Stop stale preview server**

Run:

```powershell
npm run preview:v1:research:stop
```

Expected: command exits successfully even if no server is running.

- [ ] **Step 2: Try background preview server**

Run:

```powershell
npm run preview:v1:research:start
```

Expected: preview server starts for `http://127.0.0.1:4175`.

- [ ] **Step 3: Check background status**

Run:

```powershell
npm run preview:v1:research:status
```

Expected: status reports a running server and the preview URL.

- [ ] **Step 4: If background mode is killed by the managed Windows shell, start a top-level foreground server**

Run only if Step 2 or Step 3 fails because the child process exits immediately:

```powershell
$p = Start-Process -FilePath node -ArgumentList 'scripts/preview-server.mjs','serve' -WorkingDirectory (Get-Location) -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2
```

Expected: a top-level Node process serves the preview.

- [ ] **Step 5: Smoke the URL**

Run:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4175 | Select-Object StatusCode
```

Expected: status code is `200`.

- [ ] **Step 6: Stop fallback process if one was started**

Run only if Step 4 was used:

```powershell
Stop-Process -Id $p.Id
```

Expected: the fallback preview server stops cleanly after verification.

## Task 3: Refresh Android Build If Needed

**Files:**

- Read: `docs/testing/android-pc-test-harness.md`
- Read: `docs/testing/seeded-visual-qa.md`

- [ ] **Step 1: Check emulator and package**

Run:

```powershell
adb devices
npm run android:smoke -- --strict
```

Expected: `emulator-5554 device` and package `com.abdulshaikh.cogvest` found.

- [ ] **Step 2: Reinstall current app only if smoke fails or visual QA shows stale UI**

Run only if needed:

```powershell
npm run android
```

Expected: local Android build installs on the emulator. If this times out after
the package installs, verify with:

```powershell
adb -s emulator-5554 shell dumpsys package com.abdulshaikh.cogvest | Select-String lastUpdateTime
```

## Task 4: Run Seeded Android Visual QA

**Files:**

- Read: `scripts/android-visual-qa.mjs`
- Read: `docs/testing/seeded-visual-qa.md`
- Output: `docs/testing/artifacts/visual-qa/latest`

- [ ] **Step 1: Run visual QA**

Run:

```powershell
npm run visual-qa:android
```

Expected: command prints `DONE Android seeded visual QA screenshots captured`.

- [ ] **Step 2: List artifacts**

Run:

```powershell
Get-ChildItem docs/testing/artifacts/visual-qa/latest
```

Expected: screenshot files exist for Dashboard, Holdings, Add Holding states,
Progress, Cash, and Settings.

- [ ] **Step 3: Inspect screenshots**

Open the screenshots with the local image viewer or `view_image` tool.

Expected: screenshots are not blank, not Metro error screens, not ANR dialogs,
and not stale pre-redesign screens.

## Task 5: Compare Evidence Against Baseline

**Files:**

- Read: `docs/design/v1-screen-baseline.md`
- Read: `docs/design/v1-research-preview/README.md`
- Output if needed: GitHub `[V1 QA]` issues

- [ ] **Step 1: Check Dashboard**

Expected:

- portfolio value/invested/P&L appear before secondary sections
- allocation is compact and visual
- quote freshness is calm
- next useful action is wired copy, not a dead generic action

- [ ] **Step 2: Check Holdings**

Expected:

- position-review insight band appears
- exposure mix appears
- Add Holding entry exists
- holding rows show current value, invested value, P&L, allocation, and quote
  state without spreadsheet density

- [ ] **Step 3: Check Add Holding**

Expected:

- lookup flow requires selection
- review state shows selected asset, metadata confirmation, position details,
  derived preview, and review/save flow
- manual fallback remains secondary

- [ ] **Step 4: Check Progress**

Expected:

- Value Gap chart uses Portfolio and Invested
- Asset Momentum chart excludes Cash
- Monthly Change Breakdown is present
- compact snapshot CTA is present instead of full inline snapshot form

- [ ] **Step 5: Check Cash**

Expected:

- cash balance/deployable capital is clear
- movement entries are meaningful
- deposit and withdrawal are distinct
- cash does not feel like a placeholder ledger

- [ ] **Step 6: Check Settings**

Expected:

- local-first trust is visible
- value masking preview/control is visible
- quote source and manual fallback are visible
- unsupported/deferred data action is clearly separated

- [ ] **Step 7: Create defects for blockers**

For each blocker, run:

```powershell
gh issue create --title "[V1 QA] <specific screen mismatch>" --body "<environment, repro, expected, actual, evidence path, baseline section>"
```

Expected: every material mismatch has a linked issue. If no material mismatch
exists, no defect issue is created.

## Task 6: Update Tracker And Closeout Issue

**Files:**

- Modify through GitHub CLI: issue #136
- Modify through GitHub CLI: issue #132

- [ ] **Step 1: Update #136**

Mark #132 complete in issue #136 only after Tasks 2-5 are complete.

Expected: #136 checklist changes from `- [ ] #132` to `- [x] #132`.

- [ ] **Step 2: Comment on #132 with evidence**

Use a comment containing:

- preview URL/status evidence
- visual QA artifact path
- test command results
- defects created or `No blocker defects found`

Expected: issue #132 has enough evidence to understand why it can close.

- [ ] **Step 3: Close #132**

Run:

```powershell
gh issue close 132 --comment "Closed by V1 screen baseline verification evidence in PR #<pr-number>."
```

Expected: #132 is closed after PR merge, or left open with a PR comment if the
team wants auto-close via PR body. Prefer PR auto-close if the closeout commit
is still in review.

## Task 7: Final Verification And PR

**Files:**

- Read: `package.json`

- [ ] **Step 1: Run full V1 PC gate**

Run:

```powershell
npm run test:v1:pc
```

Expected: typecheck, Jest, Expo doctor, Android doctor, and strict installed-app
smoke all pass.

- [ ] **Step 2: Check diff hygiene**

Run:

```powershell
git diff --check
git status --short --branch
```

Expected: no whitespace errors; only intentional files are changed.

- [ ] **Step 3: Commit remaining docs or evidence changes**

Run only if files changed:

```powershell
git add <changed-files>
git commit -m "Verify V1 screen baseline"
```

Expected: focused commit with no generated binary screenshots unless the repo
already tracks that artifact path intentionally.

- [ ] **Step 4: Push and create PR**

Run:

```powershell
git push -u origin v1/issue-132-screen-baseline-verification
gh pr create --base main --head v1/issue-132-screen-baseline-verification --title "[V1] Verify screen baseline" --body "<summary, test plan, evidence, Closes #132>"
```

Expected: PR is created and body includes `Closes #132`.

## Self-Review

- Spec coverage: plan covers preview server, seeded visual QA, baseline
  comparison, tracker updates, defect policy, and V1 PC verification.
- Placeholder scan: no `TBD`, `TODO`, or vague implementation instructions.
- Scope check: no app feature implementation is required unless direct
  verification blockers appear.
