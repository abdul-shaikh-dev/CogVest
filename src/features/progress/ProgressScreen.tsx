import { useState, useSyncExternalStore } from "react";
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
import {
  buildMonthlyProgressChartData,
  calculateAllocation,
  calculateCashBalance,
  calculateHoldings,
  calculateMonthlyProgressSummaries,
  calculatePortfolioTotal,
  type MonthlyProgressChartSeries,
} from "@/src/domain/calculations";
import { formatINR, formatPercentage } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, spacing } from "@/src/theme";
import type { MonthlySnapshot } from "@/src/types";
import { createId } from "@/src/utils";
import { FormTextField } from "@/src/components/forms";

type ProgressScreenProps = {
  store?: StoreApi<PortfolioStoreState>;
};

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

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

function isCurrentMonth(isoDate: string, now = new Date()) {
  const date = new Date(isoDate);

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function formatSignedINR(value: number) {
  const amount = formatINR(value);

  return value > 0 ? `+${amount}` : amount;
}

function emptyFormValues() {
  const now = new Date();

  return {
    cashValue: "",
    cryptoValue: "",
    debtValue: "",
    equityValue: "",
    investedValue: "",
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    monthlyExpense: "",
    monthlyInvestment: "",
    notes: "",
    portfolioValue: "",
    salary: "",
  };
}

type SnapshotFormValues = ReturnType<typeof emptyFormValues>;
type SnapshotFormErrors = Partial<Record<keyof SnapshotFormValues, string>>;

const requiredNumberFields: Array<keyof SnapshotFormValues> = [
  "portfolioValue",
  "investedValue",
  "equityValue",
  "debtValue",
  "cryptoValue",
  "cashValue",
  "monthlyInvestment",
  "salary",
];

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

function parseNumberField(
  values: SnapshotFormValues,
  field: keyof SnapshotFormValues,
  errors: SnapshotFormErrors,
) {
  const value = values[field].trim();
  const parsedValue = value.length > 0 ? Number(value) : Number.NaN;

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    errors[field] = "Enter a valid amount.";
  }

  return parsedValue;
}

function validateSnapshotForm(values: SnapshotFormValues) {
  const errors: SnapshotFormErrors = {};

  if (!/^\d{4}-\d{2}$/.test(values.month.trim())) {
    errors.month = "Use YYYY-MM.";
  }

  const parsedValues = Object.fromEntries(
    requiredNumberFields.map((field) => [
      field,
      parseNumberField(values, field, errors),
    ]),
  ) as Record<(typeof requiredNumberFields)[number], number>;
  const trimmedExpense = values.monthlyExpense.trim();
  const monthlyExpense =
    trimmedExpense.length === 0 ? undefined : Number(trimmedExpense);

  if (
    monthlyExpense !== undefined &&
    (!Number.isFinite(monthlyExpense) || monthlyExpense < 0)
  ) {
    errors.monthlyExpense = "Enter a valid amount.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors, snapshot: null };
  }

  return {
    errors,
    snapshot: {
      cashValue: parsedValues.cashValue,
      cryptoValue: parsedValues.cryptoValue,
      debtValue: parsedValues.debtValue,
      equityValue: parsedValues.equityValue,
      id: createId("snapshot"),
      investedValue: parsedValues.investedValue,
      month: values.month.trim(),
      monthlyExpense,
      monthlyInvestment: parsedValues.monthlyInvestment,
      notes: values.notes.trim() || undefined,
      portfolioValue: parsedValues.portfolioValue,
      salary: parsedValues.salary,
    } satisfies MonthlySnapshot,
  };
}

export function ProgressScreen({
  store = getPortfolioStore(),
}: ProgressScreenProps) {
  const snapshot = usePortfolioSnapshot(store);
  const [formValues, setFormValues] = useState(emptyFormValues);
  const [errors, setErrors] = useState<SnapshotFormErrors>({});
  const holdings = calculateHoldings({
    assets: snapshot.assets,
    openingPositions: snapshot.openingPositions,
    quoteCache: snapshot.quoteCache,
    trades: snapshot.trades,
  });
  const cashBalance = calculateCashBalance(snapshot.cashEntries);
  const portfolioValue = calculatePortfolioTotal(holdings, snapshot.cashEntries);
  const totalInvested = holdings.reduce(
    (total, holding) => total + holding.totalInvested,
    0,
  );
  const monthlyTradeInvestment = snapshot.trades
    .filter((trade) => trade.type === "buy" && isCurrentMonth(trade.date))
    .reduce((total, trade) => total + trade.totalValue, 0);
  const monthlyOpeningInvestment = snapshot.openingPositions
    .filter((position) => isCurrentMonth(position.date))
    .reduce(
      (total, position) =>
        total + position.quantity * position.averageCostPrice,
      0,
    );
  const monthlyInvestment = monthlyTradeInvestment + monthlyOpeningInvestment;
  const monthlyCashAdded = snapshot.cashEntries
    .filter((entry) => entry.type === "addition" && isCurrentMonth(entry.date))
    .reduce((total, entry) => total + entry.amount, 0);
  const savingsRate =
    monthlyCashAdded === 0 ? 0 : (monthlyInvestment / monthlyCashAdded) * 100;
  const allocation = calculateAllocation({ cashBalance, holdings });
  const hasData = holdings.length > 0 || snapshot.cashEntries.length > 0;
  const monthlySummaries = calculateMonthlyProgressSummaries(
    snapshot.monthlySnapshots,
  );
  const latestSummary = monthlySummaries[0];
  const chartData = buildMonthlyProgressChartData(snapshot.monthlySnapshots);

  function setField(field: keyof SnapshotFormValues, value: string) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));
  }

  function saveSnapshot() {
    const result = validateSnapshotForm(formValues);

    if (!result.snapshot) {
      setErrors(result.errors);
      return;
    }

    const existingSnapshot = snapshot.monthlySnapshots.find(
      (monthlySnapshot) => monthlySnapshot.month === result.snapshot.month,
    );

    if (existingSnapshot) {
      store.getState().updateMonthlySnapshot({
        ...result.snapshot,
        id: existingSnapshot.id,
      });
    } else {
      store.getState().addMonthlySnapshot(result.snapshot);
    }

    setFormValues(emptyFormValues());
    setErrors({});
  }

  return (
    <ScreenContainer scroll testID="progress-screen">
      <View style={styles.content}>
        <ScreenHeader
          title="Monthly Progress"
          subtitle={
            latestSummary
              ? `${formatMonth(latestSummary.snapshot.month)} snapshot`
              : getMonthLabel()
          }
        />

        {latestSummary ? (
          <>
            <HeroMetric
              label="Portfolio value"
              masked={snapshot.preferences.maskWealthValues}
              subValue={`${formatSignedINR(
                latestSummary.monthlyGain,
              )} (${formatPercentage(latestSummary.monthlyGainPct)})`}
              subValueTone={latestSummary.monthlyGain >= 0 ? "positive" : "negative"}
              value={formatINR(latestSummary.snapshot.portfolioValue)}
            />

            <MetricGroup
              metrics={[
                {
                  label: "Invested",
                  masked: snapshot.preferences.maskWealthValues,
                  value: formatINR(latestSummary.snapshot.monthlyInvestment),
                },
                {
                  label: "Savings",
                  value:
                    latestSummary.savingsRate === null
                      ? "Not enough data"
                      : formatPercentage(latestSummary.savingsRate),
                },
                {
                  label: "Expense",
                  value:
                    latestSummary.expenseRate === null
                      ? "Not enough data"
                      : formatPercentage(latestSummary.expenseRate),
                },
              ]}
            />

            <ProgressTrendCards
              assetSeries={chartData.assetSeries}
              hasEnoughHistory={chartData.hasEnoughHistory}
              monthLabels={chartData.monthLabels}
              portfolioSeries={chartData.portfolioSeries}
            />

            <PremiumCard>
              <SectionHeader title="Asset class snapshot" />
              {latestSummary.assetSnapshot.map((item) => (
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
              {monthlySummaries.map((summary) => (
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
        ) : hasData ? (
          <>
            <MetricGroup
              metrics={[
                {
                  label: "Portfolio",
                  masked: snapshot.preferences.maskWealthValues,
                  value: formatINR(portfolioValue),
                },
                {
                  label: "Invested",
                  masked: snapshot.preferences.maskWealthValues,
                  value: formatINR(totalInvested),
                },
                {
                  label: "Cash",
                  masked: snapshot.preferences.maskWealthValues,
                  value: formatINR(cashBalance),
                },
                {
                  label: "Savings",
                  value: monthlyCashAdded === 0 ? "Not enough data" : formatPercentage(savingsRate),
                },
              ]}
            />

            <PremiumCard>
              <SectionHeader title="What changed this month?" />
              <AppText color="secondary">
                Monthly investment: {formatINR(monthlyInvestment)}
              </AppText>
              <AppText color="secondary">
                Cash added: {formatINR(monthlyCashAdded)}
              </AppText>
              <AppText color="secondary">
                Expense rate needs explicit expense tracking and is not shown in V1.
              </AppText>
            </PremiumCard>

            <ProgressTrendCards
              assetSeries={chartData.assetSeries}
              hasEnoughHistory={chartData.hasEnoughHistory}
              monthLabels={chartData.monthLabels}
              portfolioSeries={chartData.portfolioSeries}
            />

            <PremiumCard>
              <SectionHeader title="Asset class snapshot" />
              {allocation.map((item) => (
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
            error={errors.month}
            label="Month"
            onChangeText={(value) => setField("month", value)}
            placeholder="YYYY-MM"
            testID="snapshot-month-input"
            value={formValues.month}
          />
          <FormTextField
            error={errors.portfolioValue}
            keyboardType="decimal-pad"
            label="Portfolio value"
            onChangeText={(value) => setField("portfolioValue", value)}
            placeholder="1385000"
            testID="snapshot-portfolio-input"
            value={formValues.portfolioValue}
          />
          <FormTextField
            error={errors.investedValue}
            keyboardType="decimal-pad"
            label="Invested value"
            onChangeText={(value) => setField("investedValue", value)}
            placeholder="1060000"
            testID="snapshot-invested-input"
            value={formValues.investedValue}
          />
          <View style={styles.fieldGrid}>
            <FormTextField
              error={errors.equityValue}
              keyboardType="decimal-pad"
              label="Equity"
              onChangeText={(value) => setField("equityValue", value)}
              placeholder="880000"
              testID="snapshot-equity-input"
              value={formValues.equityValue}
            />
            <FormTextField
              error={errors.debtValue}
              keyboardType="decimal-pad"
              label="Debt"
              onChangeText={(value) => setField("debtValue", value)}
              placeholder="320000"
              testID="snapshot-debt-input"
              value={formValues.debtValue}
            />
          </View>
          <View style={styles.fieldGrid}>
            <FormTextField
              error={errors.cryptoValue}
              keyboardType="decimal-pad"
              label="Crypto"
              onChangeText={(value) => setField("cryptoValue", value)}
              placeholder="45000"
              testID="snapshot-crypto-input"
              value={formValues.cryptoValue}
            />
            <FormTextField
              error={errors.cashValue}
              keyboardType="decimal-pad"
              label="Cash"
              onChangeText={(value) => setField("cashValue", value)}
              placeholder="140000"
              testID="snapshot-cash-input"
              value={formValues.cashValue}
            />
          </View>
          <View style={styles.fieldGrid}>
            <FormTextField
              error={errors.monthlyInvestment}
              keyboardType="decimal-pad"
              label="Monthly investment"
              onChangeText={(value) => setField("monthlyInvestment", value)}
              placeholder="60000"
              testID="snapshot-investment-input"
              value={formValues.monthlyInvestment}
            />
            <FormTextField
              error={errors.salary}
              keyboardType="decimal-pad"
              label="Salary"
              onChangeText={(value) => setField("salary", value)}
              placeholder="160000"
              testID="snapshot-salary-input"
              value={formValues.salary}
            />
          </View>
          <FormTextField
            error={errors.monthlyExpense}
            keyboardType="decimal-pad"
            label="Monthly expense"
            onChangeText={(value) => setField("monthlyExpense", value)}
            placeholder="Optional"
            testID="snapshot-expense-input"
            value={formValues.monthlyExpense}
          />
          <FormTextField
            label="Notes"
            multiline
            onChangeText={(value) => setField("notes", value)}
            placeholder="Optional month-end note"
            value={formValues.notes}
          />
          <AppButton
            title="Save Monthly Snapshot"
            testID="save-monthly-snapshot-button"
            onPress={saveSnapshot}
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
