import { useCallback, useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";

import { AppText, MASKED_INR_VALUE } from "@/src/components/common";
import { formatINR } from "@/src/domain/formatters";
import { useReducedMotionPreference } from "@/src/hooks/useReducedMotionPreference";
import { ProgressTrendPlot } from "@/src/features/progress/ProgressTrendPlot";
import { buildProgressTrendModel } from "@/src/features/progress/progressTrendChartModel";
import { formatChartYLabel, getSeriesColor } from "@/src/features/progress/progressViewModel";
import { useTheme } from "@/src/theme";

import { benchmarkChartCeiling, type BenchmarkChartData } from "./benchmarkChartModel";
import { useStyles } from "./dashboardStyles";

type ChartData = Extract<BenchmarkChartData, { status: "chart" }>;

export const benchmarkSeriesLabel = "Nifty 50 fund";

/**
 * Portfolio value against the index fund holding the same money (#765).
 * Solid line for the portfolio, dashed for the fund, each named in the legend
 * and the readout, so neither relies on colour. Press and hold to inspect a month.
 */
export function DashboardBenchmarkChart({ data, masked }: { data: ChartData; masked: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotionPreference();
  const last = data.labels.length - 1;
  const [inspecting, setInspecting] = useState<number | null>(null);
  const index = inspecting ?? last;

  const model = useMemo(() => {
    const series = [
      { label: "Portfolio", values: data.portfolio },
      { label: benchmarkSeriesLabel, values: data.fund },
    ];
    const model = buildProgressTrendModel({
      colors,
      dashedLabels: [benchmarkSeriesLabel],
      drawnSeries: series,
      endpointsOnly: fontScale > 1.15,
      fillUnderFirst: false,
      focusedSeries: null,
      gapAfterIndices: [],
      monthLabels: data.labels,
      reducedMotion,
      scaleSeries: series,
      selectedIndex: last,
    });
    // A tighter ceiling than the Progress scale, so the two lines use the plot's height.
    const maxValue = benchmarkChartCeiling(Math.max(...data.portfolio, ...data.fund));
    return { ...model, maxValue, yTicks: [0, maxValue / 2, maxValue] };
  }, [colors, data, fontScale, last, reducedMotion]);
  const formatYLabel = useCallback((value: number) => formatChartYLabel(value, masked), [masked]);
  const plotColors = useMemo(() => ({ label: colors.text.secondary, rule: colors.border.subtle }), [colors]);
  const money = (value: number) => (masked ? MASKED_INR_VALUE : formatINR(value));

  return (
    <View style={styles.benchmarkChart} testID="progress-benchmark-chart">
      <View style={styles.benchmarkLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { borderColor: getSeriesColor(colors, "Portfolio") }]} />
          <AppText color="secondary" variant="caption">Your portfolio</AppText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, styles.legendLineDashed, { borderColor: getSeriesColor(colors, benchmarkSeriesLabel) }]} />
          <AppText color="secondary" variant="caption">Same money in the Nifty 50 fund</AppText>
        </View>
      </View>
      <View
        accessibilityLabel={`Chart from ${data.labels[0]} to now. Your portfolio ${money(data.portfolio[last])}, same money in the Nifty 50 fund ${money(data.fund[last])}.`}
        accessible
      >
        <ProgressTrendPlot colors={plotColors} formatYLabel={formatYLabel} model={model} onInspect={setInspecting} />
      </View>
      <View accessibilityLiveRegion="polite" style={styles.xirrLine} testID="progress-benchmark-readout">
        <AppText color="secondary" variant="caption">{data.labels[index]}</AppText>
        <AppText testID="progress-benchmark-readout-values" variant="caption">
          {`Portfolio ${money(data.portfolio[index])} · Fund ${money(data.fund[index])}`}
        </AppText>
      </View>
    </View>
  );
}
