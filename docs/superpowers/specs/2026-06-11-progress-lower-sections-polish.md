# Progress Lower Sections Polish Design

## Goal

Improve the `Asset class snapshot` and `Recent snapshots` sections on Monthly
Progress so the data feels premium, clear, and visually useful without adding
new product scope.

## Accepted Direction

Use the Option B visual direction from the local brainstorm preview:

- Keep the existing `Value Trend` and `Asset Trend` chart cards above these
  sections.
- Redesign `Asset class snapshot` as a portfolio composition card with a visual
  allocation treatment and compact legend.
- Redesign `Recent snapshots` as a premium month-summary list.
- Do not add a mini sparkline or extra chart inside `Recent snapshots`; the main
  chart cards already own trend visualization.

## Asset Class Snapshot

The section should feel more like a composition summary than a plain list.

Required content:

- Equity, Debt, Crypto, and Cash.
- Current value for each class.
- Allocation percentage for each class.
- Clear color mapping that matches the Progress charts and CogVest design:
  Equity green, Debt blue, Crypto amber, Cash cash-blue.

Presentation rules:

- Prefer a compact donut or composition visual with a clean legend.
- Keep numbers readable and INR-first.
- Avoid spreadsheet/table styling.
- Do not make the card noisy or trading-app-like.

## Recent Snapshots

The section should summarize recent month-end records in a scannable, premium
list.

Required content:

- Month label.
- Portfolio value.
- Monthly gain/loss.
- Optional note when present.
- Monthly investment may be included only if it improves clarity.

Presentation rules:

- Feature the latest month slightly more strongly than older months.
- Use clean rounded month rows/cards.
- Use green/red for gain/loss, but do not rely on color alone.
- Do not render another chart or sparkline in this section.
- Keep the section calm and compact.

## Out of Scope

- No changes to monthly snapshot data model.
- No new chart library work.
- No new historical market charts.
- No fake production data.
- No changes to Add Holding, Dashboard, Holdings, Cash, or Settings.

## Acceptance Criteria

- Existing Progress charts remain visible and unchanged in purpose.
- `Asset class snapshot` is visually richer than the current row list.
- `Recent snapshots` is more premium and readable than the current row list.
- No duplicate trend visualization appears below the main charts.
- Existing Progress tests pass.
- Typecheck passes.
