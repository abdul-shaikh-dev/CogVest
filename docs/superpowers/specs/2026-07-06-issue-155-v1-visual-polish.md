# Issue #155 V1 Visual Polish Spec

## Goal

Polish CogVest V1 screens so the current functional UI feels calmer, more
premium, and more consistent with `DESIGN.md` and
`docs/design/v1-screen-baseline.md`.

This is a visual-density and presentation pass. It must not change core domain
logic, portfolio calculations, quote behavior, persistence, or navigation
scope.

## Problem

The latest seeded Android visual QA screenshots show the V1 screens are
functionally present, but the visual system still feels too inflated:

- typography is often oversized for mobile task UI
- cards and buttons are over-rounded in several places
- CTAs and chips dominate screens
- green is too visually loud on active controls and financial states
- several cards have excessive vertical whitespace
- some information truncates or wraps awkwardly
- Add Holding and Cash feel more like large forms than refined product screens

The intended V1 feeling is a private investment ledger: premium, disciplined,
low-noise, Android-first, readable, and not trading-app-like.

## Scope

Polish these current V1 surfaces:

- Dashboard
- Holdings
- Add Holding initial, lookup, and review states
- Cash Ledger
- Monthly Progress
- Settings
- Shared visual primitives used by those screens

## Non-Goals

- Do not rebalance visual QA seed data. That is tracked in #153.
- Do not change chart library or chart data semantics.
- Do not introduce new V1 features.
- Do not add V2/V3 concepts.
- Do not trigger EAS cloud builds.
- Do not replace the current app architecture or navigation.

## Design Direction

### System-Wide

- Reduce perceived UI scale by tuning shared typography, button, card, chip,
  and icon-button sizing rather than applying many one-off overrides.
- Keep true black background and dark cards.
- Use `#34C759` only for active state, primary actions, and positive financial
  values.
- Prefer tighter, durable cards over very pill-like cards.
- Use spacing rhythm that makes screens feel intentionally grouped:
  answer first, evidence second, action last.

### Dashboard

- Keep portfolio value first, but shorten the visual weight of the hero.
- Use compact INR notation for the hero where possible.
- Keep allocation compact and visual.
- Avoid an above-the-fold feeling that content is cut off or arbitrarily huge.

### Holdings

- Preserve insight cards, exposure mix, filters, and holding rows.
- Fix exposure mix truncation and row alignment.
- Make holding rows more refined: smaller icons, tighter metadata, and clearer
  value/P&L/allocation hierarchy.

### Add Holding

- Keep lookup-first and explicit-selection-first flow.
- Reduce step chip, existing asset, input, and CTA scale.
- Separate lookup results from manual fallback more clearly.
- Make review state compact and useful, with derived values in a metric grid
  instead of a tall single-column list.

### Cash Ledger

- Keep deployable capital language.
- Reduce hero dominance and metric strip crowding.
- Make deposit/withdraw controls and entry form feel like part of a ledger
  workflow, not a placeholder form.

### Monthly Progress

- Keep chart cards, local timeframe chips, and snapshot CTA.
- Reduce month-end snapshot CTA dominance above chart insights.
- Improve card rhythm without changing chart semantics.

### Settings

- Preserve local-first trust emphasis.
- Tighten card heights, line wrapping, and switch/pill alignment.

## Acceptance Criteria

- The V1 screenshots feel visibly more compact and deliberate than the current
  `docs/testing/artifacts/visual-qa/latest` baseline.
- Dashboard, Holdings, Add Holding, Cash, Progress, and Settings still satisfy
  `docs/design/v1-screen-baseline.md`.
- Green usage is calmer and more selective.
- Add Holding review uses a compact derived-preview layout.
- Holdings exposure mix no longer truncates count labels.
- Settings and Cash have less vertical inflation.
- `npm run test:v1:pc` passes.
- `npm run visual-qa:android` passes and refreshes visual evidence.

