# CogVest Housekeeping App State Review Design

## Goal

Create a durable, evidence-backed snapshot of CogVest's current V1 state so the
next implementation work starts from known facts, not assumptions.

## Scope

This is a housekeeping and review task. It creates review artifacts, runs the
current verification harness, audits docs for stale guidance, maps implemented
features against V1 and Excel parity goals, and records actionable defects.

This task does not implement new product features and does not fix unrelated
bugs. If a bug is discovered, it should be logged or linked to an existing
issue unless the fix is trivial and explicitly in scope.

## Inputs

- `AGENTS.md`
- `DESIGN.md`
- `docs/roadmap/v1-mvp-spec.md`
- `docs/roadmap/cogvest-version-roadmap.md`
- `docs/testing/v1-core-flow-test-matrix.md`
- `docs/testing/v1-pc-verification-checklist.md`
- GitHub issues and PR state
- Current `app/`, `src/`, `.github/`, `e2e/`, and `docs/` tree

## Outputs

- `docs/housekeeping/current-app-state.md`
- `docs/housekeeping/verification-baseline.md`
- `docs/housekeeping/stale-doc-audit.md`
- `docs/housekeeping/code-review-findings.md`
- `docs/housekeeping/issue-triage.md`

## Review Questions

The review must answer:

- What features does the app currently have?
- Which V1/Excel parity requirements are complete, partial, missing, or blocked?
- Which bugs are known or newly discovered?
- Which docs are canonical, stale, misleading, or historical references?
- Which code risks should be fixed before continuing feature work?
- Which GitHub issues should be updated, split, closed, or created?

## Evidence Rules

- Do not mark a feature complete without code, test, or runtime evidence.
- Do not mark a verification command passing without fresh command output.
- Do not close or recommend closing an issue unless the relevant acceptance
  criteria are mapped to evidence.
- Treat docs that conflict with `AGENTS.md`, `DESIGN.md`, or the current V1
  roadmap as stale unless clearly labelled historical.

## Review Boundaries

In scope:

- V1 features and Excel tracker parity.
- Android PC test harness and local APK/E2E readiness.
- Docs and issue hygiene.
- Architecture and code quality review.
- Test coverage review.

Out of scope:

- Implementing V2 Minimal Mode.
- Implementing LTCG UI.
- Implementing import/export.
- Triggering EAS cloud builds.
- Play Store release work.
- Broad refactors without a specific defect.

## Completion Criteria

- Spec and plan are committed in the repo.
- All five housekeeping reports exist and contain evidence.
- Verification commands are run or blocked with exact reasons.
- GitHub issue state is reviewed.
- Any newly discovered actionable defects are filed or explicitly listed for
  follow-up.
- The branch is pushed and a PR is opened for review.

## Self-Review

- No placeholders remain.
- Scope is review and housekeeping only.
- Outputs are concrete files with clear ownership.
- Completion depends on evidence, not opinion.
