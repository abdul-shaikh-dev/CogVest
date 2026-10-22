import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { LineChart } from "react-native-gifted-charts";

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
import { spacing, useTheme } from "@/src/theme";

import { useStyles } from "./progressStyles";
import {
  chartEndSpacing,
  chartHeight,
  chartInitialSpacing,
  chartSections,
  chartWidth,
  formatChartAxisLabel,
  formatChartYLabel,
  formatSignedCompactINR,
  getChartMaxValue,
  getChartPointRadius,
  getChartSpacing,
  getDisplayedSeriesColor,
  getSelectedChange,
  getSeriesColor,
  getSeriesValue,
  shouldShowAxisLabel,
} from "./progressViewModel";

function toGiftedChartData(
  series: MonthlyProgressChartSeries,
  monthLabels: string[],
  showAxisLabels = true,
  selectedIndex?: number,
  labelLayout?: { spacing: number; width: number; fontScale: number },
) {
  const total = series.values.length;
  const spansYears = new Set(monthLabels.map((label) => label.split(" ")[1])).size > 1;

  return series.values.map((value, index) => {
    const dataPointRadius = getChartPointRadius(total, index, selectedIndex);
    const endpointsOnly = labelLayout && labelLayout.fontScale > 1.15 && labelLayout.width < 250;
    const showLabel = showAxisLabels && (endpointsOnly
      ? index === 0 || index === total - 1
      : shouldShowAxisLabel(index, total));
    const label = showLabel
      ? spansYears
        ? (monthLabels[index] ?? "").replace(" ", "\n")
        : formatChartAxisLabel(monthLabels[index] ?? "")
      : "";
    const labelWidth = labelLayout
      ? Math.min(72 * Math.max(1, labelLayout.fontScale), labelLayout.width / 3)
      : 72;
    return {
      dataPointRadius,
      hideDataPoint: dataPointRadius === 0,
      label,
      // Gifted Charts otherwise constrains labels to one point's spacing.
      ...(showLabel && labelLayout
        ? {
            labelComponent: () => (
              <AppText
                align={index === 0 ? "left" : index === total - 1 ? "right" : "center"}
                color="secondary"
                variant="caption"
                style={{
                  width: labelWidth,
                  top: 4 + 44 * Math.max(0, labelLayout.fontScale - 1),
                  left: labelLayout.spacing / 2 - (index === 0 ? 0 : index === total - 1 ? labelWidth : labelWidth / 2),
                }}
              >
                {label}
              </AppText>
            ),
          }
        : {}),
      value,
    };
  });
}

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
  useEffect(() => { setFocusedSeries(null); }, [summaryOnly]);
  const isPortfolioChart = testIDPrefix === "portfolio-trend";
  const visibleSeries = isPortfolioChart
    ? summaryOnly ? series.filter(item => item.label !== "Invested") : series
    : series.filter(item => item.values.some(value => value !== 0));
  const displayedSeries = !isPortfolioChart && focusedSeries
    ? visibleSeries.filter((item) => item.label === focusedSeries)
    : visibleSeries;
  const gapSegments = gapAfterIndices.map(index => ({ startIndex: index, endIndex: index + 1, color: "transparent" }));
  const maxValue = getChartMaxValue(displayedSeries);
  const yAxisWidth = Math.ceil(52 * Math.max(1, fontScale));
  const plotWidth = surfaceWidth > 0
    ? Math.max(1, surfaceWidth - yAxisWidth - spacing.xs - spacing.sm - 2 * StyleSheet.hairlineWidth)
    : chartWidth;
  const axisProps = {
    maxValue,
    noOfSections: chartSections,
    stepValue: maxValue / chartSections,
    height: chartHeight,
    hideOrigin: false,
    showFractionalValues: true,
    roundToDigits: 2,
    yAxisLabelWidth: yAxisWidth,
    yAxisTextNumberOfLines: 1,
    formatYLabel: (label: string) => formatChartYLabel(label, maskWealthValues),
    width: plotWidth,
    rulesLength: plotWidth,
    xAxisLength: plotWidth,
  };
  const pointCount = series[0]?.values.length ?? 0;
  const spacingValue = getChartSpacing(pointCount, plotWidth);
  // The renderer's reveal animation captures its initial width. Refresh that
  // renderer on geometry changes, leaving this component's month state intact.
  const rendererKey = `${plotWidth}:${pointCount}`;
  const labelLayout = { spacing: spacingValue, width: plotWidth, fontScale };
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(pointCount - 1, 0),
  );
  const safeSelectedIndex = Math.min(
    selectedIndex,
    Math.max(pointCount - 1, 0),
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
          pointerEvents="none"
          onLayout={(event) => setSurfaceWidth(event.nativeEvent.layout.width)}
          style={styles.chartSurface}
          testID={`${testIDPrefix}-chart`}
        >
          {isPortfolioChart ? (
            <LineChart
            key={`portfolio:${rendererKey}`}
            {...axisProps}
            adjustToWidth
            areaChart={gapSegments.length === 0}
            lineSegments={gapSegments}
            lineSegments2={gapSegments}
            color1={getDisplayedSeriesColor(colors,
              series[0]?.label ?? "",
              focusedSeries,
            )}
            color2={getDisplayedSeriesColor(colors,
              series[1]?.label ?? "",
              focusedSeries,
            )}
            curved={false}
            data={toGiftedChartData(series[0], monthLabels, true, safeSelectedIndex, labelLayout)}
            data2={partialHistory || summaryOnly ? undefined : toGiftedChartData(series[1], monthLabels, false, safeSelectedIndex)}
            dataPointsColor1={getSeriesColor(colors, series[0]?.label ?? "")}
            dataPointsColor2={getSeriesColor(colors, series[1]?.label ?? "")}
            disableScroll
            endFillColor={`${colors.profit}00`}
            endOpacity={0}
            endSpacing={chartEndSpacing}
            initialSpacing={chartInitialSpacing}
            intersectionAreaConfig={partialHistory || summaryOnly || gapSegments.length > 0 ? undefined : { fillColor: `${colors.profit}24` }}
            isAnimated={!isReducedMotionEnabled}
            rulesColor={colors.border.subtle}
            rulesType="dashed"
            spacing={spacingValue}
            startFillColor={`${colors.profit}2E`}
            startOpacity={0.18}
            thickness1={3}
            thickness2={3}
            strokeDashArray2={[6, 4]}
            xAxisColor={colors.border.subtle}
            xAxisLabelTextStyle={styles.axisText}
            xAxisTextNumberOfLines={2}
            xAxisLabelsHeight={Math.ceil(44 * Math.max(1, fontScale))}
            xAxisThickness={1}
            yAxisColor="transparent"
            yAxisTextStyle={styles.axisText}
            yAxisThickness={0}
            />
          ) : (
            <LineChart
            key={`assets:${rendererKey}`}
            {...axisProps}
            adjustToWidth
            curved={false}
            dataSet={displayedSeries.map((item, index) => ({
              color: getDisplayedSeriesColor(colors, item.label, focusedSeries),
              data: toGiftedChartData(item, monthLabels, index === 0, safeSelectedIndex, labelLayout),
              dataPointsColor: getSeriesColor(colors, item.label),
              lineSegments: gapSegments,
              thickness: 3,
            }))}
            disableScroll
            endSpacing={chartEndSpacing}
            initialSpacing={chartInitialSpacing}
            isAnimated={!isReducedMotionEnabled}
            rulesColor={colors.border.subtle}
            rulesType="dashed"
            spacing={spacingValue}
            xAxisColor={colors.border.subtle}
            xAxisLabelTextStyle={styles.axisText}
            xAxisTextNumberOfLines={2}
            xAxisLabelsHeight={Math.ceil(44 * Math.max(1, fontScale))}
            xAxisThickness={1}
            yAxisColor="transparent"
            yAxisTextStyle={styles.axisText}
            yAxisThickness={0}
            />
          )}
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
