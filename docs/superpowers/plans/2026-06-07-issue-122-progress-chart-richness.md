# Issue 122 Progress Chart Richness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Monthly Progress charts richer and more useful for V1 by implementing the agreed research preview direction: `Value Gap` and `Asset Momentum` cards with chart-local timeframe presets, signed percentage headline pills, readable axes, useful top metrics, and stored-snapshot-only data.

**Architecture:** Extend the monthly progress chart domain selector first, then pass derived chart state through `useProgress`, then update `ProgressScreen` presentation components. Keep all calculations in `src/domain/`; keep React components focused on rendering and UI state.

**Tech Stack:** React Native, Expo SDK 54, TypeScript, Expo Router, Zustand, Jest, React Native Testing Library, react-native-gifted-charts.

---

## Task 1: Add Domain Tests for Chart Range and Insights

- [ ] Open `src/domain/calculations/__tests__/monthlyProgressCharts.test.ts`.
- [ ] Add tests before implementation for timeframe filtering:
  - `3M` returns the latest three available snapshots.
  - `6M` returns the latest six available snapshots.
  - `1Y` returns the latest twelve available snapshots when available.
  - `All` returns all snapshots.
  - Default range is `All` for six or fewer snapshots and `6M` for more than six.
- [ ] Add portfolio insight tests:
  - latest portfolio value equals latest snapshot `portfolioValue`.
  - latest invested value equals latest snapshot `investedValue`.
  - value gap equals `latestPortfolioValue - latestInvestedValue`.
  - value gap percentage is based on latest invested value.
  - latest monthly gain equals latest portfolio value minus previous portfolio
    value.
  - `valueMove` equals latest monthly gain minus latest monthly investment.
- [ ] Add asset insight tests:
  - asset series includes Equity, Debt, Crypto.
  - asset series excludes Cash.
  - latest asset delta equals latest asset value minus previous asset value.
  - latest asset percentage movement is based on previous asset value.
  - allocation percentage uses latest total asset snapshot including cash.
  - allocation shift compares latest allocation percentage to previous snapshot.
  - largest recent percentage move is the asset class with the highest absolute
    percentage movement.
- [ ] Add sparse-state tests:
  - zero snapshots return `hasEnoughHistory: false`.
  - one snapshot returns latest context but no trend-ready state.

Expected failing command:

```powershell
npm test -- --runInBand src/domain/calculations/__tests__/monthlyProgressCharts.test.ts
```

Expected result before implementation: new tests fail because chart range and
insight fields do not exist yet.

## Task 2: Extend Monthly Progress Chart Domain Selector

- [ ] Edit `src/domain/calculations/monthlyProgressCharts.ts`.
- [ ] Add exported range type:

```ts
export type MonthlyChartRange = "3M" | "6M" | "1Y" | "All";
```

- [ ] Add exported constants:

```ts
export const MONTHLY_CHART_RANGES: MonthlyChartRange[] = ["3M", "6M", "1Y", "All"];
```

- [ ] Add helper:

```ts
export function getDefaultMonthlyChartRange(snapshotCount: number): MonthlyChartRange {
  return snapshotCount <= 6 ? "All" : "6M";
}
```

- [ ] Add a private helper that maps range to latest snapshot count:
  - `3M` => 3
  - `6M` => 6
  - `1Y` => 12
  - `All` => all snapshots
- [ ] Preserve chronological sorting before filtering.
- [ ] Extend `MonthlyProgressChartData` with:

```ts
selectedRange: MonthlyChartRange;
availableRanges: MonthlyChartRange[];
portfolioInsight: {
  latestPortfolioValue: number;
  latestInvestedValue: number;
  valueGap: number;
  valueGapPct: number;
  latestMonthlyGain: number;
  latestMonthlyInvestment: number;
  valueMove: number;
} | null;
assetInsights: Array<{
  label: "Equity" | "Debt" | "Crypto";
  latestValue: number;
  latestDelta: number;
  latestDeltaPct: number;
  allocationPct: number;
  allocationShiftPct: number;
}>;
largestAssetMove: {
  label: "Equity" | "Debt" | "Crypto";
  latestDelta: number;
  latestDeltaPct: number;
} | null;
```

- [ ] Update `buildMonthlyProgressChartData` signature:

```ts
export function buildMonthlyProgressChartData(
  snapshots: MonthlySnapshot[],
  range?: MonthlyChartRange,
): MonthlyProgressChartData
```

- [ ] Compute portfolio insight from the filtered snapshots.
- [ ] Compute asset insights from the filtered snapshots.
- [ ] Compute largest asset move from absolute percentage movement, not raw INR
  movement, so the card headline pill is comparable across asset classes.
- [ ] Use safe divide helpers so invested value or allocation denominator of
  zero does not produce `Infinity` or `NaN`.
- [ ] Keep existing `portfolioSeries`, `assetSeries`, `monthLabels`, and
  `hasEnoughHistory` fields compatible with current callers.

Verification command:

```powershell
npm test -- --runInBand src/domain/calculations/__tests__/monthlyProgressCharts.test.ts
```

Expected result: domain chart tests pass.

## Task 3: Thread Chart Range Through the Progress Feature Hook

- [ ] Edit `src/features/progress/useProgress.ts`.
- [ ] Import `MonthlyChartRange` and `getDefaultMonthlyChartRange`.
- [ ] Add local React state:

```ts
const [chartRange, setChartRange] = useState<MonthlyChartRange>(() =>
  getDefaultMonthlyChartRange(snapshot.monthlySnapshots.length),
);
```

- [ ] Build chart data with selected range:

```ts
const chartData = buildMonthlyProgressChartData(snapshot.monthlySnapshots, chartRange);
```

- [ ] Return `chartRange` and `setChartRange` from the hook.
- [ ] Do not persist chart range in MMKV for V1.

Verification command:

```powershell
npm run typecheck
```

Expected result: typecheck passes or only reveals expected downstream UI updates
needed in Task 4.

## Task 4: Redesign Monthly Progress Chart Cards to Match Final Option B

- [ ] Edit `src/features/progress/ProgressScreen.tsx`.
- [ ] Destructure `chartRange` and `setChartRange` from `useProgress`.
- [ ] Use `docs/design/v1-research-preview/index.html` and
  `docs/design/v1-research-preview/README.md` as the implementation reference.
- [ ] Add the top metric row:
  - `Portfolio`
  - `Monthly gain`
  - `Monthly investment`
  - `Value move`
- [ ] Do not label this derived value as `Movement`, `Market move`, or `Implied
  move` in the user-facing UI. Use `Value move`.
- [ ] Add timeframe chips inside each chart card, not above both charts.
- [ ] Use `MONTHLY_CHART_RANGES` from the domain layer.
- [ ] Give each chip an accessibility role and label:
  - `Show 3M monthly progress charts`
  - `Show 6M monthly progress charts`
  - `Show 1Y monthly progress charts`
  - `Show all monthly progress charts`
- [ ] Implement the first chart card as:
  - title: `Value Gap`
  - subtitle: `Portfolio value against invested capital`
  - headline pill: signed value-gap percentage, for example `+15.8%`
  - white line: portfolio value
  - green line: invested value
  - subtle area/glow fill under the lines
  - y-axis value labels
  - x-axis month labels
- [ ] Implement the second chart card as:
  - title: `Asset Momentum`
  - subtitle: `Absolute value trend - cash excluded`
  - headline pill: largest asset percentage movement, for example `Equity +4.9%`
  - green line: equity
  - blue line: debt
  - amber line: crypto
  - subtle per-series area/glow fill under the lines
  - y-axis value labels
  - x-axis month labels
- [ ] Update the `Asset Momentum` rows to show:
  - latest value per asset class
  - latest monthly delta per asset class
  - latest percentage movement per asset class
  - allocation percentage per asset class
  - allocation share shift per asset class, labelled clearly as `share +1.8%`
    or `share -0.8%`
- [ ] Do not add the exploratory `Largest move` banner. The top metrics and
  asset chart headline pill are enough.
- [ ] Do not add the redundant mini row under the `Value Gap` chart.
- [ ] Keep the chart visual direction calm:
  - no dense legends
  - no fake decorative data
  - no heavy borders
  - use green for positive context, red for negative context, blue for debt,
    amber for crypto
- [ ] Add or adjust `pointerConfig` on `LineChart` only if it remains Android
  safe. The card must still make sense if pointer labels do not appear in tests.
- [ ] Preserve existing testIDs where possible. Add useful testIDs:
  - `monthly-chart-range-3M`
  - `monthly-chart-range-6M`
  - `monthly-chart-range-1Y`
  - `monthly-chart-range-All`
  - `portfolio-trend-value-gap-pct`
  - `portfolio-trend-value-move`
  - `asset-trend-largest-move`

Verification command:

```powershell
npm run typecheck
```

Expected result: typecheck passes.

## Task 5: Update Progress Screen Tests

- [ ] Edit `src/features/progress/__tests__/ProgressScreen.test.tsx`.
- [ ] Add or update seeded monthly snapshots so tests cover at least six months.
- [ ] Add test for timeframe chips rendering.
- [ ] Add test that each chart card has its own `3M`, `6M`, `1Y`, `All`
  timeframe chips.
- [ ] Add test that tapping a `3M` chip changes visible month/insight context for
  that chart card.
- [ ] Add test that `Value Gap` renders signed value-gap percentage and
  `Value move` from stored snapshots.
- [ ] Add test that `Asset Momentum` renders largest percentage movement and asset
  rows with exact INR movement plus allocation share shift.
- [ ] Add test coverage for y-axis value labels and x-axis month labels.
- [ ] Keep existing empty and insufficient-history tests.

Verification command:

```powershell
npm test -- --runInBand src/features/progress/__tests__/ProgressScreen.test.tsx
```

Expected result: Progress screen tests pass.

## Task 6: Expand Visual QA Seed Data for Populated Progress Evidence

- [ ] Inspect `src/testing/visualQaSeed.ts`.
- [ ] If the seeded portfolio currently has fewer than six monthly snapshots,
  extend it to six monthly snapshots.
- [ ] Keep seed data test/dev-only. Do not route it into normal production app
  initialization.
- [ ] Ensure snapshots include visible movement across:
  - portfolio value
  - invested value
  - equity
  - debt
  - crypto
  - cash
  - monthly investment
- [ ] Update `src/testing/__tests__/visualQaSeed.test.ts` if expected seed counts
  change.

Verification command:

```powershell
npm test -- --runInBand src/testing/__tests__/visualQaSeed.test.ts
```

Expected result: visual QA seed tests pass.

## Task 7: Run Full Local Verification

- [ ] Run static and unit verification:

```powershell
npm run typecheck
npm test
npm run doctor
```

- [ ] Run the V1 PC verification gate if Android/emulator access is available:

```powershell
npm run test:v1:pc
```

Expected result: all commands pass, or failures are documented with exact reason
and scope.

## Task 8: Run Android Visual QA

- [ ] Build/install the local Android dev app if needed:

```powershell
npm run android
```

- [ ] Run visual QA:

```powershell
npm run visual-qa:android
```

- [ ] Confirm visual evidence for:
  - Monthly Progress populated state.
  - `Value Gap` chart with signed value-gap percentage, y-axis labels, month
    labels, and chart-local timeframe chips.
  - `Asset Momentum` chart with Equity, Debt, Crypto lines, subtle fill/glow,
    y-axis labels, month labels, chart-local timeframe chips, and percentage
    movement headline.
  - No chart crash during basic interaction.

Expected result: screenshots/artifacts update under the documented visual QA
artifact location, or emulator unavailability is documented.

## Task 9: Review Against Spec and Prepare PR

- [ ] Re-read `docs/superpowers/specs/2026-06-07-issue-122-progress-chart-richness.md`.
- [ ] Confirm each acceptance criterion is met or explicitly deferred.
- [ ] Run:

```powershell
git status --short
git diff --check
```

- [ ] Commit only files related to issue #122.
- [ ] Push branch `v1/issue-122-progress-chart-richness`.
- [ ] Open a PR with body including:

```text
Closes #122
```

- [ ] Include verification evidence in the PR body:
  - `npm run typecheck`
  - `npm test`
  - `npm run doctor`
  - Android visual QA result or documented reason not run

Expected result: a focused PR is ready for review and will auto-close issue #122
when merged.
