# CogVest Stale Documentation Audit

Date: 2026-05-06

Status: historical audit snapshot. Issue #74 tracks the cleanup work produced
from this audit.

## Canonical Documents

| Document | Status | Notes |
| --- | --- | --- |
| `AGENTS.md` | Canonical | Current agent rules, V1 scope boundaries, Android PC harness, and Superpowers workflow. |
| `DESIGN.md` | Canonical | Current design direction with true-dark premium UI and Android-first constraints. |
| `docs/roadmap/cogvest-version-roadmap.md` | Canonical roadmap | Current phase map. Keep aligned as V1 issues evolve. |
| `docs/roadmap/v1-mvp-spec.md` | Canonical V1 scope | Updated during #74 cleanup to prefer Add Holding and Monthly Progress for V1. |
| `docs/testing/v1-core-flow-test-matrix.md` | Current supporting doc | Useful for V1 PC verification, but should link the Excel parity checklist after #66. |
| `docs/testing/v1-pc-verification-checklist.md` | Current supporting doc | Useful for PC harness flow. |

## Historical or Potentially Misleading Documents

| Document | Status | Risk |
| --- | --- | --- |
| `docs/cogvest-codex-prompts.md` | Historical / stale | Contains old all-in prompts with V1 Minimal Mode and LTCG instructions. Conflicts with current V1 boundaries. |
| `docs/cogvest-master-spec.md` | Broad product spec | Valuable product context, but contains Minimal Mode, LTCG, and older screen language that should not be interpreted as V1 implementation scope. |
| `docs/design/v1-ui-mockup-plan.md` | Historical visual reference | Updated during #74 cleanup to point current V1 work to `DESIGN.md` and Figma issue #69 files. |
| `docs/design/v2-ui-mockup-plan.md` | Future reference | Fine for V2, but should not drive current V1 work. |
| `docs/design/v3-ui-mockup-plan.md` | Future reference | Fine for V3, but should not drive current V1 work. |
| `docs/cogvest_standard_mode.png` | Historical mockup | Older visual direction. Current Figma/code.js and `DESIGN.md` should override it. |
| `docs/cogvest_minimal_mode.png` | Historical/Future mockup | V2 reference only; not V1. |
| `docs/prompts/versioned-roadmap-planning-prompt.md` | Historical planning prompt | Useful context, not an implementation source of truth. |

## Specific Conflicts Found

| Conflict | Current source of truth | Recommended cleanup |
| --- | --- | --- |
| Add Trade vs Add Holding | `AGENTS.md`, Figma issue #69, current UI | Update V1 docs to say user-facing `Add Holding`; keep trade terminology internal where domain APIs still use `Trade`. |
| History vs Progress | `AGENTS.md` says V1 language should prefer Progress | Rename stale references from History/Progression to Progress/Monthly Progress where applicable. |
| Minimal Mode in V1 docs | `AGENTS.md` excludes Minimal Mode from V1 | Mark older Minimal Mode docs as V2-only or historical. |
| LTCG in V1 docs | `AGENTS.md` excludes LTCG UI/tax badges from V1 | Mark LTCG docs/prompts as V2/V3-only and keep V1 tests asserting no LTCG UI. |
| Old visual mockups vs Figma | `DESIGN.md` and `docs/design/figma/issue-69-v1-screens/code.js` | Add a short note in older mockup docs saying they are superseded by current Figma V1 screens. |
| Android APK testing | `AGENTS.md` and `docs/testing/android-pc-test-harness.md` | Add local release APK build notes discovered during #72 reproduction if not already documented. |

## Recommended Doc Tasks

1. Created #74 and updated old prompt/mockup docs as historical references.
2. Complete #66 with an Excel parity checklist that references #61-#65 and
   makes the #60 gate explicit.
3. Updated V1 docs to consistently use Add Holding for user-facing UI where applicable.
4. Added a local Gradle release APK note to Android PC harness docs:
   debug APK needs Metro; release APK is the standalone local install artifact.
