# Issue 105 Monthly Progress Baseline Graphs Spec

## Goal

Implement the accepted V1 Monthly Progress graph baseline using stored monthly snapshots only.

## Problem

The current Monthly Progress screen preserves snapshot summary and form behavior, but the visual trend area is still a placeholder. Issue #102 accepted two graph areas for V1 parity:

- Portfolio vs Invested by month.
- Assets vs Months for equity, debt, and crypto.

Cash must remain visible in snapshot metrics and cash tracking, but it must not appear in the asset trend graph.

## Scope

- Add pure domain graph-data derivation for monthly snapshots.
- Render an insufficient-history chart state when fewer than two snapshots exist.
- Render `Portfolio vs Invested` for two or more stored snapshots.
- Render `Assets vs Months` for two or more stored snapshots.
- Preserve snapshot form save/update behavior.
- Preserve monthly summary, rates, and asset snapshot behavior.
- Keep production code free of fake chart history.

## Non-Goals

- No historical quote fetching.
- No V3 market history charts.
- No Minimal Mode, LTCG, import/export, backend, auth, cloud, or analytics.
- No change to monthly snapshot persistence semantics.

## Design Contract

- Follow `docs/design/v1-screen-baseline.md`.
- Use calm premium cards and readable labels.
- Keep charts lightweight and Android/Expo-friendly.
- Use existing chart dependencies only if needed; do not add heavy dependencies.

## Acceptance Evidence

- Domain tests prove chronological ordering and cash exclusion.
- Screen tests prove insufficient-history state and chart sections render.
- Existing snapshot form tests continue to pass.
- Verification commands pass before PR:
  - `npm run typecheck`
  - `npm test -- src/features/progress/__tests__/ProgressScreen.test.tsx`
  - `npm test`
  - `npm run doctor`
