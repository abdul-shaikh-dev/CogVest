# Progress Lower Sections Polish Design

## Goal

Refine the lower half of Monthly Progress so it supports the richer charts
without duplicating them. The screen should feel like a compact monthly
statement: charts explain trend, the lower section explains what changed, and a
small CTA leads to month-end snapshot capture.

## Accepted Direction

Use the latest compact direction from the local preview:

- Keep the `Value Gap` and `Asset Momentum` chart cards above this section.
- Remove the separate `Asset class snapshot` card from the lower area; its
  information is covered by `Asset Momentum` and the change breakdown.
- Replace `Recent snapshots` as a plain list with `Monthly Change Breakdown`.
- Allow selecting older months in the breakdown.
- Show the selected month compared with the previous month.
- Keep a compact `Month-end snapshot` CTA below the breakdown.
- Do not add mini sparklines or extra charts below the main chart cards.

## Monthly Change Breakdown

The section should answer:

- What changed this month?
- Which asset classes gained or lost value?
- How did each class compare with the previous month?
- Did allocation shift meaningfully?

Required content:

- Selected month.
- Previous month comparison.
- Total portfolio change percentage and value delta.
- Asset tiles for Equity, Debt, Crypto, and Cash where data exists.
- Per-asset-class current value.
- Per-asset-class previous value or delta.
- Per-asset-class percentage change.
- Allocation change where available.

Presentation rules:

- Prefer compact interactive month chips or a small selector.
- Use percentage change as the primary scan label.
- Keep INR values readable but secondary.
- Use Equity green, Debt blue, Crypto amber, and Cash cash-blue consistently.
- Use red only for negative movement.
- Do not make the section look like a table.
- Do not duplicate the main chart legend or render another trend graphic.

## Monthly Story Copy

Any explanatory copy must be deterministic and derived from snapshot data.

Examples:

- `Portfolio value increased 6.3% from Apr to May.`
- `Equity led the month while crypto softened.`
- `No previous snapshot available for comparison.`

Do not generate AI-written financial advice in V1. The copy should describe the
recorded data, not recommend investing actions.

## Month-End Snapshot CTA

The main Progress screen should include only a compact capture entry point.

Required behavior:

- Show whether the current month has a snapshot.
- Offer `Record snapshot` or `Review snapshot` depending on state.
- Link to the dedicated capture flow or bottom sheet owned by issue #125.
- Do not embed a large snapshot form in the main Progress review screen.

## Out of Scope

- No changes to monthly snapshot data model in this design-only spec.
- No full snapshot derivation/capture automation; that belongs to issue #125.
- No new historical market data.
- No fake production data.
- No changes to Add Holding, Dashboard, Holdings, Cash, or Settings.

## Acceptance Criteria

- Existing Progress charts remain visible and unchanged in purpose.
- The lower Progress section no longer duplicates asset trend or allocation
  data in a separate static snapshot card.
- `Monthly Change Breakdown` supports selecting older months.
- The latest selected month clearly compares against the previous month.
- Asset-class changes are percentage-first with readable INR context.
- No mini sparkline or extra chart appears below the main chart cards.
- Month-end snapshot capture is represented by a compact CTA only.
- Existing Progress tests pass.
- Typecheck passes.
