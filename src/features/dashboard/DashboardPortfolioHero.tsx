import type { Dispatch, SetStateAction } from "react";
import { Pressable, View } from "react-native";

import {
  AppText,
  DisclosureButton,
  MaskedValue,
  PremiumCard,
  type AdaptiveLayoutMode,
} from "@/src/components/common";
import {
  formatCompactINR,
  formatINR,
  formatPercentage,
} from "@/src/domain/formatters";

import { useStyles } from "./dashboardStyles";
import {
  formatSignedCompactINR,
  formatSignedINR,
  getQuoteStatus,
} from "./dashboardViewModel";
import type { DashboardState } from "./useDashboard";

type DashboardPortfolioHeroProps = {
  adaptiveLayoutMode: AdaptiveLayoutMode;
  dashboard: DashboardState;
  hasCompleteValuation: boolean;
  isMinimalMode: boolean;
  pendingFuturesCount: number;
  setShowPerformance: Dispatch<SetStateAction<boolean>>;
  setShowPriceDetails: Dispatch<SetStateAction<boolean>>;
  showPerformance: boolean;
  showPriceDetails: boolean;
};

export function DashboardPortfolioHero({
  adaptiveLayoutMode,
  dashboard,
  hasCompleteValuation,
  isMinimalMode,
  pendingFuturesCount,
  setShowPerformance,
  setShowPriceDetails,
  showPerformance,
  showPriceDetails,
}: DashboardPortfolioHeroProps) {
  const styles = useStyles();
  const dayChangeAmount = formatSignedINR(dashboard.dayChange.absolute);
  const totalInvested = dashboard.rollupTotals.totalInvested;
  const totalPnL = dashboard.rollupTotals.pnl;
  const totalPnLPct = dashboard.rollupTotals.pnlPct;
  const quoteStatus = getQuoteStatus({
    hasFutures: dashboard.futuresContributions.length > 0,
    isRefreshing: dashboard.isRefreshing,
    quoteFailed: dashboard.quoteFailed.length,
    quoteFreshness: dashboard.quoteFreshness,
    quoteTimedOut: dashboard.quoteTimedOut.length,
  });

  return (
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
          {dashboard.investedCapitalComplete ? <MaskedValue
            exactValue={formatINR(totalInvested)}
            masked={dashboard.maskWealthValues}
            value={formatCompactINR(totalInvested)}
            weight="bold"
          /> : <AppText color="secondary" weight="bold">Unknown</AppText>}
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
            {dashboard.futuresContributions.length || dashboard.epfSummary.accountCount ? "Portfolio P&L" : "Holdings P&L"}
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
            {dashboard.futuresContributions.length || dashboard.epfSummary.accountCount ? "Portfolio P&L %" : "Holdings P&L %"}
          </AppText>
          {totalPnLPct !== null ? (
            <AppText
              accessibilityLabel={`${dashboard.futuresContributions.length || dashboard.epfSummary.accountCount ? "Portfolio" : "Holdings"} P&L percentage ${formatPercentage(totalPnLPct)}`}
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
              Current holdings, cash and recorded {dashboard.epfSummary.accountCount ? "PPF/EPF" : "PPF"} balances, using available prices. Not a month-end snapshot.
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
                Exact values: portfolio {formatINR(dashboard.totalValue)} · invested {dashboard.investedCapitalComplete ? formatINR(totalInvested) : "unknown"}
                {totalPnL === null ? "" : ` · ${dashboard.futuresContributions.length || dashboard.epfSummary.accountCount ? "portfolio" : "holdings"} P&L ${formatSignedINR(totalPnL)}`}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>
    </PremiumCard>
  );
}
