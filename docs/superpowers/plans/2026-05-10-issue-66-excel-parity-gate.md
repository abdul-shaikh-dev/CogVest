# Issue 66 Excel Parity Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a durable Excel parity checklist and wire it into V1 testing and release gates.

**Architecture:** Keep this docs-only. Create one canonical checklist under `docs/testing/`, then update existing V1 testing and release docs to point at it instead of duplicating parity rules.

**Tech Stack:** Markdown documentation, existing npm verification scripts.

---

### Task 1: Canonical Excel Parity Checklist

**Files:**
- Create: `docs/testing/excel-parity-checklist.md`

- [x] Add purpose and scope.
- [x] Include #60 product principle.
- [x] Include #60 non-goals.
- [x] Map workbook concepts to CogVest V1 features and issues #61-#65.
- [x] Include all Excel parity gate questions.
- [x] Map each question to automated tests and manual PC verification evidence.
- [x] Add defect logging rules.

### Task 2: Link V1 Testing Docs

**Files:**
- Modify: `docs/testing/v1-testing-plan.md`
- Modify: `docs/testing/v1-core-flow-test-matrix.md`
- Modify: `docs/testing/v1-pc-verification-checklist.md`

- [x] Add `docs/testing/excel-parity-checklist.md` as the canonical Excel parity gate.
- [x] Add parity checklist to `npm run test:v1:pc` release-prep flow.
- [x] Add PC-only manual verification steps for Add Holding, Holdings, Dashboard, Cash, Progress, Settings.

### Task 3: Link Release And Roadmap Docs

**Files:**
- Modify: `docs/release/v1-release-checklist.md`
- Modify: `docs/release/android-release-process.md`
- Modify: `docs/roadmap/v1-mvp-spec.md`

- [x] Add Excel parity checklist to V1 dev-complete gate.
- [x] Clarify release-candidate remains AAB/store mechanics, not Excel parity discovery.
- [x] Remove stale risk wording that monthly snapshots are missing now that #65 is merged.

### Task 4: Verification And Delivery

**Commands:**
- `npm run typecheck`
- `npm test`
- `npm run doctor`
- `git diff --check`

- [x] Verify all commands.
- [ ] Commit on `v1/issue-66-excel-parity-gate`.
- [ ] Push and open PR with `Closes #66`.
