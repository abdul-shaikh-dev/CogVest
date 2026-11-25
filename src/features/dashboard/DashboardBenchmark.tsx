import { useState } from "react";
import { View } from "react-native";

import { AppButton, AppText } from "@/src/components/common";
import { benchmarkFund, benchmarkXirr, type BenchmarkXirr } from "@/src/domain/benchmarkXirr";
import { formatDate, formatPercentage } from "@/src/domain/formatters";
import type { XirrSummary } from "@/src/domain/xirrSummary";
import { loadBenchmarkNav, readCachedBenchmarkNav, type BenchmarkNavResult } from "@/src/services/quotes/benchmarkNav";
import { createDailyPriceCache } from "@/src/services/quotes/dailyPriceCache";

import { useStyles } from "./dashboardStyles";

type RateSummary = Extract<XirrSummary, { status: "rate" }>;
type Cache = Parameters<typeof readCachedBenchmarkNav>[0];
type State = { status: "idle" } | { status: "loading" } | { status: "failed"; message: string } | { status: "done"; result: BenchmarkXirr };

function compute(summary: RateSummary, nav: BenchmarkNavResult): State {
  if (nav.status === "failed") return { message: nav.message, status: "failed" };
  if (nav.status === "missing") return { status: "idle" };
  return { result: benchmarkXirr(summary.flows, summary.endDate, nav.points), status: "done" };
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
export function DashboardBenchmark({ cache: suppliedCache, loader, summary }: {
  cache?: Cache;
  loader?: Parameters<typeof loadBenchmarkNav>[3];
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

  function load() {
    setState({ key, value: { status: "loading" } });
    void loadBenchmarkNav(cache, summary.startDate, summary.endDate, loader)
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
        <AppText accessibilityLiveRegion="polite" color="secondary" testID="dashboard-benchmark-loading" variant="caption">
          Loading NAV history from AMFI. This can take a minute.
        </AppText>
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
            <AppText color="secondary" variant="caption">Index fund, same flows</AppText>
            <AppText testID="dashboard-benchmark-rate" variant="caption" weight="bold">
              {`${formatPercentage(value.result.rate * 100)} a year`}
            </AppText>
          </View>
          <AppText testID="dashboard-benchmark-gap" variant="caption">
            {`Your portfolio: ${benchmarkGapText(summary.rate, value.result.rate)}`}
          </AppText>
          <AppText color="secondary" testID="dashboard-benchmark-note" variant="caption">
            {`Hypothetical. Each amount is bought or sold in ${benchmarkFund.name} at that day's NAV from AMFI, valued at the NAV of ${formatDate(value.result.navAsOf)}. Your portfolio includes Cash, which the fund doesn't hold. Not advice.`}
          </AppText>
        </>
      ) : null}
    </View>
  );
}
