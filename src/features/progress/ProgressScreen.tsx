import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  CategoryIcon,
  EmptyState,
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
  MonthlyPerformanceResult,
  MonthlyProgressChartSeries,
} from "@/src/domain/calculations";
import {
  getMonthlySnapshotPriceConfidence,
  MONTHLY_CHART_RANGES,
  type AssetChartInsight,
  type MonthlyChartCustomRange,
  type MonthlyChartRange,
  type MonthlyProgressChartData,
} from "@/src/domain/calculations";
import { formatCompactINR, formatINR, formatPercentage } from "@/src/domain/formatters";
import { useReducedMotionPreference } from "@/src/hooks";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, interaction, spacing } from "@/src/theme";
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

function formatSignedINR(value: number) {
  const amount = formatINR(value);

  return value > 0 ? `+${amount}` : amount;
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

function formatSnapshotChange(performance: MonthlyPerformanceResult) {
  if (performance.totalValueChange === null) {
    return "Baseline snapshot";
  }

  const totalChange = formatSignedINR(performance.totalValueChange);

  if (performance.marketMovement === null) {
    return `Performance unavailable · total ${totalChange}`;
  }

  return `Market ${formatSignedINR(
    performance.marketMovement,
  )} · total ${totalChange}`;
}

function formatUnsignedPercentage(value: number) {
  return formatPercentage(value).replace("+", "");
}

const chartHeight = 154;
const chartWidth = 228;
const chartYAxisWidth = 0;
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

function getYAxisLabels(series: MonthlyProgressChartSeries[], masked: boolean) {
  const maxValue = getChartMaxValue(series);

  return [maxValue, maxValue / 2, 0].map((value) =>
    formatChartYLabel(value, masked),
  );
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
) {
  const total = series.values.length;

  return series.values.map((value, index) => ({
    label:
      showAxisLabels && shouldShowAxisLabel(index, total)
        ? formatChartAxisLabel(monthLabels[index] ?? "")
        : "",
    value,
  }));
}

function getChartSpacing(pointCount: number) {
  if (pointCount <= 1) {
    return chartWidth / 2;
  }

  return Math.max(
    30,
    (chartWidth - chartInitialSpacing - chartEndSpacing) / (pointCount - 1),
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
    : ((currentValue - previousValue) / previousValue) * 100;
}

function SelectedMonthPanel({
  maskWealthValues,
  monthLabel,
  selectedIndex,
  series,
  testIDPrefix,
}: {
  maskWealthValues: boolean;
  monthLabel: string;
  selectedIndex: number;
  series: MonthlyProgressChartSeries[];
  testIDPrefix: string;
}) {
  const isPortfolioChart = testIDPrefix === "portfolio-trend";

  if (isPortfolioChart) {
    const portfolioValue = getSeriesValue(series, "Portfolio", selectedIndex);
    const investedValue = getSeriesValue(series, "Invested", selectedIndex);
    const difference = portfolioValue - investedValue;
    const differencePercentage =
      investedValue === 0 ? null : (difference / investedValue) * 100;
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
        style={styles.selectedPanel}
        testID={`${testIDPrefix}-selected-panel`}
      >
        <View style={styles.selectedPanelHeader}>
          <AppText color="secondary" variant="caption">
            Selected month
          </AppText>
          <AppText variant="caption" weight="bold">
            {monthLabel}
          </AppText>
        </View>
        {maskWealthValues ? (
          <AppText color="secondary">Performance values hidden</AppText>
        ) : (
          <View style={styles.portfolioSelectionContent}>
            <View style={styles.gapOutcome}>
              <AppText
                style={difference >= 0 ? styles.gainText : styles.lossText}
                variant="title"
                weight="bold"
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
      style={styles.selectedPanel}
      testID={`${testIDPrefix}-selected-panel`}
    >
      <View style={styles.selectedPanelHeader}>
        <AppText color="secondary" variant="caption">
          Selected month
        </AppText>
        <AppText variant="caption" weight="bold">
          {monthLabel}
        </AppText>
      </View>
      {maskWealthValues ? (
        <AppText color="secondary">Asset values hidden</AppText>
      ) : (
        <View style={styles.assetSelectionGrid}>
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
                  style={
                    change === null
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
  monthLabels,
  series,
  testIDPrefix,
}: {
  isReducedMotionEnabled: boolean;
  maskWealthValues: boolean;
  monthLabels: string[];
  series: MonthlyProgressChartSeries[];
  testIDPrefix: string;
}) {
  const maxValue = getChartMaxValue(series);
  const isPortfolioChart = testIDPrefix === "portfolio-trend";
  const pointCount = series[0]?.values.length ?? 0;
  const spacingValue = getChartSpacing(pointCount);
  const monthRangeKey = monthLabels.join("|");
  const [focusedSeries, setFocusedSeries] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(pointCount - 1, 0),
  );
  const safeSelectedIndex = Math.min(
    selectedIndex,
    Math.max(pointCount - 1, 0),
  );

  useEffect(() => {
    setSelectedIndex(Math.max(pointCount - 1, 0));
  }, [monthRangeKey, pointCount]);

  const selectPointerIndex = ({
    pointerIndex,
  }: {
    pointerIndex: number;
  }) => {
    if (pointerIndex >= 0 && pointerIndex < pointCount) {
      setSelectedIndex(pointerIndex);
    }
  };

  return (
    <View style={styles.chartBlock}>
      <SelectedMonthPanel
        maskWealthValues={maskWealthValues}
        monthLabel={monthLabels[safeSelectedIndex] ?? ""}
        selectedIndex={safeSelectedIndex}
        series={series}
        testIDPrefix={testIDPrefix}
      />
      <View style={styles.chartWithAxis}>
        <View style={styles.yAxisLabels}>
          {getYAxisLabels(series, maskWealthValues).map((label, index) => (
            <AppText
              key={`${label}-${index}`}
              color="secondary"
              testID={`${testIDPrefix}-y-axis-${index}`}
              variant="caption"
            >
              {label}
            </AppText>
          ))}
        </View>
        <View style={styles.chartSurface} testID={`${testIDPrefix}-chart`}>
          {isPortfolioChart ? (
            <LineChart
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
            data={toGiftedChartData(series[0], monthLabels)}
            data2={toGiftedChartData(series[1], monthLabels, false)}
            dataPointsColor1={getSeriesColor(series[0]?.label ?? "")}
            dataPointsColor2={getSeriesColor(series[1]?.label ?? "")}
            dataPointsRadius1={3}
            dataPointsRadius2={3}
            disableScroll
            endFillColor="rgba(52,199,89,0)"
            endOpacity={0}
            endSpacing={chartEndSpacing}
            formatYLabel={(label) => formatChartYLabel(label, maskWealthValues)}
            getPointerProps={selectPointerIndex}
            height={chartHeight}
            hideOrigin
            initialSpacing={chartInitialSpacing}
            intersectionAreaConfig={{ fillColor: "rgba(52,199,89,0.14)" }}
            isAnimated={!isReducedMotionEnabled}
            maxValue={maxValue}
            noOfSections={3}
            pointerConfig={{
              activatePointersOnLongPress: true,
              initialPointerIndex: Math.max(pointCount - 1, 0),
              persistPointer: true,
              pointerColor: colors.profit,
              pointerStripColor: colors.border.subtle,
              resetPointerIndexOnRelease: false,
            }}
            rulesColor={colors.border.subtle}
            rulesType="dashed"
            spacing={spacingValue}
            startFillColor="rgba(52,199,89,0.18)"
            startOpacity={0.18}
            thickness1={3}
            thickness2={3}
            strokeDashArray2={[6, 4]}
            width={chartWidth}
            xAxisColor={colors.border.subtle}
            xAxisLabelTextStyle={styles.axisText}
            xAxisThickness={1}
            yAxisColor="transparent"
            yAxisLabelWidth={chartYAxisWidth}
            yAxisTextStyle={styles.axisText}
            yAxisThickness={0}
            />
          ) : (
            <LineChart
            adjustToWidth
            curved
            dataSet={series.map((item, index) => ({
              color: getDisplayedSeriesColor(item.label, focusedSeries),
              data: toGiftedChartData(item, monthLabels, index === 0),
              dataPointsColor: getSeriesColor(item.label),
              dataPointsRadius: 3,
              thickness: 3,
            }))}
            disableScroll
            endSpacing={chartEndSpacing}
            formatYLabel={(label) => formatChartYLabel(label, maskWealthValues)}
            getPointerProps={selectPointerIndex}
            height={chartHeight}
            hideOrigin
            initialSpacing={chartInitialSpacing}
            isAnimated={!isReducedMotionEnabled}
            maxValue={maxValue}
            noOfSections={3}
            pointerConfig={{
              activatePointersOnLongPress: true,
              initialPointerIndex: Math.max(pointCount - 1, 0),
              persistPointer: true,
              pointerColor: colors.text.secondary,
              pointerStripColor: colors.border.subtle,
              resetPointerIndexOnRelease: false,
            }}
            rulesColor={colors.border.subtle}
            rulesType="dashed"
            spacing={spacingValue}
            width={chartWidth}
            xAxisColor={colors.border.subtle}
            xAxisLabelTextStyle={styles.axisText}
            xAxisThickness={1}
            yAxisColor="transparent"
            yAxisLabelWidth={chartYAxisWidth}
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
            accessibilityLabel={`Show ${range} monthly progress charts`}
            accessibilityRole="button"
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

function ChartCardHeader({
  actionLabel,
  actionTone = "positive",
  subtitle,
  title,
}: {
  actionLabel?: string;
  actionTone?: "negative" | "positive";
  subtitle: string;
  title: string;
}) {
  return (
    <View style={styles.chartCardHeader}>
      <View style={styles.snapshotCopy}>
        <AppText variant="title" weight="bold">
          {title}
        </AppText>
        <AppText color="secondary" variant="caption">
          {subtitle}
        </AppText>
      </View>
      {actionLabel ? (
        <View
          style={[
            styles.chartPill,
            actionTone === "negative" ? styles.chartPillNegative : null,
          ]}
        >
          <AppText
            variant="caption"
            weight="bold"
            style={
              actionTone === "negative" ? styles.lossText : styles.gainText
            }
          >
            {actionLabel}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function AssetInsightRows({ insights }: { insights: AssetChartInsight[] }) {
  return (
    <View style={styles.assetInsightGrid}>
      {insights.map((item) => (
        <View key={item.label} style={styles.assetInsightRow}>
          <View style={styles.snapshotCopy}>
            <AppText weight="bold">{item.label}</AppText>
            <AppText color="secondary" variant="caption">
              {`${formatUnsignedPercentage(item.allocationPct)} · share ${formatPercentage(
                item.allocationShiftPct,
              )}`}
            </AppText>
          </View>
          <View style={styles.assetValue}>
            <AppText
              weight="bold"
              style={item.latestDelta >= 0 ? styles.gainText : styles.lossText}
            >
              {formatSignedCompactINR(item.latestDelta)}
            </AppText>
            <AppText
              variant="caption"
              style={
                item.latestDeltaPct >= 0 ? styles.gainText : styles.lossText
              }
            >
              {formatPercentage(item.latestDeltaPct)}
            </AppText>
          </View>
        </View>
      ))}
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
            isReducedMotionEnabled={isReducedMotionEnabled}
            maskWealthValues={maskWealthValues}
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
          actionLabel={
            assetChartData.largestAssetMove
              ? `${assetChartData.largestAssetMove.label} ${formatPercentage(
                  assetChartData.largestAssetMove.latestDeltaPct,
                )}`
              : undefined
          }
          actionTone={
            (assetChartData.largestAssetMove?.latestDeltaPct ?? 0) >= 0
              ? "positive"
              : "negative"
          }
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
              isReducedMotionEnabled={isReducedMotionEnabled}
              maskWealthValues={maskWealthValues}
              monthLabels={assetChartData.monthLabels}
              series={assetChartData.assetSeries}
              testIDPrefix="asset-trend"
            />
            <AssetInsightRows insights={assetChartData.assetInsights} />
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
  const priceConfidence = status.snapshot
    ? getMonthlySnapshotPriceConfidence(status.snapshot)
    : null;
  const provisionalMonthLabels = status.provisionalMonths.map(formatMonth);
  const provisionalMonthCopy = provisionalMonthLabels.length
    ? `Estimated prices remain for ${provisionalMonthLabels.join(", ")}. Review if you have better month-end values.`
    : null;

  return (
    <PremiumCard testID="month-end-snapshot-status-card">
      <View style={styles.snapshotStatusHeader}>
        <View style={styles.snapshotCopy}>
          <SectionHeader title="Month-end snapshot" />
          <AppText color="secondary" variant="caption">
            {status.message}
          </AppText>
        </View>
        <AppButton title="Review snapshot" onPress={onReview} variant="secondary" />
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
    </PremiumCard>
  );
}

export function ProgressScreen({
  now,
  onReviewSnapshot,
  store = getPortfolioStore(),
}: ProgressScreenProps) {
  const progress = useProgress({ now, store });
  const isReducedMotionEnabled = useReducedMotionPreference();
  const hasRunAutomationRef = useRef(false);

  useEffect(() => {
    if (hasRunAutomationRef.current) {
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
          subtitle={
            progress.latestSummary
              ? `${formatMonth(progress.latestSummary.snapshot.month)} snapshot`
              : getMonthLabel()
          }
        />
        <SnapshotStatusCard
          onReview={reviewSnapshot}
          status={progress.snapshotAutomationStatus}
        />

        {progress.latestSummary ? (
          <>
            <MetricGroup
              metrics={[
                {
                  label: "Portfolio",
                  masked: progress.preferences.maskWealthValues,
                  value: formatCompactINR(
                    progress.latestSummary.snapshot.portfolioValue,
                  ),
                },
                {
                  label: "Market change",
                  masked:
                    progress.latestSummary.performance.marketMovement !== null &&
                    progress.preferences.maskWealthValues,
                  value: formatOptionalSignedCompactINR(
                    progress.latestSummary.performance.marketMovement,
                  ),
                },
                {
                  label: "Net contribution",
                  masked:
                    progress.latestSummary.performance.netExternalFlow !== null &&
                    progress.preferences.maskWealthValues,
                  value: formatOptionalSignedCompactINR(
                    progress.latestSummary.performance.netExternalFlow,
                  ),
                },
                {
                  label: "Monthly investment",
                  masked: progress.preferences.maskWealthValues,
                  value: formatCompactINR(
                    progress.latestSummary.snapshot.monthlyInvestment,
                  ),
                },
              ]}
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
            />

            <PremiumCard>
              <SectionHeader title="Asset class snapshot" />
              {progress.latestSummary.assetSnapshot.map((item) => (
                <View key={item.assetClass} style={styles.assetRow}>
                  <View style={styles.assetIdentity}>
                    <CategoryIcon assetClass={item.assetClass} />
                    <AppText weight="bold">{assetClassLabel(item.assetClass)}</AppText>
                  </View>
                  <View style={styles.assetValue}>
                    <AppText>{formatINR(item.value)}</AppText>
                    <AppText color="secondary" variant="caption">
                      {formatPercentage(item.percentage).replace("+", "")}
                    </AppText>
                  </View>
                </View>
              ))}
            </PremiumCard>

            <PremiumCard>
              <SectionHeader title="Recent snapshots" />
              {progress.monthlySummaries.map((summary) => (
                <View key={summary.snapshot.id} style={styles.snapshotRow}>
                  <View style={styles.snapshotCopy}>
                    <AppText weight="bold">{formatMonth(summary.snapshot.month)}</AppText>
                    {summary.snapshot.notes ? (
                      <AppText color="secondary" variant="caption">
                        {summary.snapshot.notes}
                      </AppText>
                    ) : null}
                  </View>
                  <View style={styles.assetValue}>
                    <AppText>
                      {progress.preferences.maskWealthValues
                        ? maskedChartValueLabel
                        : formatINR(summary.snapshot.portfolioValue)}
                    </AppText>
                    <AppText color="secondary" variant="caption">
                      {progress.preferences.maskWealthValues
                        ? "Performance values hidden"
                        : formatSnapshotChange(summary.performance)}
                    </AppText>
                  </View>
                </View>
              ))}
            </PremiumCard>
          </>
        ) : progress.hasData ? (
          <>
            <MetricGroup
              metrics={[
                {
                  label: "Portfolio",
                  masked: progress.preferences.maskWealthValues,
                  value: formatCompactINR(progress.portfolioValue),
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
                  value:
                    progress.investmentRate === null
                      ? "Not enough data"
                      : `${progress.investmentRate.toFixed(2)}%`,
                },
              ]}
            />

            <PremiumCard>
              <SectionHeader title="What changed this month?" />
              <AppText color="secondary">
                Monthly investment: {formatINR(progress.monthlyInvestment)}
              </AppText>
              <AppText color="secondary">
                Typed income:{" "}
                {progress.monthlyIncome === null
                  ? "Not enough data"
                  : formatINR(progress.monthlyIncome)}
              </AppText>
              <AppText color="secondary">
                Expense rate needs explicit expense tracking and is not shown in V1.
              </AppText>
            </PremiumCard>

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
            />

            <PremiumCard>
              <SectionHeader title="Asset class snapshot" />
              {progress.allocation.map((item) => (
                <View key={item.assetClass} style={styles.assetRow}>
                  <View style={styles.assetIdentity}>
                    <CategoryIcon assetClass={item.assetClass} />
                    <AppText weight="bold">{assetClassLabel(item.assetClass)}</AppText>
                  </View>
                  <View style={styles.assetValue}>
                    <AppText>{formatINR(item.value)}</AppText>
                    <AppText color="secondary" variant="caption">
                      {formatPercentage(item.percentage).replace("+", "")}
                    </AppText>
                  </View>
                </View>
              ))}
            </PremiumCard>
          </>
        ) : (
          <EmptyState
            title="No monthly snapshots yet"
            message="Snapshots are created automatically once your portfolio has data. Review a snapshot only when a correction is needed."
          />
        )}

      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  chartPill: {
    backgroundColor: "rgba(52,199,89,0.12)",
    borderColor: "rgba(52,199,89,0.20)",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chartPillNegative: {
    backgroundColor: "rgba(255,69,58,0.12)",
    borderColor: "rgba(255,69,58,0.22)",
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
    flexDirection: "row",
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
    flex: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingVertical: spacing.xs,
  },
  rangeChipSelected: {
    backgroundColor: colors.primary,
  },
  rangeSelector: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: colors.border.subtle,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xs,
  },
  selectedPanel: {
    backgroundColor: "#111113",
    borderRadius: 14,
    gap: spacing.sm,
    minHeight: 82,
    padding: spacing.cardInner,
  },
  selectedPanelHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  snapshotCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  snapshotStatusHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  snapshotRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.cardInner,
    justifyContent: "space-between",
  },
  chartSurface: {
    flex: 1,
    backgroundColor: "#111113",
    borderColor: colors.border.subtle,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
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
    gap: spacing.sm,
  },
  yAxisLabels: {
    justifyContent: "space-between",
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
    width: 30,
  },
  assetInsightGrid: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  assetInsightRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  gainText: {
    color: colors.profit,
  },
  lossText: {
    color: colors.loss,
  },
});
