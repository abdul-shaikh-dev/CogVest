import type { Dispatch, SetStateAction } from "react";
import { router } from "expo-router";
import { Pressable, View } from "react-native";

import {
  AppText,
  CategoryIcon,
  DisclosureButton,
  EmptyState,
  MaskedValue,
  PremiumCard,
  type AdaptiveLayoutMode,
} from "@/src/components/common";
import { calculateReportingAllocation } from "@/src/domain/calculations/reportingAllocation";
import { formatCompactINR, formatINR } from "@/src/domain/formatters";
import {
  normalizeMoney,
  sumFinancialValues,
} from "@/src/domain/precision";
import { useTheme } from "@/src/theme";

import { useStyles } from "./dashboardStyles";
import {
  formatUnsignedPercentage,
  getAllocationColor,
  getAllocationWidth,
  getDisplayAllocationLabel,
} from "./dashboardViewModel";
import type { DashboardState } from "./useDashboard";

type DashboardAllocationProps = {
  adaptiveLayoutMode: AdaptiveLayoutMode;
  dashboard: DashboardState;
  hasCompleteValuation: boolean;
  onAddTrade?: () => void;
  onOpenHoldings?: () => void;
  onQuickSetup?: () => void;
  pendingFuturesCount: number;
  quickSetupSavedCount: number;
  setShowCryptoBreakdown: Dispatch<SetStateAction<boolean>>;
  showCryptoBreakdown: boolean;
};

export function DashboardAllocation({
  adaptiveLayoutMode,
  dashboard,
  hasCompleteValuation,
  onAddTrade,
  onOpenHoldings,
  onQuickSetup,
  pendingFuturesCount,
  quickSetupSavedCount,
  setShowCryptoBreakdown,
  showCryptoBreakdown,
}: DashboardAllocationProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const displayAllocation = calculateReportingAllocation({
    holdings: dashboard.holdings,
    cashBalance: dashboard.cashBalance,
    futuresEquityInr: dashboard.futuresEquityInr,
    ppfConfirmedBalance: dashboard.ppfConfirmedBalance,
    epfRecordedBalance: dashboard.epfSummary.value,
  });
  const positiveAllocation = displayAllocation.filter((item) => item.value > 0);
  const positiveAllocationTotal = normalizeMoney(
    sumFinancialValues(positiveAllocation.map((item) => item.value)),
  );
  const hasAllocation = displayAllocation.some((item) => item.value !== 0);
  const hasNegativeFuturesEquity = dashboard.futuresEquityInr !== null && dashboard.futuresEquityInr < 0;
  const hasNegativeCash = dashboard.cashBalance < 0;
  const hasPositiveNetPortfolio =
    (dashboard.rollupTotals.totalCurrentValue ?? 0) > 0;

  if (!hasAllocation) {
    return (
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
    );
  }

  return (
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
        Share of portfolio value · includes recorded {dashboard.epfSummary.accountCount ? "PPF/EPF" : "PPF"} and Futures equity
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
                <CategoryIcon assetClass={item.assetClass === "equity" ? "stock" : item.assetClass} size={20} />
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
            {item.cryptoBreakdown && (item.value !== 0 || dashboard.futuresContributions.length > 0) ? (
              <>
                <DisclosureButton title="Spot / Futures" expanded={showCryptoBreakdown}
                  onPress={() => setShowCryptoBreakdown(value => !value)} testID="dashboard-crypto-breakdown" />
                {showCryptoBreakdown ? (
                  <View>
                    {(["spot", "futures"] as const).map(kind => (
                      <View key={kind} style={[styles.allocationLegendRow,
                        adaptiveLayoutMode !== "standard" && styles.allocationHeaderStacked]}>
                        <AppText color="secondary" variant="caption">{kind === "spot" ? "Spot" : "Futures wallet equity"}</AppText>
                        <MaskedValue masked={dashboard.maskWealthValues}
                          testID={`dashboard-crypto-${kind}`}
                          exactValue={formatINR(item.cryptoBreakdown![kind])}
                          value={formatCompactINR(item.cryptoBreakdown![kind])} />
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        ))}
      </View>
    </PremiumCard>
  );
}
