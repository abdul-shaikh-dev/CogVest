import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  CategoryIcon,
  EmptyState,
  IconButton,
  MetricGroup,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  androidRipple,
  assetClassLabel,
  getPressedStateStyle,
  minimumTouchTargetStyle,
} from "@/src/components/common";
import type {
  MonthlyProgressChartSeries,
} from "@/src/domain/calculations";
import {
  getMonthlySnapshotPriceConfidence,
  MONTHLY_CHART_RANGES,
  type MonthlyChartCustomRange,
  type MonthlyChartRange,
  type MonthlyProgressChartData,
} from "@/src/domain/calculations";
import { formatCompactINR, formatINR, formatPercentage } from "@/src/domain/formatters";
import {
  decimal,
  normalizeMoney,
  normalizePercentage,
} from "@/src/domain/precision";
import { useReducedMotionPreference } from "@/src/hooks";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { isVisualQaSessionActive } from "@/src/testing/visualQaSeed";
import { colors, interaction, radii, spacing } from "@/src/theme";
import { MonthlyHistoryPanel } from "./MonthlyHistoryPanel";
import { useProgress, type ProgressSnapshotAutomationStatus } from "./useProgress";

type ProgressScreenProps = {
  now?: Date;
  onReviewSnapshot?: () => void;
  store?: StoreApi<PortfolioStoreState>;
};

function getMonthLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatMonth(month: string) {
  const [year, monthPart] = month.split("-");
  const monthIndex = Number(monthPart) - 1;

  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(Number(year), monthIndex, 1)));
}

function formatSignedCompactINR(value: number) {
  const amount = formatCompactINR(Math.abs(value));

  if (value > 0) {
    return `+${amount}`;
  }

  if (value < 0) {
    return `-${amount}`;
  }

  return amount;
}

function formatOptionalSignedCompactINR(value: number | null) {
  return value === null ? "Unavailable" : formatSignedCompactINR(value);
}

const chartHeight = 154;
const chartWidth = 228;
const chartSections = 2;
const chartInitialSpacing = 18;
const chartEndSpacing = 36;
const maskedChartValueLabel = "₹••••";

function getSeriesColor(label: string) {
  switch (label) {
    case "Portfolio":
      return colors.profit;
    case "Invested":
      return colors.text.primary;
    case "Equity":
      return colors.primary;
    case "Debt":
      return colors.blue;
    case "Crypto":
      return colors.cryptoAmber;
    default:
      return colors.text.secondary;
  }
}

function getChartMaxValue(series: MonthlyProgressChartSeries[]) {
  const maxValue = Math.max(...series.flatMap((item) => item.values), 1);
  const magnitude = 10 ** Math.floor(Math.log10(maxValue));
  const normalized = maxValue / magnitude;
  const niceMultiplier = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

  return niceMultiplier * magnitude;
}

function formatChartYLabel(value: number | string, masked: boolean) {
  if (masked) {
    return maskedChartValueLabel;
  }

  return formatCompactINR(Number(value));
}

function formatChartAxisLabel(monthLabel: string) {
  return monthLabel.split(" ")[0] ?? monthLabel;
}

function shouldShowAxisLabel(index: number, total: number) {
  if (total <= 3) {
    return true;
  }

  return index === 0 || index === Math.floor((total - 1) / 2) || index === total - 1;
}

function toGiftedChartData(
  series: MonthlyProgressChartSeries,
  monthLabels: string[],
  showAxisLabels = true,
  selectedIndex?: number,
) {
  const total = series.values.length;

  return series.values.map((value, index) => ({
    dataPointRadius: index === selectedIndex ? 6 : 3,
    label:
      showAxisLabels && shouldShowAxisLabel(index, total)
        ? formatChartAxisLabel(monthLabels[index] ?? "")
        : "",
    value,
  }));
}

function getChartSpacing(pointCount: number, width: number) {
  if (pointCount <= 1) {
    return width / 2;
  }

  return Math.max(
    0,
    (width - chartInitialSpacing - chartEndSpacing) / (pointCount - 1),
  );
}

function getDimmedSeriesColor(label: string) {
  switch (label) {
    case "Portfolio":
    case "Equity":
      return "rgba(52,199,89,0.24)";
    case "Invested":
      return "rgba(255,255,255,0.24)";
    case "Debt":
      return "rgba(10,132,255,0.24)";
    case "Crypto":
      return "rgba(255,214,10,0.24)";
    default:
      return "rgba(142,142,147,0.24)";
  }
}

function getDisplayedSeriesColor(label: string, focusedSeries: string | null) {
  return focusedSeries && focusedSeries !== label
    ? getDimmedSeriesColor(label)
    : getSeriesColor(label);
}

function TrendLegend({
  focusedSeries,
  onFocusSeries,
  series,
  testIDPrefix,
}: {
  focusedSeries: string | null;
  onFocusSeries: (label: string | null) => void;
  series: MonthlyProgressChartSeries[];
  testIDPrefix: string;
}) {
  return (
    <View style={styles.chartLegend}>
      {series.map((item) => {
        const isFocused = focusedSeries === item.label;
        const isDimmed = focusedSeries !== null && !isFocused;

        return (
          <Pressable
            accessibilityLabel={`Emphasize ${item.label} series`}
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
                { borderColor: getSeriesColor(item.label) },
              ]}
            />
            <AppText color="secondary" variant="caption" weight="medium">
              {item.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function getSeriesValue(
  series: MonthlyProgressChartSeries[],
  label: string,
  index: number,
) {
  return series.find((item) => item.label === label)?.values[index] ?? 0;
}

function getSelectedChange(
  values: number[],
  selectedIndex: number,
): number | null {
  if (selectedIndex <= 0) {
    return null;
  }

  const previousValue = values[selectedIndex - 1] ?? 0;
  const currentValue = values[selectedIndex] ?? 0;

  return previousValue === 0
    ? null
    : normalizePercentage(
        decimal(currentValue).minus(previousValue).dividedBy(previousValue).times(100),
      );
}

function SelectedMonthPanel({
  maskWealthValues,
  minimal,
  monthLabel,
  selectedIndex,
  series,
  testIDPrefix,
}: {
  maskWealthValues: boolean;
  minimal: boolean;
  monthLabel: string;
  selectedIndex: number;
  series: MonthlyProgressChartSeries[];
  testIDPrefix: string;
}) {
  const isPortfolioChart = testIDPrefix === "portfolio-trend";
  const { fontScale } = useWindowDimensions();

  if (isPortfolioChart) {
    const portfolioValue = getSeriesValue(series, "Portfolio", selectedIndex);
    const investedValue = getSeriesValue(series, "Invested", selectedIndex);
    const preciseDifference = decimal(portfolioValue).minus(investedValue);
    const difference = normalizeMoney(preciseDifference);
    const differencePercentage =
      investedValue === 0
        ? null
        : normalizePercentage(
            preciseDifference.dividedBy(investedValue).times(100),
          );
    const direction = difference >= 0 ? "ahead of invested" : "behind invested";

    return (
      <View
        accessibilityLabel={
          maskWealthValues
            ? `${monthLabel}. Portfolio values hidden.`
            : `${monthLabel}. Portfolio ${formatCompactINR(
                portfolioValue,
              )}. Invested ${formatCompactINR(
                investedValue,
              )}. ${formatSignedCompactINR(difference)} ${direction}.`
        }
        accessible
        accessibilityLiveRegion="polite"
        style={styles.selectedPanel}
        testID={`${testIDPrefix}-selected-panel`}
      >
        {maskWealthValues ? (
          <AppText color="secondary">Performance values hidden</AppText>
        ) : (
          <View style={styles.portfolioSelectionContent}>
            <View style={styles.gapOutcome}>
              <AppText
                color={minimal ? "secondary" : undefined}
                style={
                  minimal
                    ? undefined
                    : difference >= 0
                      ? styles.gainText
                      : styles.lossText
                }
                variant="title"
                weight={minimal ? "medium" : "bold"}
              >
                {differencePercentage === null
                  ? "Unavailable"
                  : formatPercentage(differencePercentage)}
              </AppText>
              <AppText color="secondary" variant="caption">
                {`${formatSignedCompactINR(difference)} ${direction}`}
              </AppText>
            </View>
            <View style={styles.gapValues}>
              <View style={styles.gapValueRow}>
                <AppText color="secondary" variant="caption">
                  Portfolio
                </AppText>
                <AppText variant="caption" weight="bold">
                  {formatCompactINR(portfolioValue)}
                </AppText>
              </View>
              <View style={styles.gapValueRow}>
                <AppText color="secondary" variant="caption">
                  Invested
                </AppText>
                <AppText variant="caption" weight="bold">
                  {formatCompactINR(investedValue)}
                </AppText>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={
        maskWealthValues
          ? `${monthLabel}. Asset values hidden.`
          : `${monthLabel}. ${series
              .map(
                (item) =>
                  `${item.label} ${formatCompactINR(
                    item.values[selectedIndex] ?? 0,
                  )}`,
              )
              .join(". ")}.`
      }
      accessible
      accessibilityLiveRegion="polite"
      style={styles.selectedPanel}
      testID={`${testIDPrefix}-selected-panel`}
    >
      {maskWealthValues ? (
        <AppText color="secondary">Asset values hidden</AppText>
      ) : (
        <View style={[styles.assetSelectionGrid, fontScale > 1.15 ? styles.assetSelectionStack : null]}>
          {series.map((item) => {
            const change = getSelectedChange(item.values, selectedIndex);

            return (
              <View key={item.label} style={styles.assetSelectionMetric}>
                <AppText color="secondary" variant="caption">
                  {item.label}
                </AppText>
                <AppText weight="bold">
                  {formatCompactINR(item.values[selectedIndex] ?? 0)}
                </AppText>
                <AppText
                  color={minimal ? "secondary" : undefined}
                  style={
                    minimal
                      ? undefined
                      : change === null
                        ? styles.neutralText
                        : change >= 0
                          ? styles.gainText
                          : styles.lossText
                  }
                  variant="caption"
                >
                  {change === null
                    ? "First visible month"
                    : `${formatPercentage(change)} vs prior`}
                </AppText>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function TrendChart({
  isReducedMotionEnabled,
  maskWealthValues,
  minimal,
  monthLabels,
  series,
  testIDPrefix,
}: {
  isReducedMotionEnabled: boolean;
  maskWealthValues: boolean;
  minimal: boolean;
  monthLabels: string[];
  series: MonthlyProgressChartSeries[];
  testIDPrefix: string;
}) {
  const maxValue = getChartMaxValue(series);
  const { fontScale } = useWindowDimensions();
  const [surfaceWidth, setSurfaceWidth] = useState(0);
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
  const isPortfolioChart = testIDPrefix === "portfolio-trend";
  const pointCount = series[0]?.values.length ?? 0;
  const spacingValue = getChartSpacing(pointCount, plotWidth);
  const [focusedSeries, setFocusedSeries] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(pointCount - 1, 0),
  );
  const safeSelectedIndex = Math.min(
    selectedIndex,
    Math.max(pointCount - 1, 0),
  );

  const chartName = isPortfolioChart ? "Portfolio Growth" : "Asset Momentum";

  return (
    <View style={styles.chartBlock}>
      <View style={styles.monthNavigation}>
        <AppButton
          accessibilityLabel={`${chartName}: previous stored month`}
          disabled={safeSelectedIndex === 0}
          onPress={() => setSelectedIndex(safeSelectedIndex - 1)}
          testID={`${testIDPrefix}-previous-month`}
          title="‹" variant="secondary"
        />
        <AppText align="center" style={styles.monthNavigationLabel} variant="caption" weight="bold">
          {monthLabels[safeSelectedIndex] ?? ""}
        </AppText>
        <AppButton
          accessibilityLabel={`${chartName}: next stored month`}
          disabled={safeSelectedIndex >= pointCount - 1}
          onPress={() => setSelectedIndex(safeSelectedIndex + 1)}
          testID={`${testIDPrefix}-next-month`}
          title="›" variant="secondary"
        />
      </View>
      <SelectedMonthPanel
        maskWealthValues={maskWealthValues}
        minimal={minimal}
        monthLabel={monthLabels[safeSelectedIndex] ?? ""}
        selectedIndex={safeSelectedIndex}
        series={series}
        testIDPrefix={testIDPrefix}
      />
      <View style={styles.chartWithAxis} testID={`${testIDPrefix}-plot-region`}>
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
            {...axisProps}
            adjustToWidth
            areaChart
            color1={getDisplayedSeriesColor(
              series[0]?.label ?? "",
              focusedSeries,
            )}
            color2={getDisplayedSeriesColor(
              series[1]?.label ?? "",
              focusedSeries,
            )}
            curved
            data={toGiftedChartData(series[0], monthLabels, true, safeSelectedIndex)}
            data2={toGiftedChartData(series[1], monthLabels, false, safeSelectedIndex)}
            dataPointsColor1={getSeriesColor(series[0]?.label ?? "")}
            dataPointsColor2={getSeriesColor(series[1]?.label ?? "")}
            dataPointsRadius1={3}
            dataPointsRadius2={3}
            disableScroll
            endFillColor="rgba(52,199,89,0)"
            endOpacity={0}
            endSpacing={chartEndSpacing}
            initialSpacing={chartInitialSpacing}
            intersectionAreaConfig={{ fillColor: "rgba(52,199,89,0.14)" }}
            isAnimated={!isReducedMotionEnabled}
            rulesColor={colors.border.subtle}
            rulesType="dashed"
            spacing={spacingValue}
            startFillColor="rgba(52,199,89,0.18)"
            startOpacity={0.18}
            thickness1={3}
            thickness2={3}
            strokeDashArray2={[6, 4]}
            xAxisColor={colors.border.subtle}
            xAxisLabelTextStyle={styles.axisText}
            xAxisThickness={1}
            yAxisColor="transparent"
            yAxisTextStyle={styles.axisText}
            yAxisThickness={0}
            />
          ) : (
            <LineChart
            {...axisProps}
            adjustToWidth
            curved
            dataSet={series.map((item, index) => ({
              color: getDisplayedSeriesColor(item.label, focusedSeries),
              data: toGiftedChartData(item, monthLabels, index === 0, safeSelectedIndex),
              dataPointsColor: getSeriesColor(item.label),
              dataPointsRadius: 3,
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
            xAxisThickness={1}
            yAxisColor="transparent"
            yAxisTextStyle={styles.axisText}
            yAxisThickness={0}
            />
          )}
        </View>
      </View>
      <TrendLegend
        focusedSeries={focusedSeries}
        onFocusSeries={setFocusedSeries}
        series={series}
        testIDPrefix={testIDPrefix}
      />
    </View>
  );
}

function ChartRangeSelector({
  onChange,
  selectedRange,
  testIDPrefix,
}: {
  onChange: (range: MonthlyChartRange) => void;
  selectedRange: MonthlyChartRange;
  testIDPrefix: string;
}) {
  return (
    <View style={styles.rangeSelector}>
      {MONTHLY_CHART_RANGES.map((range) => {
        const isSelected = selectedRange === range;

        return (
          <Pressable
            accessibilityLabel={`${testIDPrefix.startsWith("portfolio") ? "Portfolio Growth" : "Asset Momentum"}: show ${range}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            android_ripple={androidRipple(
              isSelected
                ? interaction.primaryRippleColor
                : interaction.rippleColor,
            )}
            key={range}
            onPress={() => onChange(range)}
            style={({ pressed }) => [
              styles.rangeChip,
              minimumTouchTargetStyle,
              isSelected ? styles.rangeChipSelected : null,
              getPressedStateStyle({ pressed }),
            ]}
            testID={`${testIDPrefix}-${range}`}
          >
            <AppText
              color={isSelected ? "inverse" : "secondary"}
              variant="caption"
              weight="bold"
            >
              {range}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function MonthPickerField({
  label,
  months,
  onChange,
  testID,
  value,
}: {
  label: string;
  months: string[];
  onChange: (month: string) => void;
  testID: string;
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.monthPickerContainer}>
      <AppText color="secondary" variant="caption">
        {label}
      </AppText>
      <Pressable
        accessibilityLabel={`Choose ${label.toLowerCase()}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.monthPickerField,
          getPressedStateStyle({ pressed }),
        ]}
        testID={testID}
      >
        <AppText variant="caption" weight="bold">
          {value ? formatMonth(value) : "Choose month"}
        </AppText>
        <AppText color="secondary" variant="caption">
          Change
        </AppText>
      </Pressable>
      <Modal
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
        transparent
        visible={isOpen}
      >
        <View style={styles.monthPickerOverlay}>
          <Pressable
            accessibilityLabel="Close month picker"
            onPress={() => setIsOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.monthPickerSheet}>
            <View style={styles.monthPickerHeader}>
              <AppText variant="title" weight="bold">
                {label}
              </AppText>
              <AppText color="secondary" variant="caption">
                Stored snapshots only
              </AppText>
            </View>
            <ScrollView
              contentContainerStyle={styles.monthPickerOptions}
              keyboardShouldPersistTaps="handled"
            >
              {months.map((month) => {
                const isSelected = month === value;

                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    key={month}
                    onPress={() => {
                      onChange(month);
                      setIsOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.monthPickerOption,
                      isSelected ? styles.monthPickerOptionSelected : null,
                      getPressedStateStyle({ pressed }),
                    ]}
                    testID={`${testID}-${month}`}
                  >
                    <AppText weight={isSelected ? "bold" : "medium"}>
                      {formatMonth(month)}
                    </AppText>
                    {isSelected ? (
                      <AppText style={styles.gainText} variant="caption">
                        Selected
                      </AppText>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CustomMonthRangeControls({
  appliedRange,
  availableMonths,
  onApply,
  testIDPrefix,
}: {
  appliedRange: MonthlyChartCustomRange;
  availableMonths: string[];
  onApply: (range: MonthlyChartCustomRange) => void;
  testIDPrefix: string;
}) {
  const [startMonth, setStartMonth] = useState(appliedRange.startMonth);
  const [endMonth, setEndMonth] = useState(appliedRange.endMonth);
  const [error, setError] = useState<string | null>(null);
  const availableStartMonths = availableMonths.slice(0, -1);
  const availableEndMonths = availableMonths.filter(
    (month) => !startMonth || month > startMonth,
  );

  useEffect(() => {
    setStartMonth(appliedRange.startMonth);
    setEndMonth(appliedRange.endMonth);
    setError(null);
  }, [appliedRange.endMonth, appliedRange.startMonth]);

  function changeStartMonth(nextStartMonth: string) {
    setStartMonth(nextStartMonth);
    setEndMonth((currentEndMonth) =>
      currentEndMonth > nextStartMonth
        ? currentEndMonth
        : availableMonths.at(-1) ?? nextStartMonth,
    );
    setError(null);
  }

  function changeEndMonth(nextEndMonth: string) {
    setEndMonth(nextEndMonth);
    setError(null);
  }

  function applyRange() {
    if (!startMonth || !endMonth) {
      setError("Choose both months.");
      return;
    }

    if (startMonth >= endMonth) {
      setError("To month must be later than From month.");
      return;
    }

    setError(null);
    onApply({ endMonth, startMonth });
  }

  return (
    <View style={styles.customRangePanel}>
      <View style={styles.customRangeFields}>
        <MonthPickerField
          label="From month"
          months={availableStartMonths}
          onChange={changeStartMonth}
          testID={`${testIDPrefix}-start`}
          value={startMonth}
        />
        <MonthPickerField
          label="To month"
          months={availableEndMonths}
          onChange={changeEndMonth}
          testID={`${testIDPrefix}-end`}
          value={endMonth}
        />
      </View>
      {error ? (
        <AppText style={styles.lossText} testID={`${testIDPrefix}-error`} variant="caption">
          {error}
        </AppText>
      ) : null}
      <AppButton
        onPress={applyRange}
        testID={`${testIDPrefix}-apply`}
        title="Apply range"
      />
    </View>
  );
}

function ChartCardHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.chartCardHeader}>
      <AppText variant="title" weight="bold">{title}</AppText>
      <AppText color="secondary" variant="caption">{subtitle}</AppText>
    </View>
  );
}

function ProgressTrendCards({
  assetChartCustomRange,
  assetChartData,
  assetChartRange,
  isReducedMotionEnabled,
  maskWealthValues,
  onAssetCustomRangeChange,
  onAssetRangeChange,
  onPortfolioCustomRangeChange,
  onPortfolioRangeChange,
  portfolioChartCustomRange,
  portfolioChartData,
  portfolioChartRange,
  minimal,
}: {
  assetChartCustomRange: MonthlyChartCustomRange;
  assetChartData: MonthlyProgressChartData;
  assetChartRange: MonthlyChartRange;
  isReducedMotionEnabled: boolean;
  maskWealthValues: boolean;
  onAssetCustomRangeChange: (range: MonthlyChartCustomRange) => void;
  onAssetRangeChange: (range: MonthlyChartRange) => void;
  onPortfolioCustomRangeChange: (range: MonthlyChartCustomRange) => void;
  onPortfolioRangeChange: (range: MonthlyChartRange) => void;
  portfolioChartCustomRange: MonthlyChartCustomRange;
  portfolioChartData: MonthlyProgressChartData;
  portfolioChartRange: MonthlyChartRange;
  minimal: boolean;
}) {
  if (
    portfolioChartData.availableMonths.length < 2 &&
    assetChartData.availableMonths.length < 2
  ) {
    return (
      <PremiumCard>
        <SectionHeader title="Trend history is still building" />
        <View style={styles.chartPlaceholder}>
          <AppText color="secondary" align="center">
            Record at least 2 monthly snapshots to compare portfolio and asset trends.
          </AppText>
        </View>
      </PremiumCard>
    );
  }

  return (
    <>
      <PremiumCard>
        <ChartCardHeader
          subtitle="Portfolio value compared with invested capital"
          title="Portfolio Growth"
        />
        <ChartRangeSelector
          onChange={onPortfolioRangeChange}
          selectedRange={portfolioChartRange}
          testIDPrefix="portfolio-monthly-chart-range"
        />
        {portfolioChartRange === "Custom" ? (
          <CustomMonthRangeControls
            appliedRange={portfolioChartCustomRange}
            availableMonths={portfolioChartData.availableMonths}
            onApply={onPortfolioCustomRangeChange}
            testIDPrefix="portfolio-custom-range"
          />
        ) : null}
        {portfolioChartData.hasEnoughHistory ? (
          <TrendChart
            key={`${portfolioChartRange}:${portfolioChartCustomRange.startMonth}:${portfolioChartCustomRange.endMonth}:${portfolioChartData.monthLabels.join("|")}`}
            isReducedMotionEnabled={isReducedMotionEnabled}
            maskWealthValues={maskWealthValues}
            minimal={minimal}
            monthLabels={portfolioChartData.monthLabels}
            series={portfolioChartData.portfolioSeries}
            testIDPrefix="portfolio-trend"
          />
        ) : (
          <View style={styles.chartPlaceholder}>
            <AppText color="secondary" align="center">
              Select at least 2 stored snapshot months to show this trend.
            </AppText>
          </View>
        )}
      </PremiumCard>
      <PremiumCard>
        <ChartCardHeader
          subtitle="Absolute value trend - cash excluded"
          title="Asset Momentum"
        />
        <ChartRangeSelector
          onChange={onAssetRangeChange}
          selectedRange={assetChartRange}
          testIDPrefix="asset-monthly-chart-range"
        />
        {assetChartRange === "Custom" ? (
          <CustomMonthRangeControls
            appliedRange={assetChartCustomRange}
            availableMonths={assetChartData.availableMonths}
            onApply={onAssetCustomRangeChange}
            testIDPrefix="asset-custom-range"
          />
        ) : null}
        {assetChartData.hasEnoughHistory ? (
          <>
            <TrendChart
              key={`${assetChartRange}:${assetChartCustomRange.startMonth}:${assetChartCustomRange.endMonth}:${assetChartData.monthLabels.join("|")}`}
              isReducedMotionEnabled={isReducedMotionEnabled}
              maskWealthValues={maskWealthValues}
              minimal={minimal}
              monthLabels={assetChartData.monthLabels}
              series={assetChartData.assetSeries}
              testIDPrefix="asset-trend"
            />
          </>
        ) : (
          <View style={styles.chartPlaceholder}>
            <AppText color="secondary" align="center">
              Select at least 2 stored snapshot months to show this trend.
            </AppText>
          </View>
        )}
      </PremiumCard>
    </>
  );
}

function SnapshotStatusCard({
  onReview,
  status,
}: {
  onReview: () => void;
  status: ProgressSnapshotAutomationStatus;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotionPreference();
  const priceConfidence = status.snapshot
    ? getMonthlySnapshotPriceConfidence(status.snapshot)
    : null;
  const provisionalMonthLabels = status.provisionalMonths.map(formatMonth);
  const latestProvisionalMonth =
    provisionalMonthLabels[provisionalMonthLabels.length - 1];
  const provisionalMonthCopy = provisionalMonthLabels.length
    ? provisionalMonthLabels.length > 2
      ? `Estimated prices remain for ${provisionalMonthLabels.length} months, latest ${latestProvisionalMonth}. Review if you have better month-end values.`
      : `Estimated prices remain for ${provisionalMonthLabels.join(", ")}. Review if you have better month-end values.`
    : null;

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Snapshot status and review" onPress={() => setOpen(true)} style={styles.snapshotStatusCard} testID="month-end-snapshot-status-card">
        <View style={styles.snapshotStatusHeader}>
          <View style={styles.snapshotCopy}>
            <AppText weight="bold">Month-end snapshot</AppText>
            <AppText color="secondary" variant="caption">{status.message}</AppText>
          </View>
          <AppText color="secondary" variant="caption">Details</AppText>
        </View>
      </Pressable>
      <Modal visible={open} transparent animationType={reducedMotion ? "none" : "fade"} onRequestClose={() => setOpen(false)}>
        <View style={[styles.monthPickerOverlay, { paddingBottom: insets.bottom + spacing.md, paddingTop: insets.top + spacing.md }]}>
          <View style={styles.monthPickerSheet}>
            <AppButton title="Close snapshot status" variant="secondary" onPress={() => setOpen(false)} />
            <ScrollView>
    <View
      style={styles.snapshotStatusCard}
      testID="month-end-snapshot-status-details"
    >
      <View style={styles.snapshotStatusHeader}>
        <View style={styles.snapshotCopy}>
          <AppText weight="bold">Month-end snapshot</AppText>
          <AppText color="secondary" variant="caption">
            {status.message}
          </AppText>
        </View>
        <AppButton
          accessibilityLabel="Review month-end snapshot"
          onPress={() => { setOpen(false); onReview(); }}
          style={styles.snapshotReviewAction}
          title="Review"
          variant="secondary"
        />
      </View>
      {status.warnings.map((warning) => (
        <AppText color="secondary" key={warning} variant="caption">
          {warning}
        </AppText>
      ))}
      {provisionalMonthCopy ? (
        <AppText color="secondary" variant="caption">
          {provisionalMonthCopy}
        </AppText>
      ) : null}
      {priceConfidence === "confirmed" && !provisionalMonthCopy ? (
        <AppText color="secondary" variant="caption">
          Month-end prices confirmed.
        </AppText>
      ) : null}
      {priceConfidence === "manual" ? (
        <AppText color="secondary" variant="caption">
          Reviewed values saved manually.
        </AppText>
      ) : null}
    </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function ProgressScreen({
  now,
  onReviewSnapshot,
  store = getPortfolioStore(),
}: ProgressScreenProps) {
  const progress = useProgress({ now, store });
  const isReducedMotionEnabled = useReducedMotionPreference();
  const isMinimalMode = progress.preferences.displayMode === "minimal";
  const hasRunAutomationRef = useRef(false);
  const [summaryMonth, setSummaryMonth] = useState("");
  const selectedSummary = progress.monthlySummaries.find(item => item.snapshot.month === summaryMonth) ?? progress.latestSummary;

  useEffect(() => {
    if (hasRunAutomationRef.current || isVisualQaSessionActive()) {
      return;
    }

    hasRunAutomationRef.current = true;
    void progress.ensureMonthEndSnapshot();
  }, [progress]);

  function reviewSnapshot() {
    onReviewSnapshot?.();
  }

  return (
    <ScreenContainer scroll testID="progress-screen">
      <View style={styles.content}>
        <ScreenHeader
          title="Monthly Progress"
          action={<IconButton
            accessibilityLabel={progress.preferences.maskWealthValues ? "Show values" : "Mask values"}
            icon={progress.preferences.maskWealthValues ? "eye-off-outline" : "eye-outline"}
            onPress={() => store.getState().updatePreferences({ maskWealthValues: !progress.preferences.maskWealthValues })}
            testID="progress-mask-toggle"
          />}
          subtitle={
            progress.latestSummary
              ? "Stored month-end values"
              : getMonthLabel()
          }
        />
        {selectedSummary ? (
          <>
            <View style={styles.monthlyAnswer} testID="progress-monthly-answer">
              <MonthPickerField label="Month-end value"
                months={progress.monthlySummaries.map(item => item.snapshot.month)}
                value={selectedSummary.snapshot.month} onChange={setSummaryMonth} testID="progress-summary-month" />
              <AppText style={styles.heroValue} weight="bold">
                {progress.preferences.maskWealthValues ? maskedChartValueLabel : formatCompactINR(selectedSummary.snapshot.portfolioValue)}
              </AppText>
              <View style={styles.answerMetrics}>
                <View style={styles.answerMetric}>
                  <AppText color="secondary" variant="caption">Market change</AppText>
                  <AppText weight="bold">{progress.preferences.maskWealthValues && selectedSummary.performance.marketMovement !== null ? maskedChartValueLabel : formatOptionalSignedCompactINR(selectedSummary.performance.marketMovement)}</AppText>
                </View>
                <View style={styles.answerMetric}>
                  <AppText color="secondary" variant="caption">Monthly investment</AppText>
                  <AppText weight="bold">{progress.preferences.maskWealthValues ? maskedChartValueLabel : formatCompactINR(selectedSummary.snapshot.monthlyInvestment)}</AppText>
                </View>
              </View>
            </View>

            <SnapshotStatusCard
              onReview={reviewSnapshot}
              status={progress.snapshotAutomationStatus}
            />

            <ProgressTrendCards
              assetChartCustomRange={progress.assetChartCustomRange}
              assetChartData={progress.assetChartData}
              assetChartRange={progress.assetChartRange}
              isReducedMotionEnabled={isReducedMotionEnabled}
              maskWealthValues={progress.preferences.maskWealthValues}
              onAssetCustomRangeChange={progress.setAssetChartCustomRange}
              onAssetRangeChange={progress.setAssetChartRange}
              onPortfolioCustomRangeChange={
                progress.setPortfolioChartCustomRange
              }
              onPortfolioRangeChange={progress.setPortfolioChartRange}
              portfolioChartCustomRange={progress.portfolioChartCustomRange}
              portfolioChartData={progress.portfolioChartData}
              portfolioChartRange={progress.portfolioChartRange}
              minimal={isMinimalMode}
            />

            <MonthlyHistoryPanel
              maskWealthValues={progress.preferences.maskWealthValues}
              minimal={isMinimalMode}
              summaries={progress.monthlySummaries}
            />
          </>
        ) : progress.hasData ? (
          <>
            <MetricGroup
              metrics={[
                {
                  label: "Portfolio",
                  masked:
                    progress.preferences.maskWealthValues &&
                    progress.portfolioValue !== null,
                  value:
                    progress.portfolioValue === null
                      ? "Valuation pending"
                      : formatCompactINR(progress.portfolioValue),
                },
                {
                  label: "Invested",
                  masked: progress.preferences.maskWealthValues,
                  value: formatCompactINR(progress.totalInvested),
                },
                {
                  label: "Cash",
                  masked: progress.preferences.maskWealthValues,
                  value: formatCompactINR(progress.cashBalance),
                },
                {
                  label: "Investment rate",
                  masked: progress.preferences.maskWealthValues,
                  value:
                    progress.investmentRate === null
                      ? "Not enough data"
                      : `${progress.investmentRate.toFixed(2)}%`,
                },
              ]}
            />

            <SnapshotStatusCard
              onReview={reviewSnapshot}
              status={progress.snapshotAutomationStatus}
            />

            {isMinimalMode ? null : (
              <PremiumCard>
                <SectionHeader title="What changed this month?" />
                <AppText color="secondary">
                  Monthly investment: {progress.preferences.maskWealthValues ? maskedChartValueLabel : formatINR(progress.monthlyInvestment)}
                </AppText>
                <AppText color="secondary">
                  Typed income:{" "}
                  {progress.monthlyIncome === null
                    ? "Not enough data"
                    : progress.preferences.maskWealthValues ? maskedChartValueLabel : formatINR(progress.monthlyIncome)}
                </AppText>
                <AppText color="secondary">
                  Expense rate needs explicit expense tracking and is not shown in V1.
                </AppText>
              </PremiumCard>
            )}

            <ProgressTrendCards
              assetChartCustomRange={progress.assetChartCustomRange}
              assetChartData={progress.assetChartData}
              assetChartRange={progress.assetChartRange}
              isReducedMotionEnabled={isReducedMotionEnabled}
              maskWealthValues={progress.preferences.maskWealthValues}
              onAssetCustomRangeChange={progress.setAssetChartCustomRange}
              onAssetRangeChange={progress.setAssetChartRange}
              onPortfolioCustomRangeChange={
                progress.setPortfolioChartCustomRange
              }
              onPortfolioRangeChange={progress.setPortfolioChartRange}
              portfolioChartCustomRange={progress.portfolioChartCustomRange}
              portfolioChartData={progress.portfolioChartData}
              portfolioChartRange={progress.portfolioChartRange}
              minimal={isMinimalMode}
            />

            <PremiumCard>
              <SectionHeader
                title={
                  progress.allocation.some((item) => item.percentage === null)
                    ? "Asset class balances"
                    : "Asset class snapshot"
                }
              />
              {progress.allocation.some((item) => item.percentage === null) ? (
                <AppText color="secondary" variant="caption">
                  Allocation percentages are unavailable while net portfolio
                  value is zero or negative.
                </AppText>
              ) : null}
              {progress.allocation.map((item) => (
                <View key={item.assetClass} style={styles.assetRow}>
                  <View style={styles.assetIdentity}>
                    <CategoryIcon assetClass={item.assetClass} />
                    <AppText weight="bold">{assetClassLabel(item.assetClass)}</AppText>
                  </View>
                  <View style={styles.assetValue}>
                    <AppText>{progress.preferences.maskWealthValues ? maskedChartValueLabel : formatINR(item.value)}</AppText>
                    {item.percentage === null ? null : (
                      <AppText color="secondary" variant="caption">
                        {progress.preferences.maskWealthValues ? "Hidden" : formatPercentage(item.percentage).replace("+", "")}
                      </AppText>
                    )}
                  </View>
                </View>
              ))}
            </PremiumCard>
          </>
        ) : (
          <>
            <EmptyState
              title="No monthly snapshots yet"
              message="Snapshots are created automatically once your portfolio has data. Review a snapshot only when a correction is needed."
            />
            <SnapshotStatusCard
              onReview={reviewSnapshot}
              status={progress.snapshotAutomationStatus}
            />
          </>
        )}

      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  monthNavigation: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  monthNavigationLabel: { flex: 1 },

  monthlyAnswer: { gap: spacing.sm },
  heroValue: { fontSize: 40, lineHeight: 48 },
  answerMetrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  answerMetric: { flex: 1, minWidth: 120, gap: spacing.xs },
  assetSelectionStack: { flexDirection: "column" },

  assetSelectionGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  assetSelectionMetric: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  assetIdentity: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.cardInner,
  },
  assetRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  assetValue: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  chartPlaceholder: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: 18,
    justifyContent: "center",
    minHeight: 120,
    padding: spacing.md,
  },
  chartBlock: {
    gap: spacing.sm,
  },
  chartCardHeader: {
    alignItems: "flex-start",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  chartLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  content: {
    gap: spacing.cardGap,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  customRangeFields: {
    flexDirection: "column",
    gap: spacing.sm,
  },
  customRangePanel: {
    backgroundColor: "#111113",
    borderRadius: 14,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  gapOutcome: {
    flex: 1,
    gap: spacing.xs,
  },
  gapValueRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  gapValues: {
    flex: 1,
    gap: spacing.xs,
  },
  legendItemDimmed: {
    opacity: 0.45,
  },
  legendItemFocused: {
    backgroundColor: colors.surface.elevated,
  },
  legendLine: {
    borderTopWidth: 2,
    width: 14,
  },
  legendLineDashed: {
    borderStyle: "dashed",
  },
  legendItem: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: interaction.minimumTouchTarget,
    paddingHorizontal: spacing.sm,
  },
  monthPickerContainer: {
    flex: 1,
    gap: spacing.xs,
  },
  monthPickerField: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: interaction.minimumTouchTarget,
    paddingHorizontal: spacing.sm,
  },
  monthPickerHeader: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  monthPickerOption: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: interaction.minimumTouchTarget,
    paddingHorizontal: spacing.md,
  },
  monthPickerOptionSelected: {
    backgroundColor: "rgba(52,199,89,0.12)",
  },
  monthPickerOptions: {
    gap: spacing.xs,
  },
  monthPickerOverlay: {
    backgroundColor: "rgba(0,0,0,0.72)",
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.md,
  },
  monthPickerSheet: {
    backgroundColor: colors.surface.card,
    borderRadius: 22,
    gap: spacing.sm,
    maxHeight: "72%",
    padding: spacing.md,
  },
  neutralText: {
    color: colors.text.secondary,
  },
  portfolioSelectionContent: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.md,
  },
  rangeChip: {
    alignItems: "center",
    borderRadius: 999,
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: "auto",
    minWidth: 48,
    paddingHorizontal: spacing.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingVertical: spacing.xs,
  },
  rangeChipSelected: {
    backgroundColor: colors.primary,
  },
  rangeSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    padding: spacing.xs,
  },
  selectedPanel: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  snapshotCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  snapshotReviewAction: {
    alignSelf: "flex-start",
  },
  snapshotStatusCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.button,
    gap: spacing.xs,
    paddingHorizontal: spacing.cardInner,
    paddingVertical: spacing.sm,
  },
  snapshotStatusHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  chartSurface: {
    flex: 1,
    backgroundColor: colors.surface.card,
    overflow: "hidden",
    paddingBottom: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.sm,
    paddingTop: spacing.sm,
  },
  axisText: {
    color: colors.text.secondary,
    fontSize: 11,
  },
  chartWithAxis: {
    alignItems: "stretch",
    flexDirection: "row",
  },
  gainText: {
    color: colors.profit,
  },
  lossText: {
    color: colors.loss,
  },
});
