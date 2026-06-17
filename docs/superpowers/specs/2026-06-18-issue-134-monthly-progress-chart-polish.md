# Issue 134 Monthly Progress Chart Polish Design

## Context

Issue #134 is a narrow follow-up to the V1 Monthly Progress chart work. The chart feature is already implemented with `react-native-gifted-charts`; this task only closes privacy, motion, and visual-contract gaps without redesigning the Progress screen.

## Goals

- Mask Monthly Progress chart axis/chart labels whenever value masking is enabled.
- Respect reduced-motion accessibility preferences for chart animation.
- Lock the accepted preview color contract: Portfolio line is green, Invested line is white.
- Keep V1 on `react-native-gifted-charts`; do not introduce Victory Native or a new chart library.

## Non-Goals

- Do not redesign the Monthly Progress screen.
- Do not change chart data/domain calculations.
- Do not add custom date ranges or advanced chart interactions.
- Do not change existing metric-card masking behavior.

## Design

### Chart Privacy

`ProgressScreen` will pass the current `maskWealthValues` preference into the chart section. The chart y-axis labels and Gifted chart `formatYLabel` formatter will return a stable masked label when masking is enabled, so readable INR magnitudes are not exposed by either the custom y-axis or chart-native labels.

The masked chart label should be intentionally coarse, not value-shaped. Use a compact placeholder such as `₹••••` for chart axis/tooltip labels. Percent values, chart titles, timeframe labels, and non-wealth copy remain visible.

### Reduced Motion

Add a tiny shared hook that reads `AccessibilityInfo.isReduceMotionEnabled()` and listens for `reduceMotionChanged`. `ProgressScreen` will use it and pass `isAnimated={!reduceMotionEnabled}` to both Gifted chart variants.

The hook belongs under `src/hooks/` because reduced-motion behavior will likely be reused by future UI polish, but this issue only wires it to Monthly Progress charts.

### Chart Color Contract

The accepted V1 preview uses Portfolio as the green line and Invested as the white line. `getSeriesColor("Portfolio")` will return `colors.primary`; `getSeriesColor("Invested")` will return `colors.text.primary`. Asset chart colors stay unchanged.

Update `docs/design/v1-screen-baseline.md` to make this color contract explicit.

## Testing Strategy

- Extend the existing Gifted chart Jest mock to expose props via testIDs.
- Add Progress screen tests that verify:
  - masked custom y-axis labels are rendered when masking is on;
  - Gifted chart `formatYLabel` returns a masked label when masking is on;
  - Portfolio/Invested color props match the accepted contract;
  - reduced motion disables `isAnimated`.
- Run full typecheck, Jest, Expo doctor, and Android smoke before completion.
