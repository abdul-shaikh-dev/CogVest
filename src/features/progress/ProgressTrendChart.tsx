import { useCallback, useMemo, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";

import {
  AppButton,
  AppText,
  MaskedValue,
  getPressedStateStyle,
} from "@/src/components/common";
import type {
  MonthlyProgressChartSeries,
  MonthlyProgressChartData,
} from "@/src/domain/calculations";
import {
  formatCompactINR,
  formatINR,
  formatPercentage,
} from "@/src/domain/formatters";
import { useTheme } from "@/src/theme";

import { ProgressTrendPlot } from "./ProgressTrendPlot";
import { buildProgressTrendModel } from "./progressTrendChartModel";
import { useStyles } from "./progressStyles";
import {
  chartWidth,
  formatChartYLabel,
  formatSignedCompactINR,
  getSelectedChange,
  getSeriesColor,
  getSeriesValue,
} from "./progressViewModel";

function TrendLegend({
  focusedSeries,
  onFocusSeries,
  series,
  testIDPrefix,
  portfolioLabel = "Portfolio",
}: {
  focusedSeries: string | null;
  onFocusSeries: (label: string | null) => void;
  series: MonthlyProgressChartSeries[];
  testIDPrefix: string;
  portfolioLabel?: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.chartLegend}>
      {series.map((item) => {
        const isFocused = focusedSeries === item.label;
        const isDimmed = focusedSeries !== null && !isFocused;

        return (
          <Pressable
            accessibilityLabel={`Emphasize ${item.label === "Portfolio" ? portfolioLabel : item.label} series`}
            accessibilityRole="button"
            accessibilityState={{ selected: isFocused }}
            key={item.label}
            onPress={() => onFocusSeries(isFocused ? null : item.label)}
            style={({ pressed }) => [
              styles.legendItem,
              isFocused ? styles.legendItemFocused : null,
              isDimmed ? styles.legendItemDimmed : null,
              getPressedStateStyle({ pressed }),
            ]}
            testID={`${testIDPrefix}-${item.label}`}
          >
            <View
              style={[
                styles.legendLine,
                item.label === "Invested" ? styles.legendLineDashed : null,
                { borderColor: getSeriesColor(colors, item.label) },
              ]}
            />
            <AppText color="secondary" variant="caption" weight="medium">
              {item.label === "Portfolio" ? portfolioLabel : item.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function SelectedMonthPanel({
  maskWealthValues,
  minimal,
  monthLabel,
  previousMonthLabel,
  selectedIndex,
  series,
  testIDPrefix,
  portfolioLabel = "Portfolio",
  partialHistory = false,
  hasPreviousCalendarMonth = true,
  investedComparison,
  summaryOnly = false,
}: {
  maskWealthValues: boolean;
  minimal: boolean;
  monthLabel: string;
  previousMonthLabel?: string;
  selectedIndex: number;
  series: MonthlyProgressChartSeries[];
  testIDPrefix: string;
  portfolioLabel?: string;
  partialHistory?: boolean;
  hasPreviousCalendarMonth?: boolean;
  investedComparison?: MonthlyProgressChartData["investedComparisons"][number];
  summaryOnly?: boolean;
}) {
  const styles = useStyles();
  const isPortfolioChart = testIDPrefix === "portfolio-trend";
  const { fontScale, width } = useWindowDimensions();

  if (partialHistory || summaryOnly) {
    return (
      <View style={styles.selectedPanel} testID={`${testIDPrefix}-selected-panel`}>
        {series.map((item) => (
          <View key={item.label} style={styles.gapValueRow}>
            <AppText color="secondary" variant="caption">
              {item.label === "Portfolio" ? portfolioLabel : item.label}
            </AppText>
            <MaskedValue
              exactValue={formatINR(item.values[selectedIndex] ?? 0)}
              masked={maskWealthValues}
              value={formatCompactINR(item.values[selectedIndex] ?? 0)}
              variant="caption"
              weight="bold"
            />
          </View>
        ))}
      </View>
    );
  }

  if (isPortfolioChart) {
    const portfolioValue = getSeriesValue(series, "Portfolio", selectedIndex);
    const investedValue = getSeriesValue(series, "Invested", selectedIndex);
    const difference = investedComparison?.difference ?? null;
    const differencePercentage = investedComparison?.percentage ?? null;
    const unavailableReason = investedValue === 0
      ? "Percentage unavailable: invested value is zero"
      : "Comparison unavailable";
    const direction = (difference ?? 0) >= 0 ? "ahead of invested" : "behind invested";

    return (
      <View
        accessibilityLabel={
          maskWealthValues
            ? `${monthLabel}. ${portfolioLabel} amounts hidden. ${
                differencePercentage === null
                  ? unavailableReason
                  : `${formatPercentage(differencePercentage)} versus invested`
              }.`
            : `${monthLabel}. ${portfolioLabel} ${formatCompactINR(
                portfolioValue,
              )}. Invested ${formatCompactINR(
                investedValue,
              )}. ${difference === null ? "Comparison unavailable" : `${formatSignedCompactINR(difference)} ${direction}, excluding cash`}. ${
                differencePercentage === null
                  ? unavailableReason
                  : `${formatPercentage(differencePercentage)} versus invested`
              }.`
        }
        accessible
        accessibilityLiveRegion="polite"
        style={styles.selectedPanel}
        testID={`${testIDPrefix}-selected-panel`}
      >
        <View testID="portfolio-comparison-layout" style={[
          styles.portfolioSelectionContent,
          fontScale > 1.15 || width < 440 ? { flexDirection: "column", alignItems: "stretch" } : null,
        ]}>
            <View style={styles.gapOutcome}>
              <AppText color="secondary" variant="caption">Vs invested · excludes cash</AppText>
              <View style={styles.comparisonMetricPair}>
              <View style={styles.comparisonMetric} testID="progress-difference-amount">
                <AppText color="secondary" variant="caption">Difference</AppText>
                <MaskedValue
                  exactValue={difference === null ? undefined : formatINR(difference)}
                  masked={maskWealthValues && difference !== null}
                  value={difference === null ? "—" : formatSignedCompactINR(difference)}
                  style={difference === null ? styles.neutralText : difference >= 0 ? styles.gainText : styles.lossText}
                  weight={minimal ? "medium" : "bold"}
                />
              </View>
              <View style={styles.comparisonMetric} testID="progress-difference-percent">
              <AppText color="secondary" variant="caption">Difference %</AppText>
              <AppText
                style={
                  difference === null ? styles.neutralText : difference >= 0
                    ? styles.gainText
                    : styles.lossText
                }
                weight={minimal ? "medium" : "bold"}
              >
                {differencePercentage === null
                  ? "Unavailable"
                  : formatPercentage(differencePercentage)}
              </AppText>
              </View>
              </View>
            </View>
            <View style={styles.gapValues}>
              <View style={styles.gapValueRow}>
                <AppText color="secondary" variant="caption">
                  {portfolioLabel}
                </AppText>
                <MaskedValue style={styles.gapAmount} exactValue={formatINR(portfolioValue)} masked={maskWealthValues} value={formatCompactINR(portfolioValue)} variant="caption" weight="bold" />
              </View>
              <View style={styles.gapValueRow}>
                <AppText color="secondary" variant="caption">
                  Invested
                </AppText>
                <MaskedValue style={styles.gapAmount} exactValue={formatINR(investedValue)} masked={maskWealthValues} value={formatCompactINR(investedValue)} variant="caption" weight="bold" />
              </View>
            </View>
          </View>
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={
        maskWealthValues
          ? `${monthLabel}. Asset amounts hidden. ${series
              .map((item) => {
                const change = hasPreviousCalendarMonth ? getSelectedChange(item.values, selectedIndex) : null;
                const changeLabel = selectedIndex === 0
                  ? "No prior stored month in this range; change unavailable"
                  : !hasPreviousCalendarMonth
                    ? "Previous calendar month is missing; change unavailable"
                  : change === null
                    ? `Change unavailable: ${previousMonthLabel ?? "prior stored month"} value is zero`
                    : `${formatPercentage(change)} versus ${previousMonthLabel ?? "previous stored month"}`;
                return `${item.label}. ${changeLabel}`;
              })
              .join(". ")}.`
          : `${monthLabel}. ${series
              .map((item) => {
                const change = hasPreviousCalendarMonth ? getSelectedChange(item.values, selectedIndex) : null;
                const changeLabel = selectedIndex === 0
                  ? "No prior stored month in this range; change unavailable"
                  : !hasPreviousCalendarMonth
                    ? "Previous calendar month is missing; change unavailable"
                  : change === null
                    ? `Change unavailable: ${previousMonthLabel ?? "prior stored month"} value is zero`
                    : `${formatPercentage(change)} versus ${previousMonthLabel ?? "previous stored month"}`;
                return `${item.label} ${formatCompactINR(
                  item.values[selectedIndex] ?? 0,
                )}. ${changeLabel}`;
              })
              .join(". ")}.`
      }
      accessible
      accessibilityLiveRegion="polite"
      style={styles.selectedPanel}
      testID={`${testIDPrefix}-selected-panel`}
    >
      <View style={[styles.assetSelectionGrid, fontScale > 1.15 ? styles.assetSelectionStack : null]}>
          {series.map((item) => {
            const change = hasPreviousCalendarMonth ? getSelectedChange(item.values, selectedIndex) : null;

            return (
              <View key={item.label} style={styles.assetSelectionMetric}>
                <AppText color="secondary" variant="caption">
                  {item.label}
                </AppText>
                <MaskedValue
                  exactValue={formatINR(item.values[selectedIndex] ?? 0)}
                  masked={maskWealthValues}
                  value={formatCompactINR(item.values[selectedIndex] ?? 0)}
                  weight="bold"
                />
                <AppText
                  style={
                    change === null
                      ? styles.neutralText
                      : change >= 0
                        ? styles.gainText
                        : styles.lossText
                  }
                  variant="caption"
                >
                  {change === null ? "—" : formatPercentage(change)}
                </AppText>
              </View>
            );
          })}
      </View>
    </View>
  );
}

export function TrendChart({
  isReducedMotionEnabled,
  maskWealthValues,
  minimal,
  monthLabels,
  series,
  testIDPrefix,
  portfolioLabel = "Portfolio",
  partialHistory = false,
  estimatedIndices,
  gapAfterIndices,
  investedComparisons,
  summaryOnly = false,
}: {
  isReducedMotionEnabled: boolean;
  maskWealthValues: boolean;
  minimal: boolean;
  monthLabels: string[];
  series: MonthlyProgressChartSeries[];
  testIDPrefix: string;
  portfolioLabel?: string;
  partialHistory?: boolean;
  estimatedIndices: number[];
  gapAfterIndices: number[];
  investedComparisons?: MonthlyProgressChartData["investedComparisons"];
  summaryOnly?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  const [surfaceWidth, setSurfaceWidth] = useState(0);
  const [focusedSeries, setFocusedSeries] = useState<string | null>(null);
  const [focusSummaryOnly, setFocusSummaryOnly] = useState(summaryOnly);
  if (focusSummaryOnly !== summaryOnly) {
    setFocusSummaryOnly(summaryOnly);
    setFocusedSeries(null);
  }
  const isPortfolioChart = testIDPrefix === "portfolio-trend";
  const visibleSeries = isPortfolioChart
    ? summaryOnly ? series.filter(item => item.label !== "Invested") : series
    : series.filter(item => item.values.some(value => value !== 0));
  const displayedSeries = !isPortfolioChart && focusedSeries
    ? visibleSeries.filter((item) => item.label === focusedSeries)
    : visibleSeries;
  const yAxisWidth = Math.ceil(52 * Math.max(1, fontScale));
  const plotWidth = surfaceWidth > 0 ? surfaceWidth - yAxisWidth : chartWidth;
  const pointCount = series[0]?.values.length ?? 0;
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(pointCount - 1, 0),
  );
  const safeSelectedIndex = Math.min(
    selectedIndex,
    Math.max(pointCount - 1, 0),
  );
  const model = useMemo(() => buildProgressTrendModel({
    colors,
    dashedLabels: ["Invested"],
    drawnSeries: isPortfolioChart
      ? (partialHistory || summaryOnly ? series.slice(0, 1) : series.slice(0, 2))
      : displayedSeries,
    endpointsOnly: fontScale > 1.15 && plotWidth < 250,
    fillUnderFirst: isPortfolioChart,
    focusedSeries,
    gapAfterIndices,
    monthLabels,
    reducedMotion: isReducedMotionEnabled,
    scaleSeries: displayedSeries,
    selectedIndex: safeSelectedIndex,
  }), [colors, displayedSeries, focusedSeries, fontScale, gapAfterIndices, isPortfolioChart,
    isReducedMotionEnabled, monthLabels, partialHistory, plotWidth, safeSelectedIndex, series, summaryOnly]);
  const formatYLabel = useCallback(
    (value: number) => formatChartYLabel(value, maskWealthValues),
    [maskWealthValues],
  );
  const plotColors = useMemo(
    () => ({ fill: colors.profit, label: colors.text.secondary, rule: colors.border.subtle }),
    [colors],
  );

  const chartName = isPortfolioChart ? "Portfolio Growth" : "Value by asset class";

  return (
    <View style={styles.chartBlock}>
      <View style={styles.monthNavigation} testID={`${testIDPrefix}-month-navigation`}>
        <AppButton
          accessibilityLabel={`${chartName}: previous stored month`}
          disabled={safeSelectedIndex === 0}
          onPress={() => setSelectedIndex(safeSelectedIndex - 1)}
          testID={`${testIDPrefix}-previous-month`}
          title="‹" variant="ghost"
        />
        <View style={styles.monthNavigationLabel}>
          <AppText align="center" variant="caption" weight="bold">
            {monthLabels[safeSelectedIndex] ?? ""}
          </AppText>
          {estimatedIndices.includes(safeSelectedIndex) ? (
            <AppText align="center" color="secondary" variant="caption">Estimated</AppText>
          ) : null}
        </View>
        <AppButton
          accessibilityLabel={`${chartName}: next stored month`}
          disabled={safeSelectedIndex >= pointCount - 1}
          onPress={() => setSelectedIndex(safeSelectedIndex + 1)}
          testID={`${testIDPrefix}-next-month`}
          title="›" variant="ghost"
        />
      </View>
      {!isPortfolioChart && focusedSeries ? (
        <AppText color="secondary" testID={`${testIDPrefix}-focused-scale`} variant="caption">
          {focusedSeries} scale · Other asset lines hidden
        </AppText>
      ) : null}
      {visibleSeries.length === 0 ? (
        <AppText color="secondary">No asset-class value in this range.</AppText>
      ) : <View style={styles.chartWithAxis} testID={`${testIDPrefix}-plot-region`}>
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          onLayout={(event) => setSurfaceWidth(event.nativeEvent.layout.width)}
          style={styles.chartSurface}
          testID={`${testIDPrefix}-chart`}
        >
          <ProgressTrendPlot
            colors={plotColors}
            formatYLabel={formatYLabel}
            model={model}
            onInspect={setSelectedIndex}
          />
        </View>
      </View>}
      <SelectedMonthPanel
        investedComparison={investedComparisons?.[safeSelectedIndex]}
        partialHistory={partialHistory}
        summaryOnly={summaryOnly}
        portfolioLabel={portfolioLabel}
        maskWealthValues={maskWealthValues}
        minimal={minimal}
        monthLabel={monthLabels[safeSelectedIndex] ?? ""}
        previousMonthLabel={
          safeSelectedIndex > 0
            ? monthLabels[safeSelectedIndex - 1]
            : undefined
        }
        selectedIndex={safeSelectedIndex}
        series={visibleSeries}
        hasPreviousCalendarMonth={!gapAfterIndices.includes(safeSelectedIndex - 1)}
        testIDPrefix={testIDPrefix}
      />
      <TrendLegend
        portfolioLabel={portfolioLabel}
        focusedSeries={focusedSeries}
        onFocusSeries={setFocusedSeries}
        series={visibleSeries}
        testIDPrefix={testIDPrefix}
      />
    </View>
  );
}
