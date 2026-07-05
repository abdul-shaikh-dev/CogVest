# Issue #132 V1 Screen Baseline Verification Spec

## Goal

Close issue #132 by proving the accepted V1 screen baseline is usable,
servable, referenced by current V1 docs, and verified against a seeded Android
emulator run.

## Scope

This is a verification and closeout issue. It should not redesign screens or
add new product behavior unless a small direct mismatch blocks the verification
contract.

In scope:

- Verify the research preview can be served locally.
- Verify the current Android app can be seeded with V1 visual QA data.
- Capture Android screenshots for the V1 screen set.
- Compare evidence against `docs/design/v1-screen-baseline.md`.
- Update docs or issue tracker checkboxes if the baseline is confirmed.
- Log focused `[V1 QA]` follow-up issues for material mismatches.

Out of scope:

- New visual redesign work.
- New app features.
- EAS cloud builds.
- V2/V3 issue expansion.
- Pixel-perfect matching against old mockups or stale drafts.

## Baseline References

- Issue: #132 `[V1] Track research-based V1 screen preview`
- Tracker: #136 `[V1] Organize remaining screen work and execution order`
- Design baseline: `docs/design/v1-screen-baseline.md`
- Research preview: `docs/design/v1-research-preview/index.html`
- Research preview notes: `docs/design/v1-research-preview/README.md`
- Seeded visual QA docs: `docs/testing/seeded-visual-qa.md`
- PC verification checklist: `docs/testing/v1-pc-verification-checklist.md`

## Verification Contract

### Preview Server

`npm run preview:v1:research:start` must start the static preview and
`npm run preview:v1:research:status` must confirm it is running. The served URL
is `http://127.0.0.1:4175`.

If the server cannot start, fix only the preview server harness or document the
exact blocker.

### Seeded Android Visual QA

`npm run visual-qa:android` should seed the emulator and capture screenshots
under `docs/testing/artifacts/visual-qa/latest`.

Expected screen evidence:

- Dashboard
- Holdings
- Add Holding lookup/selection state
- Add Holding review state
- Progress
- Cash
- Settings

If the script fails because the app is not installed or the emulator is not
ready, refresh the local Android build/install path documented in the Android
PC harness. Do not run EAS.

### Screen Baseline Comparison

Compare screenshots and UI evidence against the baseline contract:

- Dashboard answers portfolio value, invested value, P&L, allocation, quotes,
  and next useful action.
- Holdings focuses on position review, insight cards, exposure mix, smart
  filters, holding cards, and Add Holding entry.
- Add Holding remains assisted capture with explicit selection, metadata
  confirmation, position details, derived preview, and review/save.
- Progress shows Value Gap, Asset Momentum, Monthly Change Breakdown, month
  controls, and compact snapshot CTA.
- Cash Ledger presents deployable capital, cash movement, entry actions, and
  recent movement.
- Settings presents local-first trust, value masking, quote source/fallback,
  currency/app info, and separated deferred/destructive data action.

Do not require exact pixel parity. Require product and hierarchy parity.

## Defect Policy

Create a focused GitHub issue when a mismatch:

- affects user understanding of a V1 screen,
- contradicts `docs/design/v1-screen-baseline.md`,
- blocks Excel tracker parity,
- makes a supported action appear unsupported, or
- makes an unsupported/deferred action look active.

Use title prefix `[V1 QA]`.

Minor spacing differences, harmless copy differences, or platform-native
rendering differences should be recorded in the closeout note, not split into
issues.

## Acceptance Criteria

- Preview server starts and status command confirms it.
- Seeded Android visual QA runs or a precise blocker is documented.
- Screenshot evidence exists for all V1 screens listed above.
- `docs/design/v1-screen-baseline.md` has no obvious stale contradiction with
  the current implemented app.
- Issue #136 marks #132 complete only after evidence is captured.
- Issue #132 can be closed with evidence links and any follow-up defects linked.
- `npm run test:v1:pc` passes before PR.

## Risks

- The emulator may have an older installed build. Mitigation: rebuild/install
  locally with `npm run android` or the documented local APK path before visual
  QA.
- Preview server port 4175 may be occupied. Mitigation: stop the existing
  preview server using `npm run preview:v1:research:stop`, then start again.
- Visual QA may expose real drift. Mitigation: create focused follow-up issues
  rather than expanding #132 into broad redesign work.
