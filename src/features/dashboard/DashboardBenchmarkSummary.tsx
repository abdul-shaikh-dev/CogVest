import { useMemo, useState, useSyncExternalStore } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/src/components/common";
import { benchmarkXirr } from "@/src/domain/benchmarkXirr";
import { formatPercentage } from "@/src/domain/formatters";
import type { XirrSummary } from "@/src/domain/xirrSummary";
import {
  benchmarkNavLoadVersion,
  readCachedBenchmarkNav,
  subscribeBenchmarkNavLoads,
} from "@/src/services/quotes/benchmarkNav";
import { createDailyPriceCache } from "@/src/services/quotes/dailyPriceCache";

import { benchmarkGapText } from "./BenchmarkComparison";
import { useStyles } from "./dashboardStyles";

type RateSummary = Extract<XirrSummary, { status: "rate" }>;
type Cache = Parameters<typeof readCachedBenchmarkNav>[0];

/**
 * The Nifty 50 comparison (#765) as one line in the Dashboard's return
 * breakdown. It reads cached NAV only; comparing, the chart and the note live
 * on Progress, so the Dashboard stays uncluttered.
 */
export function DashboardBenchmarkSummary({ cache: suppliedCache, onOpenProgress, summary }: {
  cache?: Cache;
  onOpenProgress?: () => void;
  summary: RateSummary;
}) {
  const styles = useStyles();
  const [cache] = useState<Cache>(() => suppliedCache ?? createDailyPriceCache());
  const loads = useSyncExternalStore(subscribeBenchmarkNavLoads, benchmarkNavLoadVersion, benchmarkNavLoadVersion);
  const result = useMemo(() => {
    const nav = readCachedBenchmarkNav(cache, summary.startDate, summary.endDate);
    return nav.status === "ready" ? benchmarkXirr(summary.flows, summary.endDate, nav.points) : undefined;
    // A finished load on Progress stores new years; re-read the cache then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cache, loads, summary]);
  const link = (title: string) => (onOpenProgress ? (
    <Pressable accessibilityRole="button" onPress={onOpenProgress} style={styles.inlineAction}
      testID="dashboard-benchmark-open-progress">
      <AppText style={styles.brandText} variant="caption" weight="bold">{title}</AppText>
    </Pressable>
  ) : null);

  if (result?.status !== "rate") {
    return (
      <View style={[styles.benchmark, styles.xirrLine]} testID="dashboard-benchmark">
        <AppText color="secondary" style={styles.xirrLabel} variant="caption">
          Compare with a Nifty 50 index fund
        </AppText>
        {link("Compare in Progress")}
      </View>
    );
  }
  return (
    <View style={styles.benchmark} testID="dashboard-benchmark">
      <View style={styles.xirrLine}>
        <AppText color="secondary" style={styles.xirrLabel} variant="caption">Nifty 50 index fund, same money</AppText>
        <AppText testID="dashboard-benchmark-rate" variant="caption" weight="bold">
          {`${formatPercentage(result.rate * 100)} a year`}
        </AppText>
      </View>
      <View style={styles.xirrLine}>
        <AppText style={styles.xirrLabel} testID="dashboard-benchmark-gap" variant="caption" weight="bold">
          {`Your portfolio: ${benchmarkGapText(summary.rate, result.rate)}`}
        </AppText>
        {link("Chart in Progress")}
      </View>
    </View>
  );
}
