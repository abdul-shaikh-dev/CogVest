import { useState, type Dispatch, type SetStateAction } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import {
  AppText,
  DisclosureButton,
  MaskedValue,
  PremiumCard,
  type AdaptiveLayoutMode,
} from "@/src/components/common";
import { formatMonthYear } from "@/src/domain/dates";
import {
  formatCompactINR,
  formatINR,
  formatPercentage,
} from "@/src/domain/formatters";
import { useTheme } from "@/src/theme";

import { useStyles } from "./dashboardStyles";
import { DashboardXirrDetails, DashboardXirrTile } from "./DashboardXirr";
import {
  formatPendingPricesLabel,
  formatSignedCompactINR,
  formatSignedINR,
  getMonthlyActivitySummary,
  getQuoteStatus,
} from "./dashboardViewModel";
import type { DashboardState } from "./useDashboard";

const PRICE_ROW_HIT_SLOP = { bottom: 8, top: 8 };

type DashboardPortfolioHeroProps = {
  adaptiveLayoutMode: AdaptiveLayoutMode;
  currentDate: Date;
  dashboard: DashboardState;
  hasCompleteValuation: boolean;
  isMinimalMode: boolean;
  onReviewPayouts?: (assetId: string) => void;
  onConfirmPayouts?: () => void;
  onSetBasis?: () => void;
  pendingFuturesCount: number;
  setShowPerformance: Dispatch<SetStateAction<boolean>>;
  setShowPriceDetails: Dispatch<SetStateAction<boolean>>;
  showPerformance: boolean;
  showPriceDetails: boolean;
};

/**
 * The Dashboard's answer at a glance (#782): the portfolio value with its gain
 * on one line, return and this month as two tiles, and price status as a chip.
 * Explanations sit one tap away.
 */
export function DashboardPortfolioHero({
  adaptiveLayoutMode,
  currentDate,
  dashboard,
  hasCompleteValuation,
  isMinimalMode,
  onReviewPayouts,
  onConfirmPayouts,
  onSetBasis,
  pendingFuturesCount,
  setShowPerformance,
  setShowPriceDetails,
  showPerformance,
  showPriceDetails,
}: DashboardPortfolioHeroProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [showXirrDetails, setShowXirrDetails] = useState(false);
  const dayChangeAmount = formatSignedINR(dashboard.dayChange.absolute);
  const totalInvested = dashboard.rollupTotals.totalInvested;
  const totalPnL = dashboard.rollupTotals.pnl;
  const totalPnLPct = dashboard.rollupTotals.pnlPct;
  const pendingHoldings = dashboard.rollupTotals.valuationCoverage.pendingHoldings;
  const pnlScope = dashboard.futuresContributions.length || dashboard.epfSummary.accountCount ? "Portfolio" : "Holdings";
  // While a holding has no price, the invested amount is the number that is
  // known; the hero shows it instead of a status heading.
  const showInvestedHero = dashboard.totalValue === null && pendingFuturesCount === 0
    && dashboard.investedCapitalComplete;
  const showPerformanceArea = !isMinimalMode || showPerformance;
  const stackTiles = adaptiveLayoutMode !== "standard";
  const quoteStatus = getQuoteStatus({
    hasFutures: dashboard.futuresContributions.length > 0,
    isRefreshing: dashboard.isRefreshing,
    quoteFailed: dashboard.quoteFailed.length,
    quoteFreshness: dashboard.quoteFreshness,
    quoteTimedOut: dashboard.quoteTimedOut.length,
    refreshError: dashboard.refreshError,
  });

  return (
    <PremiumCard section style={styles.heroCard} testID="dashboard-portfolio-hero">
      <AppText color="secondary" variant="caption" weight="bold">
        {showInvestedHero ? "Invested" : "Portfolio value"}
      </AppText>
      <MaskedValue
        adjustsFontSizeToFit
        exactValue={showInvestedHero ? formatINR(totalInvested)
          : dashboard.totalValue === null ? undefined : formatINR(dashboard.totalValue)}
        masked={dashboard.maskWealthValues && (showInvestedHero || dashboard.totalValue !== null)}
        minimumFontScale={0.74}
        numberOfLines={1}
        style={styles.heroValue}
        testID="dashboard-hero-value"
        value={showInvestedHero ? formatCompactINR(totalInvested)
          : dashboard.totalValue === null ? "Valuation pending" : formatCompactINR(dashboard.totalValue)}
        weight="bold"
      />
      {showInvestedHero ? (
        <AppText color="secondary" variant="caption">Current value needs every price</AppText>
      ) : null}
      {!hasCompleteValuation && pendingFuturesCount > 0 ? (
        <AppText color="secondary" style={styles.heroContextText} variant="caption">
          {`${pendingFuturesCount} Futures wallet${pendingFuturesCount === 1 ? "" : "s"} pending. Review below to complete the total.`}
        </AppText>
      ) : null}
      {!hasCompleteValuation && pendingFuturesCount === 0 && pendingHoldings > 0 ? (
        <Pressable
          accessibilityHint="Refreshes prices"
          accessibilityRole="button"
          hitSlop={PRICE_ROW_HIT_SLOP}
          onPress={() => { void dashboard.refresh(); }}
          style={styles.statusChip}
          testID="dashboard-pending-prices"
        >
          <Ionicons color={colors.warning} name="alert-circle-outline" size={16} />
          <AppText style={[styles.priceDisclosureLabel, styles.warningText]} variant="caption" weight="medium">
            {`${formatPendingPricesLabel(pendingHoldings)} · Refresh`}
          </AppText>
        </Pressable>
      ) : null}
      {isMinimalMode ? (
        <DisclosureButton
          expanded={showPerformance}
          onPress={() => setShowPerformance((visible) => !visible)}
          testID="dashboard-performance-toggle"
          title="Invested & returns"
        />
      ) : null}
      {showPerformanceArea && !showInvestedHero ? (
        <View style={styles.gainLine} testID="dashboard-top-metrics">
          {totalPnL !== null ? (
            <AppText>
              <MaskedValue
                exactValue={formatSignedINR(totalPnL)}
                masked={dashboard.maskWealthValues}
                style={totalPnL >= 0 ? styles.positiveText : styles.negativeText}
                testID="dashboard-pnl"
                value={formatSignedCompactINR(totalPnL)}
                weight="bold"
              />
              {totalPnLPct !== null ? (
                <AppText
                  accessibilityLabel={`${pnlScope} P&L percentage ${formatPercentage(totalPnLPct)}`}
                  style={totalPnLPct >= 0 ? styles.positiveText : styles.negativeText}
                  testID="dashboard-pnl-percent"
                  weight="bold"
                >
                  {` (${formatPercentage(totalPnLPct)})`}
                </AppText>
              ) : null}
            </AppText>
          ) : null}
          <AppText color="secondary" testID="dashboard-invested-context" variant="caption">
            {totalPnL === null ? `${pnlScope} P&L unavailable · ` : `${pnlScope} P&L on `}
            {dashboard.investedCapitalComplete ? (
              <>
                <MaskedValue
                  color="secondary"
                  exactValue={formatINR(totalInvested)}
                  masked={dashboard.maskWealthValues}
                  value={formatCompactINR(totalInvested)}
                  variant="caption"
                />
                {pendingFuturesCount > 0 ? " known invested" : " invested"}
              </>
            ) : "invested unknown"}
          </AppText>
        </View>
      ) : null}
      {showPerformanceArea ? (
        <View style={[styles.glanceTiles, stackTiles && styles.glanceTilesStacked]}>
          <DashboardXirrTile
            expanded={showXirrDetails}
            onToggle={() => setShowXirrDetails((visible) => !visible)}
            stacked={stackTiles}
            summary={dashboard.wholePortfolioXirr}
          />
          {!isMinimalMode ? <MonthTile currentDate={currentDate} dashboard={dashboard} stacked={stackTiles} /> : null}
        </View>
      ) : null}
      {showPerformanceArea && showXirrDetails ? (
        <DashboardXirrDetails
          masked={dashboard.maskWealthValues}
          monthlySnapshots={dashboard.monthlySnapshots}
          names={dashboard.xirrNames}
          onConfirmPayouts={onConfirmPayouts}
          onReviewPayouts={onReviewPayouts}
          onSetBasis={onSetBasis}
          scope={dashboard.wholePortfolioXirrScope}
          summary={dashboard.wholePortfolioXirr}
        />
      ) : null}
      <View testID="dashboard-quote-card" accessibilityLiveRegion="polite">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Price details. ${quoteStatus.title}`}
          accessibilityState={{ expanded: showPriceDetails }}
          hitSlop={PRICE_ROW_HIT_SLOP}
          onPress={() => setShowPriceDetails((visible) => !visible)}
          style={styles.statusChip}
          testID="dashboard-price-details-toggle"
        >
          <AppText color="secondary" style={[styles.priceDisclosureLabel, quoteStatus.prominent && styles.warningText]} variant="caption" weight="medium">
            {quoteStatus.title}
          </AppText>
          <Ionicons
            color={quoteStatus.prominent ? colors.warning : colors.text.secondary}
            name={showPriceDetails ? "chevron-up" : "chevron-down"}
            size={14}
          />
        </Pressable>
        {showPriceDetails ? (
          <View style={styles.priceDetails} testID="dashboard-price-details">
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
                {totalPnL === null ? "" : ` · ${pnlScope.toLowerCase()} P&L ${formatSignedINR(totalPnL)}`}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>
    </PremiumCard>
  );
}

/** This month's investment and Cash change as a tile (#782). */
function MonthTile({ currentDate, dashboard, stacked }: { currentDate: Date; dashboard: DashboardState; stacked: boolean }) {
  const styles = useStyles();
  const { cashChange, investment } = dashboard.monthlyMetrics;
  const summary = getMonthlyActivitySummary({ cashChange, investment });
  const quiet = summary.invested === null && summary.cash === null;
  return (
    <View
      accessibilityLabel={`${formatMonthYear(currentDate)} activity`}
      style={[styles.glanceTile, stacked && styles.glanceTileFull]}
      testID="dashboard-monthly-context"
    >
      <AppText color="secondary" variant="caption">{formatMonthYear(currentDate)}</AppText>
      {quiet && !dashboard.maskWealthValues ? (
        <AppText color="secondary" weight="bold">No change</AppText>
      ) : null}
      {summary.invested !== null || dashboard.maskWealthValues ? (
        <AppText testID="dashboard-month-invested">
          <MaskedValue
            exactValue={formatINR(investment)}
            masked={dashboard.maskWealthValues}
            value={formatCompactINR(investment)}
            weight="bold"
          />
          <AppText color="secondary" variant="caption"> invested</AppText>
        </AppText>
      ) : null}
      {summary.cash !== null || dashboard.maskWealthValues ? (
        <AppText color="secondary" testID="dashboard-month-cash" variant="caption">
          {"Cash "}
          <MaskedValue
            color="secondary"
            exactValue={formatSignedINR(cashChange)}
            masked={dashboard.maskWealthValues}
            value={formatSignedCompactINR(cashChange)}
            variant="caption"
          />
        </AppText>
      ) : null}
    </View>
  );
}
