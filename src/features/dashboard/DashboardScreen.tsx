import { StyleSheet, View, type DimensionValue } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  EmptyState,
  HeroMetric,
  IconButton,
  MetricGroup,
  MaskedValue,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  assetClassLabel,
  CategoryIcon,
} from "@/src/components/common";
import {
  formatCompactINR,
  formatDate,
  formatINR,
  formatPercentage,
} from "@/src/domain/formatters";
import type { RefreshQuotesInput, QuoteRefreshResult } from "@/src/services/quotes";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, radii, spacing } from "@/src/theme";
import type { AssetClass } from "@/src/types";

import { useDashboard } from "./useDashboard";

type RefreshQuotes = (
  input: RefreshQuotesInput,
) => Promise<QuoteRefreshResult>;

type DashboardScreenProps = {
  onAddTrade?: () => void;
  onOpenHoldings?: () => void;
  onOpenProgress?: () => void;
  refreshQuotes?: RefreshQuotes;
  store?: StoreApi<PortfolioStoreState>;
};

function formatSignedINR(value: number) {
  const amount = formatINR(value);

  return value > 0 ? `+${amount}` : amount;
}

function formatSignedCompactINR(value: number) {
  const amount = formatCompactINR(value);

  return value > 0 ? `+${amount}` : amount;
}

function formatUnsignedPercentage(value: number) {
  return formatPercentage(value).replace("+", "");
}

function getAllocationColor(assetClass: AssetClass) {
  if (assetClass === "cash") {
    return colors.cashBlue;
  }

  if (assetClass === "crypto") {
    return colors.cryptoAmber;
  }

  if (assetClass === "debt") {
    return colors.blue;
  }

  return colors.primary;
}

function getAllocationWidth(percentage: number): DimensionValue {
  return `${Math.min(100, Math.max(0, percentage))}%`;
}

export function DashboardScreen({
  onAddTrade,
  onOpenHoldings,
  onOpenProgress,
  refreshQuotes,
  store = getPortfolioStore(),
}: DashboardScreenProps) {
  const dashboard = useDashboard({ refreshQuotes, store });
  const hasAllocation = dashboard.allocation.length > 0;
  const dayChangeAmount = formatSignedINR(dashboard.dayChange.absolute);
  const totalInvested = dashboard.rollupTotals.totalInvested;
  const totalPnL = dashboard.rollupTotals.pnl;
  const totalPnLPct = dashboard.rollupTotals.pnlPct;
  const quoteStatus = getQuoteStatus({
    isRefreshing: dashboard.isRefreshing,
    latestQuoteAsOf: dashboard.latestQuoteAsOf,
    latestQuoteSource: dashboard.latestQuoteSource,
    quoteFailures: dashboard.quoteFailures.length,
  });

  return (
    <ScreenContainer scroll testID="dashboard-screen">
      <View style={styles.content}>
        <ScreenHeader
          title="Dashboard"
          subtitle="Local portfolio • latest snapshot"
          action={
            <>
              <IconButton
                accessibilityLabel={
                  dashboard.maskWealthValues ? "Show values" : "Mask values"
                }
                icon={dashboard.maskWealthValues ? "eye-off-outline" : "eye-outline"}
                onPress={dashboard.toggleMaskWealthValues}
                testID="dashboard-mask-toggle"
              />
              <IconButton
                accessibilityLabel="Refresh quotes"
                icon="refresh-outline"
                onPress={() => {
                  void dashboard.refresh();
                }}
                testID="dashboard-refresh-quotes"
              />
            </>
          }
        />

        <View testID="dashboard-portfolio-hero">
          <HeroMetric
            label="Portfolio value"
            masked={dashboard.maskWealthValues}
            value={formatINR(dashboard.totalValue)}
            subValue={`${dayChangeAmount} (${formatPercentage(
              dashboard.dayChange.percentage,
            )}) today`}
            subValueTone={dashboard.dayChange.absolute >= 0 ? "positive" : "negative"}
          />
        </View>

        <MetricGroup
          testID="dashboard-top-metrics"
          metrics={[
            {
              label: "Invested",
              masked: dashboard.maskWealthValues,
              value: formatCompactINR(totalInvested),
            },
            {
              label: "P&L",
              masked: dashboard.maskWealthValues,
              value: formatSignedCompactINR(totalPnL),
            },
            {
              label: "P&L %",
              value: formatPercentage(totalPnLPct),
            },
          ]}
        />

        {onAddTrade && hasAllocation ? (
          <AppButton
            title="Add Holding"
            testID="add-trade-button"
            onPress={onAddTrade}
          />
        ) : null}

        {hasAllocation ? (
          <PremiumCard testID="dashboard-allocation-card">
            <SectionHeader title="Allocation" />
            <View style={styles.allocationSummary}>
              <View
                style={styles.allocationVisual}
                testID="dashboard-allocation-visual"
              >
                {dashboard.allocation.map((item) => (
                  <View
                    key={item.assetClass}
                    style={[
                      styles.allocationSegment,
                      {
                        backgroundColor: getAllocationColor(item.assetClass),
                        width: getAllocationWidth(item.percentage),
                      },
                    ]}
                  />
                ))}
              </View>
              <AppButton
                title="Open Holdings"
                testID="dashboard-open-holdings"
                variant="secondary"
                onPress={onOpenHoldings}
              />
            </View>
            <View style={styles.allocationLegend}>
              {dashboard.allocation.map((item) => (
                <View key={item.assetClass} style={styles.allocationLegendRow}>
                  <View
                    style={[
                      styles.allocationDot,
                      { backgroundColor: getAllocationColor(item.assetClass) },
                    ]}
                  />
                  <AppText color="secondary" variant="caption">
                    {assetClassLabel(item.assetClass)}
                  </AppText>
                  <MaskedValue
                    align="right"
                    adjustsFontSizeToFit
                    masked={dashboard.maskWealthValues}
                    minimumFontScale={0.75}
                    numberOfLines={1}
                    style={styles.allocationLegendValue}
                    value={`${formatUnsignedPercentage(item.percentage)} · ${formatCompactINR(
                      item.value,
                    )}`}
                    variant="caption"
                  />
                </View>
              ))}
            </View>
          </PremiumCard>
        ) : (
          <EmptyState
            actionLabel={onAddTrade ? "Add Holding" : undefined}
            actionTestID="add-trade-button"
            message="Add your first portfolio entry to build holdings automatically."
            title="No allocation yet"
            onAction={onAddTrade}
          />
        )}

        <PremiumCard testID="dashboard-quote-card">
          <View style={styles.infoCardRow}>
            <CategoryIcon assetClass="neutral" />
            <View style={styles.infoCardCopy}>
              <AppText weight="bold">Quotes updated</AppText>
              <AppText color="secondary" variant="caption">
                {quoteStatus}
              </AppText>
            </View>
          </View>
        </PremiumCard>

        <PremiumCard testID="dashboard-next-review-card">
          <View style={styles.nextReviewStack}>
            <View style={styles.infoCardRow}>
              <CategoryIcon assetClass="neutral" />
              <View style={styles.infoCardCopy}>
                <AppText weight="bold">Record monthly snapshot</AppText>
                <AppText color="secondary" variant="caption">
                  Review this month in Progress when your month-end data is ready.
                </AppText>
              </View>
            </View>
            <AppButton
              title="Open Progress"
              testID="dashboard-open-progress"
              variant="secondary"
              onPress={onOpenProgress}
            />
          </View>
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="This Month" />
          <MetricGroup
            metrics={[
              {
                label: "Invested",
                masked: dashboard.maskWealthValues,
                value: formatCompactINR(dashboard.monthlyMetrics.investment),
              },
              {
                label: "Savings",
                value:
                  dashboard.monthlyMetrics.savingsRate === null
                    ? "Not enough data"
                    : formatPercentage(dashboard.monthlyMetrics.savingsRate),
              },
              {
                label: "Cash change",
                masked: dashboard.maskWealthValues,
                value: formatSignedCompactINR(dashboard.monthlyMetrics.cashChange),
              },
            ]}
          />
        </PremiumCard>

        <PremiumCard>
          <SectionHeader
            title={
              dashboard.convictionReadiness.isReady
                ? "Conviction data ready"
                : "Conviction data needs more trades"
            }
          />
          <AppText color="secondary">
            {dashboard.convictionReadiness.ratedTradeCount} of{" "}
            {dashboard.convictionReadiness.requiredTradeCount} trades rated. Keep
            conviction optional, but useful.
          </AppText>
        </PremiumCard>
      </View>
    </ScreenContainer>
  );
}

function getQuoteStatus({
  isRefreshing,
  latestQuoteAsOf,
  latestQuoteSource,
  quoteFailures,
}: {
  isRefreshing: boolean;
  latestQuoteAsOf?: string;
  latestQuoteSource?: string;
  quoteFailures: number;
}) {
  if (isRefreshing) {
    return "Refreshing quotes...";
  }

  if (quoteFailures > 0) {
    return "Some quotes could not refresh. Manual fallback ready.";
  }

  if (!latestQuoteAsOf) {
    return "Quotes will appear after your first priced holding.";
  }

  const mode =
    latestQuoteSource === "manual" ? "Manual fallback ready" : "Live refresh available";

  return `${formatDate(latestQuoteAsOf)} • ${mode}`;
}

const styles = StyleSheet.create({
  allocationDot: {
    borderRadius: radii.pill,
    height: 8,
    width: 8,
  },
  allocationLegend: {
    gap: spacing.sm,
  },
  allocationLegendRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  allocationLegendValue: {
    flexShrink: 1,
  },
  allocationSegment: {
    minWidth: 2,
  },
  allocationSummary: {
    gap: spacing.cardInner,
  },
  allocationVisual: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.pill,
    flexDirection: "row",
    height: 14,
    overflow: "hidden",
  },
  content: {
    gap: spacing.cardGap,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  infoCardCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  infoCardRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.cardInner,
  },
  nextReviewStack: {
    gap: spacing.cardInner,
  },
});
