# CogVest Versioned Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the all-in CogVest spec into versioned roadmap, prompt, design, testing, release, and GitHub execution artifacts.

**Architecture:** Documentation is the source of truth. Version specs drive prompt files, prompt files map to issue drafts, and issue drafts map to GitHub issues. External state is created only after markdown drafts are coherent.

**Tech Stack:** Markdown docs, GitHub labels/milestones/issues, Figma design file, Expo/EAS release planning.

---

### Task 1: Branch and Scope Confirmation

**Files:**
- Read: `docs/prompts/versioned-roadmap-planning-prompt.md`
- Read: `docs/cogvest-master-spec.md`
- Read: `docs/cogvest-codex-prompts.md`

- [x] Create branch `roadmap/versioned-planning` from current `main`.
- [x] Confirm V1/V2/V3 scope decisions with the user.
- [x] Record V1 release gate split.

### Task 2: Figma Design Output

**Files:**
- Create/update: `docs/design/v1-ui-mockup-plan.md`
- Create/update: `docs/design/v2-ui-mockup-plan.md`
- Create/update: `docs/design/v3-ui-mockup-plan.md`

- [x] Create a real Figma file.
- [x] Add design system page.
- [x] Add V1 page.
- [x] Add V2/V3 page within Starter plan page limit.
- [x] Link Figma file in roadmap/design docs.

### Task 3: Versioned Roadmap Specs

**Files:**
- Create: `docs/roadmap/cogvest-version-roadmap.md`
- Create: `docs/roadmap/v1-mvp-spec.md`
- Create: `docs/roadmap/v2-behaviour-spec.md`
- Create: `docs/roadmap/v3-polish-and-advanced-spec.md`

- [x] Define V1, V2, V3 goals.
- [x] List included and excluded features.
- [x] Define release gates and local data impact.
- [x] Document risks and deferred decisions.

### Task 4: Versioned Prompt Files

**Files:**
- Create: `docs/roadmap/v1-codex-prompts.md`
- Create: `docs/roadmap/v2-codex-prompts.md`
- Create: `docs/roadmap/v3-codex-prompts.md`

- [x] Break V1 into small implementation issues.
- [x] Keep V2/V3 prompts flexible.
- [x] Ensure prompts exclude out-of-version scope.

### Task 5: Testing and Release Docs

**Files:**
- Create: `docs/testing/v1-testing-plan.md`
- Create: `docs/testing/v2-testing-plan.md`
- Create: `docs/testing/v3-testing-plan.md`
- Create: `docs/release/android-release-process.md`
- Create: `docs/release/v1-release-checklist.md`
- Create: `docs/release/github-actions-drafts.md`
- Create: `docs/release/play-store-listing-draft.md`
- Create: `docs/release/privacy-policy-notes.md`

- [x] Define automated and manual testing boundaries.
- [x] Keep emulator/device testing out of default PR checks.
- [x] Define EAS preview APK and production AAB flow.
- [x] Document secrets and signing strategy.

### Task 6: Issue Drafts and GitHub State

**Files:**
- Create: `docs/issues/v1-issue-drafts.md`
- Create: `docs/issues/v2-placeholder-issues.md`
- Create: `docs/issues/v3-placeholder-issues.md`

- [x] Draft detailed V1 issues.
- [x] Draft V2/V3 placeholder issues.
- [x] Create labels.
- [x] Create milestones.
- [x] Create GitHub issues.

### Task 7: Commit, Push, and PR

**Files:**
- All generated docs.

- [ ] Run markdown consistency scans.
- [ ] Commit branch.
- [ ] Push `roadmap/versioned-planning`.
- [ ] Open PR or provide manual PR body if unavailable.
