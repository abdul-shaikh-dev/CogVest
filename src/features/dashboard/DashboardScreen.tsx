import { useEffect, useState } from "react";
import { router } from "expo-router";
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
  DisclosureButton,
  GroupedListRow,
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
  formatINR,
  formatPercentage,
} from "@/src/domain/formatters";
import { formatMonthYear } from "@/src/domain/dates";
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
import { radii, spacing, useTheme, createThemedStyles, type ThemeColors } from "@/src/theme";
import type { Holding } from "@/src/types";

import { useDashboard } from "./useDashboard";
import { InsightCards } from "@/src/features/insights";
import type { InsightKind } from "@/src/domain/calculations/behaviorInsightDetails";

type RefreshQuotes = (
  input: RefreshQuotesInput,
) => Promise<QuoteRefreshResult>;

type DashboardScreenProps = {
  now?: Date;
  onAddTrade?: () => void;
  onOpenHoldings?: () => void;
  onOpenProgress?: () => void;
  onOpenInsight?: (kind: InsightKind) => void;
  onQuickSetup?: () => void;
  quickSetupSavedCount?: number;
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

type DisplayAllocationClass = "cash" | "crypto" | "debt" | "equity" | "futures";

type DisplayAllocationItem = {
  assetClass: DisplayAllocationClass;
  percentage: number | null;
  value: number;
};

function toDisplayAllocation(
  holdings: Holding[],
  cashBalance: number,
  futuresEquityInr: number | null,
): DisplayAllocationItem[] {
  if (futuresEquityInr === null || futuresEquityInr < 0 || holdings.some((holding) => holding.valuation.status === "pending")) {
    return [];
  }

  const values = {
    cash: decimal(cashBalance),
    crypto: decimal(0),
    debt: decimal(0),
    equity: decimal(0),
    futures: decimal(futuresEquityInr),
  };

  for (const holding of holdings) {
    const displayClass =
      holding.asset.assetClass === "stock" || holding.asset.assetClass === "etf"
        ? "equity"
        : holding.asset.assetClass;
    values[displayClass] = values[displayClass].plus(
      holding.calculationBasis?.currentValue ?? holding.currentValue ?? 0,
    );
  }

  const totalValue = sumFinancialValues(Object.values(values));

  return (["equity", "debt", "crypto", "futures", "cash"] as const)
    .map((assetClass) => ({
      assetClass,
      percentage:
        totalValue.greaterThan(0)
          ? normalizePercentage(
              values[assetClass].dividedBy(totalValue).times(100),
            )
          : null,
      value: normalizeMoney(values[assetClass]),
    }));
}

function getDisplayAllocationLabel(assetClass: DisplayAllocationClass) {
  if (assetClass === "futures") return "Futures equity";
  if (assetClass === "equity") {
    return "Equity";
  }

  return assetClassLabel(assetClass);
}

function getAllocationColor(colors: ThemeColors, assetClass: DisplayAllocationClass) {
  if (assetClass === "futures") return colors.cryptoAmber;
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
  onOpenInsight,
  onQuickSetup,
  quickSetupSavedCount = 0,
  refreshQuotes,
  store = getPortfolioStore(),
}: DashboardScreenProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const currentDate = now ?? new Date();
  const [showPriceDetails, setShowPriceDetails] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const { fontScale } = useWindowDimensions();
  const adaptiveLayoutMode = getAdaptiveLayoutMode(fontScale);
  const dashboard = useDashboard({ now: currentDate, refreshQuotes, store });
  const isMinimalMode = dashboard.displayMode === "minimal";
  useEffect(() => { setShowPerformance(false); }, [isMinimalMode]);
  const displayAllocation = toDisplayAllocation(
    dashboard.holdings,
    dashboard.cashBalance,
    dashboard.futuresEquityInr,
  ).filter((item) => item.assetClass !== "futures" || dashboard.futuresContributions.length > 0);
  const positiveAllocation = displayAllocation.filter((item) => item.value > 0);
  const positiveAllocationTotal = normalizeMoney(
    sumFinancialValues(positiveAllocation.map((item) => item.value)),
  );
  const hasAllocation = displayAllocation.some((item) => item.value !== 0);
  const dayChangeAmount = formatSignedINR(dashboard.dayChange.absolute);
  const totalInvested = dashboard.rollupTotals.totalInvested;
  const totalPnL = dashboard.rollupTotals.pnl;
  const totalPnLPct = dashboard.rollupTotals.pnlPct;
  const pendingFuturesCount = dashboard.futuresContributions.filter((item) => item.status === "pending").length;
  const hasNegativeFuturesEquity = dashboard.futuresEquityInr !== null && dashboard.futuresEquityInr < 0;
  const hasNegativeCash = dashboard.cashBalance < 0;
  const hasCompleteValuation =
    dashboard.rollupTotals.valuationCoverage.status === "complete";
  const hasPositiveNetPortfolio =
    (dashboard.rollupTotals.totalCurrentValue ?? 0) > 0;
  const quoteStatus = getQuoteStatus({
    hasFutures: dashboard.futuresContributions.length > 0,
    isRefreshing: dashboard.isRefreshing,
    quoteFailed: dashboard.quoteFailed.length,
    quoteFreshness: dashboard.quoteFreshness,
    quoteTimedOut: dashboard.quoteTimedOut.length,
  });

  if (!dashboard.hasPortfolioRecords && quickSetupSavedCount === 0 && dashboard.currencyIssues.length === 0) {
    return <ScreenContainer scroll testID="dashboard-screen"><View style={styles.content}>
      <ScreenHeader title="Dashboard" subtitle="Your local portfolio" />
      <EmptyState title="Your portfolio starts here"
        message="Add holdings manually or import your statements. Your records stay on this device."
        actionLabel={onQuickSetup ? "Set up your portfolio" : "Add Holding"}
        actionTestID={onQuickSetup ? "quick-setup-button" : "add-trade-button"}
        onAction={onQuickSetup ?? onAddTrade}
        secondaryActionLabel={onQuickSetup && onAddTrade ? "Add one holding" : undefined}
        secondaryActionTestID="add-trade-button"
        onSecondaryAction={onQuickSetup ? onAddTrade : undefined} />
    </View></ScreenContainer>;
  }

  return (
    <ScreenContainer scroll testID="dashboard-screen">
      <View style={styles.content}>
        <ScreenHeader
          compact
          title="Dashboard"
          action={
            <>
              <IconButton
                plain
                accessibilityLabel={
                  dashboard.maskWealthValues ? "Show values" : "Mask values"
                }
                icon={dashboard.maskWealthValues ? "eye-off-outline" : "eye-outline"}
                onPress={dashboard.toggleMaskWealthValues}
                testID="dashboard-mask-toggle"
              />
              <IconButton
                plain
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

        <PremiumCard section style={styles.heroCard} testID="dashboard-portfolio-hero">
          <AppText color="secondary" variant="caption" weight="bold">
            Portfolio value
          </AppText>
          <MaskedValue
            adjustsFontSizeToFit
            exactValue={
              dashboard.totalValue === null
                ? undefined
                : formatINR(dashboard.totalValue)
            }
            masked={dashboard.maskWealthValues && dashboard.totalValue !== null}
            minimumFontScale={0.74}
            numberOfLines={1}
            style={styles.heroValue}
            value={
              dashboard.totalValue === null
                ? "Valuation pending"
                : formatCompactINR(dashboard.totalValue)
            }
            weight="bold"
          />
          <View style={styles.heroContextRow}>
            {!hasCompleteValuation ? (
              <AppText color="secondary" style={styles.heroContextText} variant="caption">
                {pendingFuturesCount > 0
                  ? `${pendingFuturesCount} Futures wallet${pendingFuturesCount === 1 ? "" : "s"} pending. Review below to complete the total.`
                  : `${dashboard.rollupTotals.valuationCoverage.pendingHoldings} holding${dashboard.rollupTotals.valuationCoverage.pendingHoldings === 1 ? " needs" : "s need"} a price. Invested value remains available.`}
              </AppText>
            ) : null}
          </View>
          {isMinimalMode ? (
            <DisclosureButton
              expanded={showPerformance}
              onPress={() => setShowPerformance((visible) => !visible)}
              testID="dashboard-performance-toggle"
              title="Invested & returns"
            />
          ) : null}
          {!isMinimalMode || showPerformance ? <View
            style={[
              styles.heroMetrics,
              adaptiveLayoutMode !== "standard" && styles.heroMetricsWrapped,
            ]}
            testID="dashboard-top-metrics"
          >
            <View
              style={[
                styles.heroMetricCell,
                adaptiveLayoutMode !== "standard" &&
                  styles.heroMetricCellFull,
              ]}
            >
              <AppText color="secondary" variant="caption">
                {dashboard.futuresContributions.some((item) => item.status === "pending") ? "Known invested" : "Invested"}
              </AppText>
              <MaskedValue
                exactValue={formatINR(totalInvested)}
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
                {dashboard.futuresContributions.length ? "Portfolio P&L" : "Holdings P&L"}
              </AppText>
              {totalPnL === null ? (
                <AppText color="secondary" weight="bold">Unavailable</AppText>
              ) : (
                <MaskedValue
                  exactValue={formatSignedINR(totalPnL)}
                  masked={dashboard.maskWealthValues}
                  style={
                    totalPnL >= 0
                      ? styles.positiveText
                      : styles.negativeText
                  }
                  value={formatSignedCompactINR(totalPnL)}
                  weight={isMinimalMode ? "medium" : "bold"}
                />
              )}
            </View>
            <View style={[
              styles.heroMetricCell,
              adaptiveLayoutMode === "large" && styles.heroMetricCellHalf,
              adaptiveLayoutMode === "accessibility" && styles.heroMetricCellFull,
            ]} testID="dashboard-pnl-percent">
              <AppText color="secondary" variant="caption">
                {dashboard.futuresContributions.length ? "Portfolio P&L %" : "Holdings P&L %"}
              </AppText>
              {totalPnLPct !== null ? (
                <AppText
                  accessibilityLabel={`${dashboard.futuresContributions.length ? "Portfolio" : "Holdings"} P&L percentage ${formatPercentage(totalPnLPct)}`}
                  style={
                    totalPnLPct >= 0
                      ? styles.positiveText
                      : styles.negativeText
                  }
                  weight={isMinimalMode ? "medium" : "bold"}
                >
                  {formatPercentage(totalPnLPct)}
                </AppText>
              ) : <AppText color="secondary" weight="bold">Unavailable</AppText>}
            </View>
          </View> : null}
          <View testID="dashboard-quote-card" accessibilityLiveRegion="polite">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Price details. ${quoteStatus.title}`}
              accessibilityState={{ expanded: showPriceDetails }}
              onPress={() => setShowPriceDetails((visible) => !visible)}
              style={styles.priceDisclosure}
              testID="dashboard-price-details-toggle"
            >
              <AppText color="secondary" style={[styles.priceDisclosureLabel, quoteStatus.prominent && styles.warningText]} variant="caption">
                {quoteStatus.title}
              </AppText>
              <AppText color="secondary" variant="caption">
                {showPriceDetails ? "Hide details" : "Details"}
              </AppText>
            </Pressable>
            {(dashboard.isRefreshing || dashboard.quoteFailed.length > 0 || dashboard.quoteTimedOut.length > 0) && (
              dashboard.quoteFreshness.stale > 0 || dashboard.quoteFreshness.manual > 0 || dashboard.quoteFreshness.missing > 0
            ) ? (
              <AppText color="secondary" variant="caption">
                {[
                  dashboard.quoteFreshness.stale > 0 ? "Older prices remain in use" : "",
                  dashboard.quoteFreshness.manual > 0 ? "Manual prices included" : "",
                  dashboard.quoteFreshness.missing > 0 ? "Some prices are missing" : "",
                ].filter(Boolean).join(". ")}
              </AppText>
            ) : null}
            {showPriceDetails ? (
              <View style={styles.priceDetails} testID="dashboard-price-details">
                <AppText color="secondary" variant="caption">
                  Current holdings, cash and recorded PPF balances, using available prices. Not a month-end snapshot.
                </AppText>
                <AppText color="secondary" variant="caption">{quoteStatus.detail}</AppText>
                {hasCompleteValuation && dashboard.quoteFreshness.total > 0 ? (
                  <AppText color="secondary" variant="caption">
                    {dashboard.maskWealthValues
                      ? `${formatPercentage(dashboard.dayChange.percentage)} at saved quotes`
                      : `${dayChangeAmount} (${formatPercentage(dashboard.dayChange.percentage)}) at saved quotes`}
                  </AppText>
                ) : null}
                <AppText color="secondary" variant="caption">
                  Saved-quote movement is not your portfolio return and may cover different price dates.
                </AppText>
                {!dashboard.maskWealthValues && dashboard.totalValue !== null ? (
                  <AppText color="secondary" testID="dashboard-exact-values" variant="caption">
                    Exact values: portfolio {formatINR(dashboard.totalValue)} · invested {formatINR(totalInvested)}
                    {totalPnL === null ? "" : ` · ${dashboard.futuresContributions.length ? "portfolio" : "holdings"} P&L ${formatSignedINR(totalPnL)}`}
                  </AppText>
                ) : null}
              </View>
            ) : null}
          </View>
        </PremiumCard>

        {dashboard.futuresContributions.length ? <PremiumCard testID="dashboard-futures-status">
          <AppText weight="bold">USDT Futures</AppText>
          {dashboard.futuresContributions.map((item) => <View key={item.accountId}>
            <AppText color="secondary">{item.status === "ready" ? "Reconciled wallet equity included; notional excluded." : `Portfolio total pending: ${item.reason}`}</AppText>
            {item.equityInr !== null ? <MaskedValue value={formatCompactINR(Number(item.equityInr))} exactValue={formatINR(Number(item.equityInr))} masked={dashboard.maskWealthValues} /> : null}
          </View>)}
          <AppButton title="Review Futures" variant="secondary" onPress={() => router.push("/futures")} />
        </PremiumCard> : null}

        {quickSetupSavedCount > 0 &&
        onQuickSetup &&
        dashboard.rollupRows.length > 0 ? (
          <PremiumCard elevated testID="dashboard-continue-setup">
            <AppText weight="bold">Continue portfolio setup</AppText>
            <AppText color="secondary" variant="caption">
              {quickSetupSavedCount} confirmed {quickSetupSavedCount === 1 ? "holding is" : "holdings are"} saved. Add the rest when ready.
            </AppText>
            <AppButton
              onPress={onQuickSetup}
              testID="dashboard-continue-setup-button"
              title="Continue setup"
              variant="secondary"
            />
          </PremiumCard>
        ) : null}

        {dashboard.cashBalance < 0 && hasCompleteValuation ? (
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
                  exactValue={formatINR(
                    dashboard.rollupTotals.holdingsCurrentValue ?? 0,
                  )}
                  masked={dashboard.maskWealthValues}
                  testID="dashboard-liability-gross"
                  value={formatCompactINR(
                    dashboard.rollupTotals.holdingsCurrentValue ?? 0,
                  )}
                  weight="bold"
                />
              </View>
              <View style={styles.heroMetricCell}>
                <AppText color="secondary" variant="caption">
                  Cash balance
                </AppText>
                <MaskedValue
                  exactValue={formatINR(dashboard.cashBalance)}
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
                  exactValue={formatINR(
                    dashboard.rollupTotals.totalCurrentValue ?? 0,
                  )}
                  masked={dashboard.maskWealthValues}
                  style={
                    (dashboard.rollupTotals.totalCurrentValue ?? 0) < 0
                      ? styles.negativeText
                      : undefined
                  }
                  testID="dashboard-liability-net"
                  value={formatCompactINR(
                    dashboard.rollupTotals.totalCurrentValue ?? 0,
                  )}
                  weight="bold"
                />
              </View>
            </View>
          </PremiumCard>
        ) : null}

        {!isMinimalMode ? (
          !dashboard.maskWealthValues && dashboard.monthlyMetrics.investment === 0 && dashboard.monthlyMetrics.cashChange === 0 ? (
            <View style={styles.quietActivity} testID="dashboard-monthly-context">
              <AppText color="secondary" variant="caption" weight="medium">{`${formatMonthYear(currentDate)} activity`}</AppText>
              <AppText color="secondary" variant="caption">No net investment or cash change</AppText>
            </View>
          ) : <PremiumCard section style={styles.compactSection} testID="dashboard-monthly-context">
            <SectionHeader title={`${formatMonthYear(currentDate)} activity`} />
            <MetricGroup
              metrics={[
                {
                  exactValue: formatINR(dashboard.monthlyMetrics.investment),
                  label: "Invested",
                  masked: dashboard.maskWealthValues,
                  value: formatCompactINR(dashboard.monthlyMetrics.investment),
                },
                {
                  exactValue: formatSignedINR(dashboard.monthlyMetrics.cashChange),
                  label: "Cash change",
                  masked: dashboard.maskWealthValues,
                  value: formatSignedCompactINR(
                    dashboard.monthlyMetrics.cashChange,
                  ),
                },
              ]}
            />
          </PremiumCard>
        ) : null}

        {hasAllocation ? (
          <PremiumCard section style={styles.compactSection} testID="dashboard-allocation-card">
            <View
              style={[
                styles.allocationHeader,
                adaptiveLayoutMode !== "standard" &&
                  styles.allocationHeaderStacked,
              ]}
            >
              <AppText style={styles.allocationTitle} variant="title" weight="bold">
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
            <AppText color="secondary" testID="dashboard-allocation-scope" variant="caption">
              Share of market holdings and cash · recorded PPF excluded
            </AppText>
            {hasNegativeCash ? (
              <AppText color="secondary" variant="caption">
                {hasPositiveNetPortfolio
                  ? "Percentages show signed exposure against net portfolio value."
                  : "Allocation percentages are unavailable while net portfolio value is zero or negative."}
              </AppText>
            ) : null}
            <View style={styles.allocationLegend} testID={hasNegativeCash ? undefined : "dashboard-allocation-visual"}>
              {displayAllocation.map((item) => (
                <View key={item.assetClass} testID={`dashboard-allocation-${item.assetClass}`} style={styles.allocationItem}>
                  <View style={[
                    styles.allocationLegendRow,
                    adaptiveLayoutMode !== "standard" && styles.allocationHeaderStacked,
                  ]}>
                    <View style={styles.allocationLegendLabel}>
                      <CategoryIcon assetClass={item.assetClass === "equity" ? "stock" : item.assetClass === "futures" ? "crypto" : item.assetClass} size={20} />
                      <AppText variant="body">
                        {getDisplayAllocationLabel(item.assetClass)}
                      </AppText>
                    </View>
                    <View style={styles.allocationLegendValue}>
                      {item.percentage !== null ? (
                        <AppText style={styles.allocationPercentage} weight="bold" variant="body">
                          {formatUnsignedPercentage(item.percentage)}
                        </AppText>
                      ) : null}
                      <MaskedValue
                        exactValue={formatINR(item.value)}
                        masked={dashboard.maskWealthValues}
                        style={styles.allocationAmount}
                        value={formatCompactINR(item.value)}
                        weight="bold"
                      />
                    </View>
                  </View>
                  {!hasNegativeCash ? (
                    <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.allocationTrack}>
                      <View testID={`dashboard-allocation-bar-${item.assetClass}`} style={{
                        backgroundColor: getAllocationColor(colors, item.assetClass),
                        height: "100%",
                        width: getAllocationWidth(item.value, positiveAllocationTotal),
                      }} />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </PremiumCard>
        ) : (
          <EmptyState
            actionLabel={
              hasNegativeFuturesEquity
                ? "Review Futures"
                : hasCompleteValuation
                ? onQuickSetup
                  ? quickSetupSavedCount > 0
                    ? "Continue portfolio setup"
                    : "Set up your portfolio"
                  : onAddTrade
                    ? "Add Holding"
                  : undefined
                : pendingFuturesCount > 0 ? "Review Futures" : "Refresh prices"
            }
            actionTestID={
              hasNegativeFuturesEquity
                ? "dashboard-review-negative-futures"
                : hasCompleteValuation
                ? onQuickSetup
                  ? "quick-setup-button"
                  : "add-trade-button"
                : pendingFuturesCount > 0 ? "dashboard-review-pending-futures" : "dashboard-refresh-pending-prices"
            }
            message={
              hasNegativeFuturesEquity
                ? "Negative Futures equity cannot be shown as a share of positive holdings. Review the wallet."
                : hasCompleteValuation
                ? quickSetupSavedCount > 0
                  ? `${quickSetupSavedCount} ${quickSetupSavedCount === 1 ? "holding is" : "holdings are"} already saved. Continue when ready.`
                  : onQuickSetup
                    ? "Choose manual entry or import holdings and transaction history. Your records stay local."
                    : "Add your first portfolio entry to build holdings automatically."
                : pendingFuturesCount > 0
                  ? "Reconcile the Futures wallet to complete portfolio allocation."
                  : "Allocation will appear after every holding has a current valuation."
            }
            title={
              hasCompleteValuation && !hasNegativeFuturesEquity ? "No allocation yet" : "Allocation unavailable"
            }
            onAction={
              hasNegativeFuturesEquity
                ? () => router.push("/futures")
                : hasCompleteValuation
                ? onQuickSetup ?? onAddTrade
                : pendingFuturesCount > 0
                  ? () => router.push("/futures")
                  : () => { void dashboard.refresh(); }
            }
            onSecondaryAction={
              hasCompleteValuation && onQuickSetup ? onAddTrade : undefined
            }
            secondaryActionLabel={
              hasCompleteValuation && onQuickSetup ? "Add one holding" : undefined
            }
            secondaryActionTestID="add-trade-button"
          />
        )}

        {isMinimalMode ? (
          <GroupedListRow
            title="Month-end snapshot"
            meta="Stored values, not current prices"
            accessibilityLabel="Open Progress. Stored month-end values, not current prices."
            onPress={onOpenProgress}
            showChevron
            testID="dashboard-open-progress"
          />
        ) : <PremiumCard style={styles.supportCard} testID="dashboard-support-card">
          <View
            style={[
              styles.supportRow,
              adaptiveLayoutMode !== "standard" && styles.supportRowStacked,
            ]}
            testID="dashboard-next-review-card"
          >
            <CategoryIcon assetClass="neutral" size={18} />
            <View style={styles.infoCardCopy}>
              <AppText variant="caption" weight="bold">
                Month-end snapshot
              </AppText>
              <AppText color="secondary" variant="caption">
                Progress shows stored month-end values. They can differ from current holdings and prices here.
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
        </PremiumCard>}

        <InsightCards store={store} now={now} onOpen={onOpenInsight} />
      </View>
    </ScreenContainer>
  );
}

function getQuoteStatus({
  hasFutures,
  isRefreshing,
  quoteFailed,
  quoteFreshness,
  quoteTimedOut,
}: {
  hasFutures: boolean;
  isRefreshing: boolean;
  quoteFailed: number;
  quoteFreshness: QuoteFreshnessSummary;
  quoteTimedOut: number;
}) {
  const counts = `Current ${quoteFreshness.current} · Stale ${quoteFreshness.stale} · Manual ${quoteFreshness.manual} · Missing ${quoteFreshness.missing}`;

  if (isRefreshing) {
    return {
      detail: counts,
      prominent: false,
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
      prominent: usablePriceCount === 0 || quoteFreshness.missing > 0,
      title:
        usablePriceCount > 0
          ? "Refresh partially completed"
          : "Quote refresh failed",
    };
  }

  if (quoteFreshness.status === "empty") {
    return {
      detail: hasFutures
        ? "Review Futures mark prices, wallet balance and INR rates separately."
        : "Cash and recorded PPF balances do not need market quotes.",
      prominent: false,
      title: hasFutures ? "No spot prices needed" : "No market prices needed",
    };
  }

  const prominent = quoteFreshness.missing > 0;
  const title = prominent
    ? "Price coverage needs attention"
    : quoteFreshness.status === "current"
      ? "Prices up to date"
      : quoteFreshness.stale > 0
        ? quoteFreshness.manual > 0
          ? "Using older and manual prices"
          : "Using older saved prices"
        : "Using manual prices";

  return {
    detail: counts,
    prominent,
    title,
  };
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  priceDisclosure: {
    minHeight: 48,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  priceDisclosureLabel: {
    flexShrink: 1,
  },
  priceDetails: {
    gap: spacing.sm,
  },
  allocationHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  allocationHeaderStacked: {
    alignItems: "flex-start",
    flexDirection: "column",
    gap: spacing.xs,
  },
  allocationTitle: {
    flexShrink: 1,
  },
  allocationLegend: {
    gap: spacing.md,
  },
  allocationItem: {
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
    minHeight: 40,
  },
  allocationLegendValue: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  allocationPercentage: {
    minWidth: 72,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  allocationAmount: {
    minWidth: 80,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  allocationTrack: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.pill,
    height: 4,
    overflow: "hidden",
  },
  brandText: {
    color: colors.primary,
  },
  content: {
    gap: spacing.cardGap,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  quietActivity: { gap: spacing.xs, paddingHorizontal: spacing.xs },
  compactSection: { paddingVertical: spacing.sm },
  heroCard: {
    gap: spacing.sm,
  },
  heroContextRow: {
    alignItems: "flex-start",
    flexDirection: "column",
  },
  heroContextText: {
    flexShrink: 1,
    width: "100%",
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
  inlineAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.sm,
  },
  negativeText: {
    color: colors.loss,
  },
  positiveText: {
    color: colors.profit,
  },
  supportCard: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  supportRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  supportRowStacked: {
    alignItems: "flex-start",
    flexDirection: "column",
  },
  warningText: {
    color: colors.warning,
  },
}));
