import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
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
import type { MonthlyProgressChartSeries } from "@/src/domain/calculations";
import {
  MONTHLY_CHART_RANGES,
  type AssetChartInsight,
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

function TrendLegend({
  series,
  testIDPrefix,
}: {
  series: MonthlyProgressChartSeries[];
  testIDPrefix: string;
}) {
  return (
    <View style={styles.chartLegend}>
      {series.map((item) => (
        <View
          key={item.label}
          style={styles.legendItem}
          testID={`${testIDPrefix}-${item.label}`}
        >
          <View
            style={[
              styles.legendDot,
              { backgroundColor: getSeriesColor(item.label) },
            ]}
          />
          <AppText color="secondary" variant="caption" weight="medium">
            {item.label}
          </AppText>
        </View>
      ))}
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

  return (
    <View style={styles.chartBlock}>
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
            color1={getSeriesColor(series[0]?.label ?? "")}
            color2={getSeriesColor(series[1]?.label ?? "")}
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
            height={chartHeight}
            hideOrigin
            initialSpacing={chartInitialSpacing}
            intersectionAreaConfig={{ fillColor: "rgba(52,199,89,0.14)" }}
            isAnimated={!isReducedMotionEnabled}
            maxValue={maxValue}
            noOfSections={3}
            pointerConfig={{
              activatePointersOnLongPress: true,
              pointerColor: colors.profit,
              pointerStripColor: colors.border.subtle,
            }}
            rulesColor={colors.border.subtle}
            rulesType="dashed"
            spacing={spacingValue}
            startFillColor="rgba(52,199,89,0.18)"
            startOpacity={0.18}
            thickness1={3}
            thickness2={3}
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
              color: getSeriesColor(item.label),
              data: toGiftedChartData(item, monthLabels, index === 0),
              dataPointsColor: getSeriesColor(item.label),
              dataPointsRadius: 3,
              thickness: 3,
            }))}
            disableScroll
            endSpacing={chartEndSpacing}
            formatYLabel={(label) => formatChartYLabel(label, maskWealthValues)}
            height={chartHeight}
            hideOrigin
            initialSpacing={chartInitialSpacing}
            isAnimated={!isReducedMotionEnabled}
            maxValue={maxValue}
            noOfSections={3}
            pointerConfig={{
              activatePointersOnLongPress: true,
              pointerColor: colors.text.secondary,
              pointerStripColor: colors.border.subtle,
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
      <TrendLegend series={series} testIDPrefix={testIDPrefix} />
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
  assetChartData,
  assetChartRange,
  isReducedMotionEnabled,
  maskWealthValues,
  onAssetRangeChange,
  onPortfolioRangeChange,
  portfolioChartData,
  portfolioChartRange,
}: {
  assetChartData: MonthlyProgressChartData;
  assetChartRange: MonthlyChartRange;
  isReducedMotionEnabled: boolean;
  maskWealthValues: boolean;
  onAssetRangeChange: (range: MonthlyChartRange) => void;
  onPortfolioRangeChange: (range: MonthlyChartRange) => void;
  portfolioChartData: MonthlyProgressChartData;
  portfolioChartRange: MonthlyChartRange;
}) {
  if (
    !portfolioChartData.hasEnoughHistory &&
    !assetChartData.hasEnoughHistory
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
          actionLabel={
            portfolioChartData.portfolioInsight
              ? formatPercentage(portfolioChartData.portfolioInsight.valueGapPct)
              : undefined
          }
          actionTone={
            (portfolioChartData.portfolioInsight?.valueGap ?? 0) >= 0
              ? "positive"
              : "negative"
          }
          subtitle="Portfolio value against invested capital"
          title="Value Gap"
        />
        <ChartRangeSelector
          onChange={onPortfolioRangeChange}
          selectedRange={portfolioChartRange}
          testIDPrefix="portfolio-monthly-chart-range"
        />
        <TrendChart
          isReducedMotionEnabled={isReducedMotionEnabled}
          maskWealthValues={maskWealthValues}
          monthLabels={portfolioChartData.monthLabels}
          series={portfolioChartData.portfolioSeries}
          testIDPrefix="portfolio-trend"
        />
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
        <TrendChart
          isReducedMotionEnabled={isReducedMotionEnabled}
          maskWealthValues={maskWealthValues}
          monthLabels={assetChartData.monthLabels}
          series={assetChartData.assetSeries}
          testIDPrefix="asset-trend"
        />
        <AssetInsightRows insights={assetChartData.assetInsights} />
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
                  label: "Monthly gain",
                  masked: progress.preferences.maskWealthValues,
                  value: formatSignedCompactINR(progress.latestSummary.monthlyGain),
                },
                {
                  label: "Monthly investment",
                  masked: progress.preferences.maskWealthValues,
                  value: formatCompactINR(
                    progress.latestSummary.snapshot.monthlyInvestment,
                  ),
                },
                {
                  label: "Value move",
                  masked: progress.preferences.maskWealthValues,
                  value: formatSignedCompactINR(
                    progress.portfolioChartData.portfolioInsight?.valueMove ?? 0,
                  ),
                },
              ]}
            />

            <ProgressTrendCards
              assetChartData={progress.assetChartData}
              assetChartRange={progress.assetChartRange}
              isReducedMotionEnabled={isReducedMotionEnabled}
              maskWealthValues={progress.preferences.maskWealthValues}
              onAssetRangeChange={progress.setAssetChartRange}
              onPortfolioRangeChange={progress.setPortfolioChartRange}
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
                    <AppText>{formatINR(summary.snapshot.portfolioValue)}</AppText>
                    <AppText color="secondary" variant="caption">
                      {formatSignedINR(summary.monthlyGain)}
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
                  label: "Savings",
                  value: progress.monthlyCashAdded === 0 ? "Not enough data" : formatPercentage(progress.savingsRate),
                },
              ]}
            />

            <PremiumCard>
              <SectionHeader title="What changed this month?" />
              <AppText color="secondary">
                Monthly investment: {formatINR(progress.monthlyInvestment)}
              </AppText>
              <AppText color="secondary">
                Cash added: {formatINR(progress.monthlyCashAdded)}
              </AppText>
              <AppText color="secondary">
                Expense rate needs explicit expense tracking and is not shown in V1.
              </AppText>
            </PremiumCard>

            <ProgressTrendCards
              assetChartData={progress.assetChartData}
              assetChartRange={progress.assetChartRange}
              isReducedMotionEnabled={isReducedMotionEnabled}
              maskWealthValues={progress.preferences.maskWealthValues}
              onAssetRangeChange={progress.setAssetChartRange}
              onPortfolioRangeChange={progress.setPortfolioChartRange}
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
  legendDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
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
