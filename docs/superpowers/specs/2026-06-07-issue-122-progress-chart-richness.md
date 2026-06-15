# Issue 122 Progress Chart Richness Spec

## References

- GitHub issue: #122, `[V1] Make Monthly Progress charts richer and more useful`
- Future follow-up: #129, `[Future] Add custom date-range filtering for Monthly Progress charts`
- Design baseline: `docs/design/v1-screen-baseline.md`
- Current V1 research preview: `docs/design/v1-research-preview/index.html`
- Current V1 research preview notes: `docs/design/v1-research-preview/README.md`
- Design rules: `DESIGN.md`
- App-wide UX research baseline: `docs/design/v1-ux-research-baseline.md`

## Problem

The current Monthly Progress charts meet the basic V1 visual direction, but they
do not yet give the user enough diagnostic context. The charts should help the
user answer what changed, whether growth came from new investment or portfolio
movement, and which asset class drove the latest monthly change.

CogVest must not become a spreadsheet UI, but it should preserve the tracking
power of the user's Excel workbook. The chart area should feel premium and
useful, not decorative.

## Goals

- Make the Monthly Progress chart section content-rich without making it noisy.
- Preserve the accepted V1 graph structure:
  - Chart 1: total portfolio value vs invested value over months.
  - Chart 2: asset values vs months for Equity, Debt, and Crypto. Cash remains
    excluded from this chart.
- Add clear static insight context so the charts are useful even without touch
  interaction.
- Add lightweight timeframe presets: `3M`, `6M`, `1Y`, and `All`.
- Place timeframe presets inside each chart card, not above the whole screen, so
  users can change a chart range without scrolling away from the chart.
- Add long-press chart pointer support only as a progressive enhancement.
- Use stored monthly snapshots only. Do not fake production history.

## Non-Goals

- Do not add custom start/end date selection in #122. That is tracked by #129.
- Do not implement V3 historical charting beyond stored monthly snapshots.
- Do not add broker-grade attribution, advanced analytics, or tax logic.
- Do not change the monthly snapshot data capture flow. That belongs to issue
  #125.
- Do not add demo-only or hardcoded production values to make charts look full.

## Product Direction

The chart section should optimize for trend diagnosis using the final refined
Option B direction from the preview phase: Option C's useful information
density, reduced into a calmer V1 statement-summary screen.

The user should be able to look at Monthly Progress and quickly understand:

- Is portfolio value ahead of invested value?
- How large is the value gap?
- How much did the portfolio move this month?
- How much of that movement appears to be new investment versus market or price
  movement?
- Which asset class changed the most recently?
- How did Equity, Debt, and Crypto trend over the selected period?

The agreed final visual direction is:

- Top summary row: `Portfolio`, `Monthly gain`, `Monthly investment`, and
  `Value move`.
- Chart 1 card title: `Value Gap`.
- Chart 1 subtitle: `Portfolio value against invested capital`.
- Chart 1 headline pill: a signed value-gap percentage, for example `+15.8%`.
- Chart 2 card title: `Asset Momentum`.
- Chart 2 subtitle: `Absolute value trend - cash excluded`.
- Chart 2 headline pill: the clearest recent asset percentage movement, for
  example `Equity +4.9%` or `Crypto -0.8%`.
- Each chart card owns its own `3M`, `6M`, `1Y`, and `All` timeframe selector.
- Both charts show y-axis value labels and sparse chart-native x-axis month
  labels. For longer ranges, show first, middle, and latest month labels instead
  of every month.
- Do not include the separate `Largest move` driver banner from the exploratory
  preview.
- Do not include the redundant mini row under the portfolio chart; the top
  summary and chart pill already carry that information.
- Keep deterministic explanatory copy near the charts. Do not generate
  investment advice or AI-written market commentary in V1.

## Data Rules

Persisted monthly snapshots remain the source of truth. Chart data and insight
data are derived from snapshots.

The chart domain layer should derive:

- Selected snapshot range.
- Portfolio series for `Portfolio` and `Invested`.
- Asset series for `Equity`, `Debt`, and `Crypto`.
- Portfolio insight summary.
- Asset insight summary.
- Largest recent asset move.

Cash is excluded from the asset trend chart. Cash can still be used for
allocation denominator context when calculating latest allocation percentages,
matching existing portfolio allocation behavior.

## Timeframe Presets

Supported presets:

- `3M`: latest three available monthly snapshots.
- `6M`: latest six available monthly snapshots.
- `1Y`: latest twelve available monthly snapshots.
- `All`: all available monthly snapshots.

Default behavior:

- If six or fewer snapshots exist, default to `All`.
- If more than six snapshots exist, default to `6M`.

If fewer snapshots exist than the selected preset, show the available snapshots
honestly. Do not pad or fake missing months.

## Portfolio Chart

Chart 1 title:

`Value Gap`

Subtitle:

`Portfolio value against invested capital`

Series:

- Portfolio value: CogVest green line.
- Invested value: subdued white/neutral line.

Static insight context:

- Latest portfolio value.
- Latest invested value.
- Signed value gap percentage as the card headline pill. Positive means
  portfolio value is greater than invested value; negative means portfolio value
  is below invested value.
- Latest monthly gain/loss.
- Latest monthly investment.
- Value move.

`Value move` means:

`latest monthly portfolio change - latest monthly investment`

This must be labelled as an inferred value movement, not as guaranteed market
return.

Visual treatment:

- Use deep black screen background.
- Use elevated dark card surface.
- Use restrained green for invested line and positive context.
- Use red only for negative value gap, monthly loss, or negative implied
  movement.
- Use subtle area/glow fill under the portfolio and invested trend lines.
- Show y-axis value labels and month labels.
- Keep card readable without needing a legend hunt.

## Asset Chart

Chart 2 title:

`Asset Momentum`

Subtitle:

`Absolute value trend - cash excluded`

Series:

- Equity: green.
- Debt: blue.
- Crypto: amber.
- Cash: excluded.

Static insight context:

- Latest value per asset class.
- Latest monthly delta per asset class.
- Latest monthly percentage movement per asset class.
- Latest allocation percentage per asset class.
- Allocation shift since previous snapshot.
- Largest recent percentage movement summary as the headline pill, for example
  `Equity +4.9%`.

The main chart should show absolute INR values over months. Allocation
percentages, allocation share shift, and exact INR movement should appear in
compact rows under the chart, not as separate plotted series.

Visual treatment:

- Equity line: green.
- Debt line: blue.
- Crypto line: amber.
- Use subtle per-series area/glow fill under each line.
- Show y-axis value labels and month labels.
- Keep exact movement amounts in rows; keep the card headline pill as a
  percentage movement for quick comparison.

## Interaction

Use the current `react-native-gifted-charts` line-chart implementation. Do not
use Victory Native for the V1 Monthly Progress charts. Long-press pointer
support is a progressive enhancement if it works reliably on Android.

Requirements:

- The charts must remain understandable without long-press.
- Long-press labels should show month and INR value where feasible.
- If pointer behavior is flaky on Android, keep the static rich chart and log the
  pointer limitation as deferred polish.

## Empty and Sparse States

When there are no monthly snapshots:

- Show the existing premium empty state.
- Invite the user to record the first monthly snapshot.

When there is one monthly snapshot:

- Show the latest snapshot context if available.
- Explain that at least two snapshots are needed for a trend.

When the selected range has fewer than two snapshots:

- Keep the selected range visible.
- Show an honest insufficient-history message.

## UI Requirements

The Monthly Progress screen should include:

- A compact timeframe selector inside each chart card using `3M`, `6M`, `1Y`,
  `All`.
- A top metric row with `Portfolio`, `Monthly gain`, `Monthly investment`, and
  `Value move`.
- A portfolio chart card with static insight context above or below the chart.
- An asset chart card with static insight context above or below the chart.
- A lower `Monthly Change Breakdown` section that compares selected month
  values with the previous month without duplicating the chart data.
- A compact month-end snapshot CTA only; the full snapshot capture flow belongs
  to issue #125.
- Y-axis value labels and sparse chart-native x-axis month labels for both
  charts.
- Calm typography, premium spacing, and low-noise labels.
- Accessible labels for range chips and chart cards.

Avoid:

- Dense spreadsheet-like columns.
- Overloaded legends.
- Excessive badges.
- Fake chart lines in production empty states.

## Testing Requirements

Add or update domain tests for:

- Timeframe preset filtering.
- Default range selection.
- Portfolio value gap and gap percentage.
- Latest monthly investment and value move.
- Asset series excluding cash.
- Asset latest values, deltas, percentage movement, allocation percentage,
  allocation shift, and largest recent percentage move.
- Sparse snapshot behavior.

Add or update screen tests for:

- Timeframe chips render.
- Tapping a timeframe updates visible chart context.
- Portfolio insight labels render from stored snapshots.
- Asset insight labels render from stored snapshots.
- Insufficient-history state remains honest.

Use seeded visual QA data only in testing/dev harnesses, not production app data.

## Verification

Run:

- `npm run typecheck`
- `npm test`
- `npm run doctor`

If emulator is available, also run:

- `npm run android`
- `npm run visual-qa:android`

Capture or review Android visual evidence for:

- Monthly Progress with populated six-month data.
- Monthly Progress with sparse data.
- Timeframe chip behavior.
- No app crash on chart interaction.

## Acceptance Criteria

- Monthly Progress has richer chart context while staying calm and premium.
- `Value Gap` clearly shows portfolio vs invested, signed value-gap
  percentage, y-axis values, month labels, and value move context.
- `Asset Momentum` clearly shows Equity, Debt, and Crypto trends without cash,
  including largest percentage movement and exact INR movement rows.
- Timeframe presets work and do not fake missing history.
- Timeframe presets live inside each chart card.
- Long-press pointer is implemented or explicitly documented as deferred if
  Android reliability blocks it.
- All chart values come from stored monthly snapshots.
- Typecheck, tests, and Expo doctor pass or failures are documented.
- Android visual QA is run when emulator access is available.

## Known Gaps — Deferred (not in #122 scope)

Identified 2026-06-13 during chart review. Out of scope for #122 and not owned by
any current issue; recorded here for a future chart/polish issue:

- Value masking does not extend to the chart y-axis. The axis labels call
  `formatCompactINR` directly (`getYAxisLabels` / `formatYLabel` in
  `ProgressScreen.tsx`), so INR magnitudes stay visible even when
  `maskWealthValues` is on. The metric cards mask correctly; the chart axis does
  not.
- Chart animation (`isAnimated` on the gifted-charts `LineChart`) is not gated on
  the OS reduced-motion setting, which DESIGN.md §7 requires.
