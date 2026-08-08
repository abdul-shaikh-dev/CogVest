import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
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
  getAdaptiveLayoutMode,
} from "@/src/components/common";
import {
  formatCompactINR,
  formatDate,
  formatINR,
  formatPercentage,
} from "@/src/domain/formatters";
import {
  decimal,
  normalizeMoney,
  normalizePercentage,
  sumFinancialValues,
} from "@/src/domain/precision";
import type {
  QuoteFreshnessSummary,
  QuoteRefreshResult,
  RefreshQuotesInput,
} from "@/src/services/quotes";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, radii, spacing } from "@/src/theme";
import type { Holding } from "@/src/types";

import { useDashboard } from "./useDashboard";

type RefreshQuotes = (
  input: RefreshQuotesInput,
) => Promise<QuoteRefreshResult>;

type DashboardScreenProps = {
  now?: Date;
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
  percentage: number | null;
  value: number;
};

function toDisplayAllocation(
  holdings: Holding[],
  cashBalance: number,
): DisplayAllocationItem[] {
  const values = {
    cash: decimal(cashBalance),
    crypto: decimal(0),
    debt: decimal(0),
    equity: decimal(0),
  };

  for (const holding of holdings) {
    const displayClass =
      holding.asset.assetClass === "stock" || holding.asset.assetClass === "etf"
        ? "equity"
        : holding.asset.assetClass;
    values[displayClass] = values[displayClass].plus(
      holding.calculationBasis?.currentValue ?? holding.currentValue,
    );
  }

  const totalValue = sumFinancialValues(Object.values(values));

  return (["equity", "debt", "crypto", "cash"] as const)
    .map((assetClass) => ({
      assetClass,
      percentage:
        totalValue.greaterThan(0)
          ? normalizePercentage(
              values[assetClass].dividedBy(totalValue).times(100),
            )
          : null,
      value: normalizeMoney(values[assetClass]),
    }))
    .filter((item) => item.value !== 0);
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

function getAllocationWidth(
  value: number,
  positiveTotal: number,
): DimensionValue {
  if (value <= 0 || positiveTotal <= 0) {
    return "0%";
  }

  return `${(value / positiveTotal) * 100}%`;
}

export function DashboardScreen({
  now,
  onAddTrade,
  onOpenHoldings,
  onOpenProgress,
  refreshQuotes,
  store = getPortfolioStore(),
}: DashboardScreenProps) {
  const { fontScale } = useWindowDimensions();
  const adaptiveLayoutMode = getAdaptiveLayoutMode(fontScale);
  const dashboard = useDashboard({ now, refreshQuotes, store });
  const displayAllocation = toDisplayAllocation(
    dashboard.holdings,
    dashboard.cashBalance,
  );
  const positiveAllocation = displayAllocation.filter((item) => item.value > 0);
  const positiveAllocationTotal = normalizeMoney(
    sumFinancialValues(positiveAllocation.map((item) => item.value)),
  );
  const hasAllocation = displayAllocation.length > 0;
  const dayChangeAmount = formatSignedINR(dashboard.dayChange.absolute);
  const totalInvested = dashboard.rollupTotals.totalInvested;
  const totalPnL = dashboard.rollupTotals.pnl;
  const totalPnLPct = dashboard.rollupTotals.pnlPct;
  const hasNegativeCash = dashboard.cashBalance < 0;
  const hasPositiveNetPortfolio =
    dashboard.rollupTotals.totalCurrentValue > 0;
  const quoteStatus = getQuoteStatus({
    isRefreshing: dashboard.isRefreshing,
    quoteFailed: dashboard.quoteFailed.length,
    quoteFreshness: dashboard.quoteFreshness,
    quoteTimedOut: dashboard.quoteTimedOut.length,
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

        {dashboard.currencyIssues.length > 0 ? (
          <PremiumCard testID="dashboard-currency-warning">
            <View style={styles.infoCardRow}>
              <CategoryIcon assetClass="neutral" />
              <View style={styles.infoCardCopy}>
                <AppText weight="bold">Unsupported data excluded</AppText>
                <AppText color="secondary" variant="caption">
                  {dashboard.currencyIssues[0].message}
                  {dashboard.currencyIssues.length > 1
                    ? ` ${dashboard.currencyIssues.length - 1} more record${
                        dashboard.currencyIssues.length === 2 ? "" : "s"
                      } remain stored locally.`
                    : " The record remains stored locally."}
                </AppText>
              </View>
            </View>
          </PremiumCard>
        ) : null}

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
          <View
            style={[
              styles.heroMetrics,
              adaptiveLayoutMode !== "standard" && styles.heroMetricsWrapped,
            ]}
            testID="dashboard-top-metrics"
          >
            <View
              style={[
                styles.heroMetricCell,
                adaptiveLayoutMode === "large" && styles.heroMetricCellHalf,
                adaptiveLayoutMode === "accessibility" &&
                  styles.heroMetricCellFull,
              ]}
            >
              <AppText color="secondary" variant="caption">
                Invested
              </AppText>
              <MaskedValue
                masked={dashboard.maskWealthValues}
                value={formatCompactINR(totalInvested)}
                weight="bold"
              />
            </View>
            <View
              style={[
                styles.heroMetricCell,
                adaptiveLayoutMode === "large" && styles.heroMetricCellHalf,
                adaptiveLayoutMode === "accessibility" &&
                  styles.heroMetricCellFull,
              ]}
            >
              <AppText color="secondary" variant="caption">
                Holdings P&L
              </AppText>
              <MaskedValue
                masked={dashboard.maskWealthValues}
                style={totalPnL >= 0 ? styles.positiveText : styles.negativeText}
                value={formatSignedCompactINR(totalPnL)}
                weight="bold"
              />
            </View>
            <View
              style={[
                styles.heroMetricCell,
                adaptiveLayoutMode === "large" && styles.heroMetricCellHalf,
                adaptiveLayoutMode === "accessibility" &&
                  styles.heroMetricCellFull,
              ]}
            >
              <AppText color="secondary" variant="caption">
                Holdings P&L %
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

        {dashboard.cashBalance < 0 ? (
          <PremiumCard
            style={styles.liabilityCard}
            testID="dashboard-cash-liability"
          >
            <View style={styles.liabilityHeader}>
              <View style={styles.liabilityCopy}>
                <AppText style={styles.warningText} weight="bold">
                  Negative cash balance
                </AppText>
                <AppText color="secondary" variant="caption">
                  This liability is included in net portfolio value. Review Cash
                  Ledger if it is unexpected.
                </AppText>
              </View>
            </View>
            <View style={styles.heroMetrics}>
              <View style={styles.heroMetricCell}>
                <AppText color="secondary" variant="caption">
                  Gross holdings
                </AppText>
                <MaskedValue
                  masked={dashboard.maskWealthValues}
                  testID="dashboard-liability-gross"
                  value={formatCompactINR(
                    dashboard.rollupTotals.holdingsCurrentValue,
                  )}
                  weight="bold"
                />
              </View>
              <View style={styles.heroMetricCell}>
                <AppText color="secondary" variant="caption">
                  Cash balance
                </AppText>
                <MaskedValue
                  masked={dashboard.maskWealthValues}
                  style={styles.negativeText}
                  testID="dashboard-liability-cash"
                  value={formatCompactINR(dashboard.cashBalance)}
                  weight="bold"
                />
              </View>
              <View style={styles.heroMetricCell}>
                <AppText color="secondary" variant="caption">
                  Net portfolio
                </AppText>
                <MaskedValue
                  masked={dashboard.maskWealthValues}
                  style={
                    dashboard.rollupTotals.totalCurrentValue < 0
                      ? styles.negativeText
                      : undefined
                  }
                  testID="dashboard-liability-net"
                  value={formatCompactINR(
                    dashboard.rollupTotals.totalCurrentValue,
                  )}
                  weight="bold"
                />
              </View>
            </View>
          </PremiumCard>
        ) : null}

        {hasAllocation ? (
          <PremiumCard testID="dashboard-allocation-card">
            <View style={styles.allocationHeader}>
              <AppText variant="title" weight="bold">
                {hasNegativeCash
                  ? hasPositiveNetPortfolio
                    ? "Net exposure"
                    : "Portfolio composition"
                  : "Allocation"}
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
            {hasNegativeCash ? (
              <AppText color="secondary" variant="caption">
                {hasPositiveNetPortfolio
                  ? "Percentages show signed exposure against net portfolio value."
                  : "Allocation percentages are unavailable while net portfolio value is zero or negative."}
              </AppText>
            ) : (
              <View style={styles.allocationSummary}>
                <View
                  style={styles.allocationVisual}
                  testID="dashboard-allocation-visual"
                >
                  {positiveAllocation.map((item) => (
                    <View
                      key={item.assetClass}
                      style={[
                        styles.allocationSegment,
                        {
                          backgroundColor: getAllocationColor(item.assetClass),
                          width: getAllocationWidth(
                            item.value,
                            positiveAllocationTotal,
                          ),
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>
            )}
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
                    value={
                      item.percentage === null
                        ? formatCompactINR(item.value)
                        : `${formatUnsignedPercentage(item.percentage)} · ${formatCompactINR(
                            item.value,
                          )}`
                    }
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
              <AppText weight="bold">{quoteStatus.title}</AppText>
              <AppText color="secondary" variant="caption">
                {quoteStatus.detail}
              </AppText>
            </View>
          </View>
        </PremiumCard>

        <PremiumCard testID="dashboard-next-review-card">
          <View style={styles.reviewCardRow}>
            <CategoryIcon assetClass="neutral" />
            <View style={styles.infoCardCopy}>
              <AppText weight="bold">Review month-end snapshot</AppText>
              <AppText color="secondary" variant="caption">
                Your snapshot is generated automatically. Review it in Progress only if a correction is needed.
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
  quoteFailed,
  quoteFreshness,
  quoteTimedOut,
}: {
  isRefreshing: boolean;
  quoteFailed: number;
  quoteFreshness: QuoteFreshnessSummary;
  quoteTimedOut: number;
}) {
  const counts = `Current ${quoteFreshness.current} · Stale ${quoteFreshness.stale} · Manual ${quoteFreshness.manual} · Missing ${quoteFreshness.missing}`;

  if (isRefreshing) {
    return {
      detail: counts,
      title: "Refreshing quotes...",
    };
  }

  if (quoteFailed > 0 || quoteTimedOut > 0) {
    const outcomes = [
      quoteFailed > 0 ? `${quoteFailed} failed` : "",
      quoteTimedOut > 0 ? `${quoteTimedOut} timed out` : "",
    ].filter(Boolean);
    const usablePriceCount =
      quoteFreshness.total - quoteFreshness.missing;

    return {
      detail: `${counts}. ${outcomes.join(" · ")}. ${
        usablePriceCount > 0
          ? "Existing prices remain available."
          : "No usable prices are available."
      }`,
      title:
        usablePriceCount > 0
          ? "Refresh partially completed"
          : "Quote refresh failed",
    };
  }

  if (quoteFreshness.status === "empty") {
    return {
      detail: "Quote coverage appears after your first holding.",
      title: "No holdings to price",
    };
  }

  const titles = {
    current: "Quotes current",
    manual: "Manual prices in use",
    missing: "Prices missing",
    partial: "Quote coverage needs attention",
    stale: "Quotes are stale",
  } as const;

  return {
    detail: counts,
    title: titles[quoteFreshness.status],
  };
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
    flexBasis: 0,
    gap: spacing.xs,
    minWidth: 0,
  },
  heroMetricCellFull: {
    flexBasis: "100%",
  },
  heroMetricCellHalf: {
    flexBasis: "45%",
  },
  heroMetrics: {
    flexDirection: "row",
    gap: spacing.cardInner,
  },
  heroMetricsWrapped: {
    flexWrap: "wrap",
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
  liabilityCard: {
    gap: spacing.cardInner,
  },
  liabilityCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  liabilityHeader: {
    flexDirection: "row",
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
  warningText: {
    color: colors.warning,
  },
});
