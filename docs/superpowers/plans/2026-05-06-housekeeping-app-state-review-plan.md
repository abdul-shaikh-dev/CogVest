# CogVest Housekeeping App State Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an evidence-backed current-state review for CogVest V1 covering implemented features, bugs, stale docs, verification status, code quality, and issue triage.

**Architecture:** This plan is docs-first and review-only. It creates focused housekeeping reports under `docs/housekeeping/`, gathers evidence from source, tests, Android harness commands, and GitHub issue state, then records findings without changing product behavior.

**Tech Stack:** Expo Router, React Native, TypeScript, Jest, Expo Doctor, Android adb/emulator harness, Maestro, GitHub CLI.

---

## Files

- Create: `docs/housekeeping/current-app-state.md`
- Create: `docs/housekeeping/verification-baseline.md`
- Create: `docs/housekeeping/stale-doc-audit.md`
- Create: `docs/housekeeping/code-review-findings.md`
- Create: `docs/housekeeping/issue-triage.md`
- Create: `docs/superpowers/specs/2026-05-06-housekeeping-app-state-review-design.md`
- Create: `docs/superpowers/plans/2026-05-06-housekeeping-app-state-review-plan.md`

## Task 1: Capture Repository and GitHub State

- [x] Run `git status --short --branch` and record branch cleanliness.
- [x] Run `git log -1 --oneline` and record the base commit.
- [x] Run `gh issue list --repo abdul-shaikh-dev/CogVest --state open --limit 100` and record open issues.
- [x] Run `gh pr list --repo abdul-shaikh-dev/CogVest --state open --limit 20` and record open PRs.
- [x] Add the results to `docs/housekeeping/issue-triage.md`.

## Task 2: Inventory Implemented Features

- [x] Inspect `app/` routes and map visible screens.
- [x] Inspect `src/features/`, `src/domain/`, `src/services/`, `src/store/`, and `src/types/`.
- [x] Map each V1 feature to code, tests, and status.
- [x] Map issue #60 Excel parity questions to done, partial, missing, or blocked.
- [x] Add the results to `docs/housekeeping/current-app-state.md`.

## Task 3: Run Verification Baseline

- [x] Run `npm run typecheck` and record the result.
- [x] Run `npm test` and record the result.
- [x] Run `npm run doctor` and record the result.
- [x] Run `npm run android:doctor` and record emulator/tool status.
- [x] Run `npm run android:smoke` and record installed app status.
- [x] Run `npm run maestro:check` and record Maestro status.
- [x] Run `npm run maestro:test` if Maestro is available and record pass/fail details.
- [x] Add the results to `docs/housekeeping/verification-baseline.md`.

## Task 4: Review Code Quality and Bugs

- [x] Review navigation routes, tab configuration, and known issue #72.
- [x] Review store persistence and selector/domain separation.
- [x] Review quote service behavior and manual fallback.
- [x] Review form validation and value masking.
- [x] Review tests for meaningful behavior coverage.
- [x] Add prioritized findings to `docs/housekeeping/code-review-findings.md`.

## Task 5: Audit Docs for Stale Guidance

- [x] Compare `AGENTS.md`, `DESIGN.md`, V1 roadmap docs, issue drafts, testing docs, and old prompt docs.
- [x] Mark docs as canonical, current-supporting, historical, stale, or misleading.
- [x] Identify conflicts around Add Trade/Add Holding, History/Progress, Minimal Mode, LTCG, Figma, and Android testing.
- [x] Add results to `docs/housekeeping/stale-doc-audit.md`.

## Task 6: Issue Triage and Follow-Up

- [x] Link known bug #72 in the reports.
- [x] Identify newly discovered issues that deserve separate GitHub bugs.
- [x] Create GitHub issues only for concrete, actionable defects with evidence.
- [x] Recommend which existing V1 issues should remain open, be updated, or be blocked.
- [x] Add results to `docs/housekeeping/issue-triage.md`.

## Task 7: Final Verification and Delivery

- [ ] Run `git diff --check`.
- [ ] Run a final `git status --short --branch`.
- [ ] Commit the housekeeping reports.
- [ ] Push the branch.
- [ ] Open a PR without a closing keyword unless a dedicated housekeeping issue exists.
