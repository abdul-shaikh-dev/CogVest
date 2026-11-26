import { useState } from "react";
import { View } from "react-native";

import { AppButton, AppText } from "@/src/components/common";
import { benchmarkFund, benchmarkXirr, type BenchmarkXirr, type NavPoint } from "@/src/domain/benchmarkXirr";
import { formatDate, formatPercentage } from "@/src/domain/formatters";
import type { XirrSummary } from "@/src/domain/xirrSummary";
import {
  loadBenchmarkNav,
  readCachedBenchmarkNav,
  type BenchmarkNavProgress,
  type BenchmarkNavResult,
} from "@/src/services/quotes/benchmarkNav";
import { createDailyPriceCache } from "@/src/services/quotes/dailyPriceCache";
import type { MonthlySnapshot } from "@/src/types";

import { buildBenchmarkChartData } from "./benchmarkChartModel";
import { DashboardBenchmarkChart } from "./DashboardBenchmarkChart";

import { useStyles } from "./dashboardStyles";

type RateSummary = Extract<XirrSummary, { status: "rate" }>;
type Cache = Parameters<typeof readCachedBenchmarkNav>[0];
type State = { status: "idle" } | { progress?: BenchmarkNavProgress; status: "loading" } | { status: "failed"; message: string } | { status: "done"; points: readonly NavPoint[]; result: BenchmarkXirr };

function compute(summary: RateSummary, nav: BenchmarkNavResult): State {
  if (nav.status === "failed") return { message: nav.message, status: "failed" };
  if (nav.status === "missing") return { status: "idle" };
  return { points: nav.points, result: benchmarkXirr(summary.flows, summary.endDate, nav.points), status: "done" };
}

/** What is loading, by year; the bar shows the share done. */
export function benchmarkProgressText(progress: BenchmarkNavProgress | undefined) {
  if (!progress) return "Checking saved NAV history.";
  const label = `Loading ${progress.year} NAV history from AMFI`;
  return progress.years > 1 ? `${label}, year ${progress.yearIndex + 1} of ${progress.years}` : label;
}

/** Percentage points between two annual rates, written out so it never relies on colour. */
export function benchmarkGapText(portfolioRate: number, benchmarkRate: number) {
  const points = Math.round((portfolioRate - benchmarkRate) * 1000) / 10;
  if (points === 0) return "Same as the index fund";
  return `${Math.abs(points).toFixed(1)} points ${points > 0 ? "above" : "below"} the index fund`;
}

/**
 * Hypothetical comparison (#765): the same dated money in and out, invested
 * in a Nifty 50 index fund instead. NAV comes from AMFI only when asked, then
 * from the cache. Information, not advice.
 */
export function DashboardBenchmark({ cache: suppliedCache, loader, masked = false, monthlySnapshots = [], summary }: {
  cache?: Cache;
  loader?: Parameters<typeof loadBenchmarkNav>[3];
  masked?: boolean;
  monthlySnapshots?: readonly Pick<MonthlySnapshot, "month" | "portfolioValue">[];
  summary: RateSummary;
}) {
  const styles = useStyles();
  const [cache] = useState<Cache>(() => suppliedCache ?? createDailyPriceCache());
  const key = `${summary.startDate}:${summary.endDate}:${summary.flows.length}`;
  const [state, setState] = useState<{ key: string; value: State }>(() => ({
    key, value: compute(summary, readCachedBenchmarkNav(cache, summary.startDate, summary.endDate)),
  }));
  if (state.key !== key) {
    setState({ key, value: compute(summary, readCachedBenchmarkNav(cache, summary.startDate, summary.endDate)) });
  }
  const value = state.key === key ? state.value : { status: "idle" as const };
  const chart = value.status === "done" && value.result.status === "rate"
    ? buildBenchmarkChartData({
      endDate: summary.endDate, flows: summary.flows, points: value.points, snapshots: monthlySnapshots, startDate: summary.startDate,
    })
    : undefined;

  function load() {
    setState({ key, value: { status: "loading" } });
    const onProgress = (progress: BenchmarkNavProgress) => setState((current) => (
      current.key === key && current.value.status === "loading" ? { key, value: { progress, status: "loading" } } : current));
    void loadBenchmarkNav(cache, summary.startDate, summary.endDate, loader, undefined, onProgress)
      .then((nav) => setState((current) => (current.key === key ? { key, value: compute(summary, nav) } : current)))
      .catch(() => setState((current) => (current.key === key
        ? { key, value: { message: "NAV history couldn't be loaded from AMFI. Try again.", status: "failed" } }
        : current)));
  }

  return (
    <View style={styles.benchmark} testID="dashboard-benchmark">
      <AppText weight="bold" variant="caption">Compared with a Nifty 50 index fund</AppText>
      {value.status === "idle" ? (
        <>
          <AppText color="secondary" variant="caption">
            See what the same money in and out, on the same dates, would have earned in a Nifty 50 index fund.
          </AppText>
          <AppButton onPress={load} testID="dashboard-benchmark-compare" title="Compare" variant="secondary" />
        </>
      ) : null}
      {value.status === "loading" ? (
        <>
          <AppText accessibilityLiveRegion="polite" color="secondary" testID="dashboard-benchmark-loading" variant="caption">
            {benchmarkProgressText(value.progress)}
          </AppText>
          <View
            accessible
            accessibilityLabel="NAV history loaded"
            accessibilityRole="progressbar"
            accessibilityValue={{ max: 100, min: 0, now: Math.round((value.progress?.fraction ?? 0) * 100) }}
            style={styles.benchmarkProgressTrack}
            testID="dashboard-benchmark-progress"
          >
            <View style={[styles.benchmarkProgressFill, { width: `${Math.max(2, Math.round((value.progress?.fraction ?? 0) * 100))}%` }]} />
          </View>
          <AppText color="secondary" variant="caption">
            Each year is saved as it arrives, so the next comparison is quick.
          </AppText>
        </>
      ) : null}
      {value.status === "failed" || (value.status === "done" && value.result.status === "unavailable") ? (
        <>
          <AppText color="secondary" testID="dashboard-benchmark-unavailable" variant="caption">
            {value.status === "failed" ? value.message : value.result.status === "unavailable" ? value.result.message : ""}
          </AppText>
          <AppButton onPress={load} testID="dashboard-benchmark-retry" title="Try again" variant="secondary" />
        </>
      ) : null}
      {value.status === "done" && value.result.status === "rate" ? (
        <>
          <View style={styles.xirrLine}>
            <AppText color="secondary" variant="caption">Nifty 50 index fund, same money</AppText>
            <AppText testID="dashboard-benchmark-rate" variant="caption" weight="bold">
              {`${formatPercentage(value.result.rate * 100)} a year`}
            </AppText>
          </View>
          <AppText testID="dashboard-benchmark-gap" variant="caption" weight="bold">
            {`Your portfolio: ${benchmarkGapText(summary.rate, value.result.rate)}`}
          </AppText>
          {chart?.status === "chart" ? <DashboardBenchmarkChart data={chart} masked={masked} /> : null}
          {chart?.status === "few" ? (
            <AppText color="secondary" testID="dashboard-benchmark-chart-few" variant="caption">
              The chart appears once there are a few month-end snapshots in this period.
            </AppText>
          ) : null}
          <AppText color="secondary" testID="dashboard-benchmark-note" variant="caption">
            {`Hypothetical. The same money in and out, on the same dates, in ${benchmarkFund.name}, at AMFI NAV to ${formatDate(value.result.navAsOf)}. Your portfolio includes Cash; the fund doesn't. Not advice.`}
          </AppText>
        </>
      ) : null}
    </View>
  );
}
