import { StyleSheet, View } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  CategoryIcon,
  EmptyState,
  HeroMetric,
  MetricGroup,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  assetClassLabel,
} from "@/src/components/common";
import type { MonthlyProgressChartSeries } from "@/src/domain/calculations";
import { formatINR, formatPercentage } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, spacing } from "@/src/theme";
import { FormTextField } from "@/src/components/forms";
import { useProgress } from "./useProgress";

type ProgressScreenProps = {
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

const chartWidth = 280;
const chartHeight = 132;
const chartPadding = 12;

function getSeriesColor(label: string) {
  switch (label) {
    case "Portfolio":
      return colors.text.primary;
    case "Invested":
      return colors.profit;
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

function getSeriesPoints(series: MonthlyProgressChartSeries[], index: number) {
  const values = series.flatMap((item) => item.values);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  const pointCount = series[index]?.values.length ?? 0;
  const usableWidth = chartWidth - chartPadding * 2;
  const usableHeight = chartHeight - chartPadding * 2;

  return (series[index]?.values ?? [])
    .map((value, valueIndex) => {
      const x =
        pointCount === 1
          ? chartWidth / 2
          : chartPadding + (usableWidth * valueIndex) / (pointCount - 1);
      const y =
        chartPadding + usableHeight - ((value - minValue) / range) * usableHeight;

      return `${x},${y}`;
    })
    .join(" ");
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
  monthLabels,
  series,
  testIDPrefix,
}: {
  monthLabels: string[];
  series: MonthlyProgressChartSeries[];
  testIDPrefix: string;
}) {
  return (
    <View style={styles.chartBlock}>
      <View style={styles.svgWrap}>
        <Svg height={chartHeight} width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          {series.map((item, index) => (
            <Polyline
              key={item.label}
              fill="none"
              points={getSeriesPoints(series, index)}
              stroke={getSeriesColor(item.label)}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
            />
          ))}
          {series.map((item, seriesIndex) =>
            item.values.map((_, pointIndex) => {
              const [x, y] = getSeriesPoints(series, seriesIndex)
                .split(" ")
                [pointIndex].split(",");

              return (
                <Circle
                  key={`${item.label}-${pointIndex}`}
                  cx={Number(x)}
                  cy={Number(y)}
                  fill={colors.surface.card}
                  r={3}
                  stroke={getSeriesColor(item.label)}
                  strokeWidth={2}
                />
              );
            }),
          )}
        </Svg>
      </View>
      <View style={styles.monthAxis}>
        {monthLabels.map((month) => (
          <AppText key={month} color="secondary" variant="caption">
            {month}
          </AppText>
        ))}
      </View>
      <TrendLegend series={series} testIDPrefix={testIDPrefix} />
    </View>
  );
}

function ProgressTrendCards({
  assetSeries,
  hasEnoughHistory,
  monthLabels,
  portfolioSeries,
}: {
  assetSeries: MonthlyProgressChartSeries[];
  hasEnoughHistory: boolean;
  monthLabels: string[];
  portfolioSeries: MonthlyProgressChartSeries[];
}) {
  if (!hasEnoughHistory) {
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
        <SectionHeader title="Portfolio vs Invested" />
        <TrendChart
          monthLabels={monthLabels}
          series={portfolioSeries}
          testIDPrefix="portfolio-trend"
        />
      </PremiumCard>
      <PremiumCard>
        <SectionHeader title="Assets vs Months" />
        <TrendChart
          monthLabels={monthLabels}
          series={assetSeries}
          testIDPrefix="asset-trend"
        />
      </PremiumCard>
    </>
  );
}

export function ProgressScreen({
  store = getPortfolioStore(),
}: ProgressScreenProps) {
  const progress = useProgress({ store });

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

        {progress.latestSummary ? (
          <>
            <HeroMetric
              label="Portfolio value"
              masked={progress.preferences.maskWealthValues}
              subValue={`${formatSignedINR(
                progress.latestSummary.monthlyGain,
              )} (${formatPercentage(progress.latestSummary.monthlyGainPct)})`}
              subValueTone={progress.latestSummary.monthlyGain >= 0 ? "positive" : "negative"}
              value={formatINR(progress.latestSummary.snapshot.portfolioValue)}
            />

            <MetricGroup
              metrics={[
                {
                  label: "Invested",
                  masked: progress.preferences.maskWealthValues,
                  value: formatINR(progress.latestSummary.snapshot.monthlyInvestment),
                },
                {
                  label: "Savings",
                  value:
                    progress.latestSummary.savingsRate === null
                      ? "Not enough data"
                      : formatPercentage(progress.latestSummary.savingsRate),
                },
                {
                  label: "Expense",
                  value:
                    progress.latestSummary.expenseRate === null
                      ? "Not enough data"
                      : formatPercentage(progress.latestSummary.expenseRate),
                },
              ]}
            />

            <ProgressTrendCards
              assetSeries={progress.chartData.assetSeries}
              hasEnoughHistory={progress.chartData.hasEnoughHistory}
              monthLabels={progress.chartData.monthLabels}
              portfolioSeries={progress.chartData.portfolioSeries}
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
                  value: formatINR(progress.portfolioValue),
                },
                {
                  label: "Invested",
                  masked: progress.preferences.maskWealthValues,
                  value: formatINR(progress.totalInvested),
                },
                {
                  label: "Cash",
                  masked: progress.preferences.maskWealthValues,
                  value: formatINR(progress.cashBalance),
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
              assetSeries={progress.chartData.assetSeries}
              hasEnoughHistory={progress.chartData.hasEnoughHistory}
              monthLabels={progress.chartData.monthLabels}
              portfolioSeries={progress.chartData.portfolioSeries}
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
            message="Record a month-end snapshot to track progress without Excel."
          />
        )}

        <PremiumCard>
          <SectionHeader title="Record monthly snapshot" />
          <FormTextField
            error={progress.errors.month}
            label="Month"
            onChangeText={(value) => progress.setField("month", value)}
            placeholder="YYYY-MM"
            testID="snapshot-month-input"
            value={progress.formValues.month}
          />
          <FormTextField
            error={progress.errors.portfolioValue}
            keyboardType="decimal-pad"
            label="Portfolio value"
            onChangeText={(value) => progress.setField("portfolioValue", value)}
            placeholder="1385000"
            testID="snapshot-portfolio-input"
            value={progress.formValues.portfolioValue}
          />
          <FormTextField
            error={progress.errors.investedValue}
            keyboardType="decimal-pad"
            label="Invested value"
            onChangeText={(value) => progress.setField("investedValue", value)}
            placeholder="1060000"
            testID="snapshot-invested-input"
            value={progress.formValues.investedValue}
          />
          <View style={styles.fieldGrid}>
            <FormTextField
              error={progress.errors.equityValue}
              keyboardType="decimal-pad"
              label="Equity"
              onChangeText={(value) => progress.setField("equityValue", value)}
              placeholder="880000"
              testID="snapshot-equity-input"
              value={progress.formValues.equityValue}
            />
            <FormTextField
              error={progress.errors.debtValue}
              keyboardType="decimal-pad"
              label="Debt"
              onChangeText={(value) => progress.setField("debtValue", value)}
              placeholder="320000"
              testID="snapshot-debt-input"
              value={progress.formValues.debtValue}
            />
          </View>
          <View style={styles.fieldGrid}>
            <FormTextField
              error={progress.errors.cryptoValue}
              keyboardType="decimal-pad"
              label="Crypto"
              onChangeText={(value) => progress.setField("cryptoValue", value)}
              placeholder="45000"
              testID="snapshot-crypto-input"
              value={progress.formValues.cryptoValue}
            />
            <FormTextField
              error={progress.errors.cashValue}
              keyboardType="decimal-pad"
              label="Cash"
              onChangeText={(value) => progress.setField("cashValue", value)}
              placeholder="140000"
              testID="snapshot-cash-input"
              value={progress.formValues.cashValue}
            />
          </View>
          <View style={styles.fieldGrid}>
            <FormTextField
              error={progress.errors.monthlyInvestment}
              keyboardType="decimal-pad"
              label="Monthly investment"
              onChangeText={(value) => progress.setField("monthlyInvestment", value)}
              placeholder="60000"
              testID="snapshot-investment-input"
              value={progress.formValues.monthlyInvestment}
            />
            <FormTextField
              error={progress.errors.salary}
              keyboardType="decimal-pad"
              label="Salary"
              onChangeText={(value) => progress.setField("salary", value)}
              placeholder="160000"
              testID="snapshot-salary-input"
              value={progress.formValues.salary}
            />
          </View>
          <FormTextField
            error={progress.errors.monthlyExpense}
            keyboardType="decimal-pad"
            label="Monthly expense"
            onChangeText={(value) => progress.setField("monthlyExpense", value)}
            placeholder="Optional"
            testID="snapshot-expense-input"
            value={progress.formValues.monthlyExpense}
          />
          <FormTextField
            label="Notes"
            multiline
            onChangeText={(value) => progress.setField("notes", value)}
            placeholder="Optional month-end note"
            value={progress.formValues.notes}
          />
          <AppButton
            title="Save Monthly Snapshot"
            testID="save-monthly-snapshot-button"
            onPress={progress.saveSnapshot}
          />
        </PremiumCard>
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
  fieldGrid: {
    gap: spacing.cardInner,
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
  monthAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  snapshotCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  snapshotRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.cardInner,
    justifyContent: "space-between",
  },
  svgWrap: {
    backgroundColor: colors.surface.elevated,
    borderRadius: 18,
    overflow: "hidden",
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
});
