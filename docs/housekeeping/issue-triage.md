# CogVest Issue Triage

Date: 2026-05-06

## Repository State

- Base branch reviewed: `main`
- Base commit: `bcbeeed Merge pull request #73 from abdul-shaikh-dev/docs/superpowers-workflow-agents`
- Open PRs: none
- Branch for this review: `housekeeping/app-state-review`

## Open Issues Reviewed

| Issue | State | Recommendation |
| --- | --- | --- |
| #72 Android release APK bottom navigation bug | Open | Keep open. Confirmed by fresh Maestro run. This is the top blocker. |
| #60 Excel tracker parity MVP | Open | Keep open. Parent cannot close until #61-#66 are complete and verified. |
| #61 Opening positions | Open | Keep open. Current Add Holding is partial but does not satisfy all acceptance criteria. |
| #62 Asset metadata | Open | Keep open and do next after #72. Required for debt/sector/instrument parity. |
| #63 Debt and crypto parity | Open | Keep open. Crypto is partial; debt is missing as first-class category. |
| #64 Consolidated rollups | Open | Keep open. Core totals exist; richer rollups/allocation details remain. |
| #65 Monthly progression snapshots | Open | Keep open. Current Progress screen does not persist monthly snapshots. |
| #66 Excel parity gate docs/tests | Open | Keep open. Existing docs do not yet provide the full parity checklist. |
| #17-#21 V2 issues | Open | Leave open as future placeholders. Do not expand until V1 parity is validated. |
| #22-#26 V3 issues | Open | Leave open as future placeholders. Do not expand until V1/V2 are validated. |

## Newly Recommended Issues

### #74 [V1] Clean up stale V1 docs and historical mockup references

Why:

- `docs/cogvest-codex-prompts.md` and older mockup docs contain V1 Minimal Mode,
  LTCG, History, and Add Trade wording that conflicts with current `AGENTS.md`.
- Future agents may follow stale docs and reintroduce out-of-scope work.

Suggested acceptance criteria:

- Historical prompt docs are labelled as historical/reference-only.
- V1 docs consistently use Add Holding for user-facing UI.
- V1 docs clearly state Minimal Mode and LTCG are not V1.
- Old PNG mockups are marked superseded by `DESIGN.md` and Figma issue #69 files.

Status: Created as https://github.com/abdul-shaikh-dev/CogVest/issues/74

### #75 [V1] Wire or remove inactive Dashboard action icons

Why:

- Dashboard renders value visibility and refresh icons with button affordance but
  no `onPress` behavior.
- This creates false controls in the primary screen.

Suggested acceptance criteria:

- Value visibility icon toggles `maskWealthValues` or is removed.
- Refresh icon triggers quote refresh or is removed.
- Tests cover the chosen behavior.

Status: Created as https://github.com/abdul-shaikh-dev/CogVest/issues/75

### #76 [V1] Normalize Progress route naming

Why:

- The Progress tab is implemented in `app/(tabs)/history.tsx`, while
  `app/progress.tsx` also exists.
- This creates avoidable route/docs/E2E confusion.

Suggested acceptance criteria:

- User-facing and file-based routing are consistently named where Expo Router
  permits it.
- Maestro navigation continues to target stable `tab-progress` and
  `progress-screen` IDs.

Status: Created as https://github.com/abdul-shaikh-dev/CogVest/issues/76

## Issue Creation Status

Created:

- #74 for stale docs and historical mockup references.
- #75 for inactive Dashboard action icons.
- #76 for Progress route naming.

Updated:

- #72 with fresh housekeeping reproduction evidence from the 2026-05-06 Maestro
  run.
