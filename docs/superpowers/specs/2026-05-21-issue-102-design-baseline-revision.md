# Issue #102 Design Baseline Revision Spec

## Goal

Align CogVest's current V1 design baseline with the refined May 21, 2026 HTML
mockup direction while preserving the existing V1 product scope, Excel parity
requirements, and Issue #86 Add Holding/state coverage.

## Decision

The refined mockup becomes the visual reference for the next design pass because
it improves:

- screen rhythm and hierarchy
- Holdings density without reverting to spreadsheet UI
- quote freshness, loading, and stale-price communication
- Cash Ledger entry and empty-state treatment
- Settings trust and grouped-control treatment
- P&L context labels such as `since first buy` and `all time`

The repo remains the stable design source. The external HTML mockup is an input
reference; revised repo docs, preview assets, and Figma/plugin output must carry
the final V1 baseline forward.

## Design Direction

Adopt from the refined mockup:

- portfolio-first dashboard hierarchy with quieter supporting metrics
- durable-position Holdings cards with quantity, average cost, current price,
  P&L, allocation context, and quote state visible in a controlled density
- Holdings header Add Holding entry point rather than forcing Add into the main
  bottom navigation
- local-first trust copy and grouped controls in Settings
- focused Cash Ledger entry and empty-state treatment
- first-class loading and stale/manual quote states

Keep the CogVest direction from `DESIGN.md`:

- calm, premium, Android-first, local-first portfolio tracking
- long-term investing emphasis over trading energy
- readable, maskable, INR-first financial values
- restrained green accent use
- no spreadsheet clone UI

## V1 Scope Guardrails

### Add Holding

Keep the lookup-first multi-phase flow from the current design baseline:

1. Asset lookup and selection
2. Classification
3. Position details
4. Review and save

Manual ticker/current-price entry remains fallback behavior, not the primary
perceived path.

### Progress

The refined line-chart treatment is useful visual research, but historical
charting must not become an implicit V1 requirement.

V1 Monthly Progress stays focused on:

- monthly snapshot context
- monthly change and contribution data
- snapshot entry where required
- calm no-snapshot or insufficient-data states

If later V1 work uses a chart-like placeholder, it must not fake stored history
or reopen V3 historical chart scope.

### Portfolio Context

A `Local portfolio` marker is useful. Do not use a dropdown affordance or imply
multi-portfolio interaction unless that capability exists in the scoped work.

### Palette

Use current `DESIGN.md` tokens as the implementation contract for now. The design
pass may explore the refined mockup's softer graphite layering, but any token
change must update `DESIGN.md` before downstream UI implementation depends on it.

## Design Assets To Reconcile

- `docs/design/issue-86-premium-preview/`
- `docs/design/figma/issue-69-v1-screens/`
- current Figma Issue #86 V1 screens
- related V1 design guidance that points future UI work at a source of truth

## Required Coverage

The revised V1 baseline must represent:

- Dashboard
- Holdings
- Add Holding lookup, position, and review states
- Monthly Progress
- Cash Ledger
- Settings
- empty portfolio or empty holdings state
- quote lookup loading state
- stale/manual/provider-failure quote state
- no monthly snapshots state

## Non-Goals

- No app feature implementation in this design-baseline pass.
- No Minimal Mode.
- No LTCG UI.
- No V3 historical charts or advanced market screens.
- No multi-portfolio feature design unless separately scoped.
- No loss of Excel parity concepts just to simplify visual layout.

## Acceptance Criteria

- Issue #102 points future work at one stable V1 design-baseline pass.
- Repo design assets make the refined visual direction explicit.
- Dashboard, Holdings, Cash, and Settings incorporate the improved hierarchy and
  density decisions where appropriate.
- Add Holding remains covered as a lookup-first multi-phase flow.
- Holdings includes loading and stale/manual quote design references.
- Monthly Progress scope stays explicit and does not promote historical charting
  into V1 by accident.
- Any palette-token change is recorded in `DESIGN.md` before implementation uses
  it.

