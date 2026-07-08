import {
  Pressable,
  StyleSheet,
  View,
  type DimensionValue,
} from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  EmptyState,
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

type DisplayAllocationClass = "cash" | "crypto" | "debt" | "equity";

type DisplayAllocationItem = {
  assetClass: DisplayAllocationClass;
  percentage: number;
  value: number;
};

function toDisplayAllocation(
  allocation: Array<{
    assetClass: AssetClass;
    percentage: number;
    value: number;
  }>,
): DisplayAllocationItem[] {
  const values: Record<DisplayAllocationClass, number> = {
    cash: 0,
    crypto: 0,
    debt: 0,
    equity: 0,
  };

  for (const item of allocation) {
    const displayClass =
      item.assetClass === "stock" || item.assetClass === "etf"
        ? "equity"
        : item.assetClass;
    values[displayClass] += item.value;
  }

  const totalValue = Object.values(values).reduce((total, value) => total + value, 0);

  return (["equity", "debt", "crypto", "cash"] as const)
    .map((assetClass) => ({
      assetClass,
      percentage:
        totalValue > 0
          ? Number(((values[assetClass] / totalValue) * 100).toFixed(2))
          : 0,
      value: values[assetClass],
    }))
    .filter((item) => item.value > 0);
}

function getDisplayAllocationLabel(assetClass: DisplayAllocationClass) {
  if (assetClass === "equity") {
    return "Equity";
  }

  return assetClassLabel(assetClass);
}

function getAllocationColor(assetClass: DisplayAllocationClass) {
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
  const displayAllocation = toDisplayAllocation(dashboard.allocation);
  const hasAllocation = displayAllocation.length > 0;
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

        <PremiumCard elevated style={styles.heroCard} testID="dashboard-portfolio-hero">
          <AppText color="secondary" variant="caption" weight="bold">
            Portfolio value
          </AppText>
          <MaskedValue
            adjustsFontSizeToFit
            masked={dashboard.maskWealthValues}
            minimumFontScale={0.74}
            numberOfLines={1}
            style={styles.heroValue}
            value={formatCompactINR(dashboard.totalValue)}
            weight="bold"
          />
          <View style={styles.heroContextRow}>
            <View
              style={[
                styles.metricPill,
                dashboard.dayChange.absolute < 0 && styles.negativePill,
              ]}
            >
              <AppText
                style={
                  dashboard.dayChange.absolute >= 0
                    ? styles.positiveText
                    : styles.negativeText
                }
                variant="caption"
                weight="bold"
              >
                {dayChangeAmount} ({formatPercentage(dashboard.dayChange.percentage)})
                {" today"}
              </AppText>
            </View>
          </View>
          <View style={styles.heroMetrics} testID="dashboard-top-metrics">
            <View style={styles.heroMetricCell}>
              <AppText color="secondary" variant="caption">
                Invested
              </AppText>
              <MaskedValue
                masked={dashboard.maskWealthValues}
                value={formatCompactINR(totalInvested)}
                weight="bold"
              />
            </View>
            <View style={styles.heroMetricCell}>
              <AppText color="secondary" variant="caption">
                P&L
              </AppText>
              <MaskedValue
                masked={dashboard.maskWealthValues}
                style={totalPnL >= 0 ? styles.positiveText : styles.negativeText}
                value={formatSignedCompactINR(totalPnL)}
                weight="bold"
              />
            </View>
            <View style={styles.heroMetricCell}>
              <AppText color="secondary" variant="caption">
                P&L %
              </AppText>
              <AppText
                style={totalPnLPct >= 0 ? styles.positiveText : styles.negativeText}
                weight="bold"
              >
                {formatPercentage(totalPnLPct)}
              </AppText>
            </View>
          </View>
        </PremiumCard>

        {hasAllocation ? (
          <PremiumCard testID="dashboard-allocation-card">
            <View style={styles.allocationHeader}>
              <AppText variant="title" weight="bold">
                Allocation
              </AppText>
              <Pressable
                accessibilityRole="button"
                onPress={onOpenHoldings}
                style={styles.inlineAction}
                testID="dashboard-open-holdings"
              >
                <AppText style={styles.brandText} variant="caption" weight="bold">
                  Open Holdings
                </AppText>
              </Pressable>
            </View>
            <View style={styles.allocationSummary}>
              <View
                style={styles.allocationVisual}
                testID="dashboard-allocation-visual"
              >
                {displayAllocation.map((item) => (
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
            </View>
            <View style={styles.allocationLegend}>
              {displayAllocation.map((item) => (
                <View key={item.assetClass} style={styles.allocationLegendRow}>
                  <View style={styles.allocationLegendLabel}>
                    <View
                      style={[
                        styles.allocationDot,
                        { backgroundColor: getAllocationColor(item.assetClass) },
                      ]}
                    />
                    <AppText color="secondary" variant="caption">
                      {getDisplayAllocationLabel(item.assetClass)}
                    </AppText>
                  </View>
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
          <View style={styles.reviewCardRow}>
            <CategoryIcon assetClass="neutral" />
            <View style={styles.infoCardCopy}>
              <AppText weight="bold">Record monthly snapshot</AppText>
              <AppText color="secondary" variant="caption">
                Review this month in Progress when month-end data is ready.
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onOpenProgress}
              style={styles.inlineAction}
              testID="dashboard-open-progress"
            >
              <AppText style={styles.brandText} variant="caption" weight="bold">
                Open Progress
              </AppText>
            </Pressable>
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
  allocationHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  allocationDot: {
    borderRadius: radii.pill,
    height: 9,
    width: 9,
  },
  allocationLegend: {
    gap: spacing.xs,
  },
  allocationLegendLabel: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
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
    gap: spacing.sm,
  },
  allocationVisual: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.pill,
    flexDirection: "row",
    height: 10,
    overflow: "hidden",
  },
  brandText: {
    color: colors.primary,
  },
  content: {
    gap: spacing.cardGap,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  heroCard: {
    gap: spacing.sm,
  },
  heroContextRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  heroMetricCell: {
    flex: 1,
    gap: spacing.xs,
  },
  heroMetrics: {
    flexDirection: "row",
    gap: spacing.cardInner,
  },
  heroValue: {
    fontSize: 36,
    lineHeight: 40,
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
  reviewCardRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.cardInner,
  },
  inlineAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  metricPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(52,199,89,0.12)",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  negativePill: {
    backgroundColor: "rgba(255,69,58,0.12)",
  },
  negativeText: {
    color: colors.loss,
  },
  positiveText: {
    color: colors.profit,
  },
});
