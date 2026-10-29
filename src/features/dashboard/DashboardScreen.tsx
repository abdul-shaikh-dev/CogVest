import { useEffect, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  EmptyState,
  IconButton,
  ScreenContainer,
  ScreenHeader,
  getAdaptiveLayoutMode,
} from "@/src/components/common";
import type {
  QuoteRefreshResult,
  RefreshQuotesInput,
} from "@/src/services/quotes";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";

import { useDashboard } from "./useDashboard";
import { InsightCards } from "@/src/features/insights";
import type { InsightKind } from "@/src/domain/calculations/behaviorInsightDetails";
import { DashboardAllocation } from "./DashboardAllocation";
import { DashboardPortfolioHero } from "./DashboardPortfolioHero";
import {
  DashboardCashLiability,
  DashboardContinueSetup,
  DashboardCurrencyWarning,
  DashboardEpfStatus,
  DashboardFuturesStatus,
  DashboardMonthlyActivity,
  DashboardProgressLink,
} from "./DashboardStatusCards";
import { useStyles } from "./dashboardStyles";

type RefreshQuotes = (
  input: RefreshQuotesInput,
) => Promise<QuoteRefreshResult>;

type DashboardScreenProps = {
  now?: Date;
  onAddTrade?: () => void;
  onOpenHoldings?: () => void;
  onOpenEpf?: () => void;
  onOpenProgress?: () => void;
  onOpenInsight?: (kind: InsightKind) => void;
  /** Opens the whole-portfolio start (measurement basis) screen. */
  onSetBasis?: () => void;
  onQuickSetup?: () => void;
  quickSetupSavedCount?: number;
  refreshQuotes?: RefreshQuotes;
  store?: StoreApi<PortfolioStoreState>;
};

export function DashboardScreen({
  now,
  onAddTrade,
  onOpenHoldings,
  onOpenEpf,
  onOpenProgress,
  onOpenInsight,
  onQuickSetup,
  onSetBasis,
  quickSetupSavedCount = 0,
  refreshQuotes,
  store = getPortfolioStore(),
}: DashboardScreenProps) {
  const styles = useStyles();
  const currentDate = now ?? new Date();
  const [showPriceDetails, setShowPriceDetails] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [showCryptoBreakdown, setShowCryptoBreakdown] = useState(false);
  const { fontScale } = useWindowDimensions();
  const adaptiveLayoutMode = getAdaptiveLayoutMode(fontScale);
  const dashboard = useDashboard({ now: currentDate, refreshQuotes, store });
  const isMinimalMode = dashboard.displayMode === "minimal";
  useEffect(() => { setShowPerformance(false); setShowCryptoBreakdown(false); }, [isMinimalMode]);
  const pendingFuturesCount = dashboard.futuresContributions.filter((item) => item.status === "pending").length;
  const hasCompleteValuation =
    dashboard.rollupTotals.valuationCoverage.status === "complete";

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

        <DashboardCurrencyWarning dashboard={dashboard} />

        <DashboardPortfolioHero
          onSetBasis={onSetBasis}
          adaptiveLayoutMode={adaptiveLayoutMode}
          dashboard={dashboard}
          hasCompleteValuation={hasCompleteValuation}
          isMinimalMode={isMinimalMode}
          pendingFuturesCount={pendingFuturesCount}
          setShowPerformance={setShowPerformance}
          setShowPriceDetails={setShowPriceDetails}
          showPerformance={showPerformance}
          showPriceDetails={showPriceDetails}
        />

        <DashboardEpfStatus dashboard={dashboard} onOpenEpf={onOpenEpf} />

        <DashboardFuturesStatus dashboard={dashboard} />

        <DashboardContinueSetup
          dashboard={dashboard}
          onQuickSetup={onQuickSetup}
          quickSetupSavedCount={quickSetupSavedCount}
        />

        <DashboardCashLiability
          dashboard={dashboard}
          hasCompleteValuation={hasCompleteValuation}
        />

        <DashboardMonthlyActivity
          currentDate={currentDate}
          dashboard={dashboard}
          isMinimalMode={isMinimalMode}
        />

        <DashboardAllocation
          adaptiveLayoutMode={adaptiveLayoutMode}
          dashboard={dashboard}
          hasCompleteValuation={hasCompleteValuation}
          onAddTrade={onAddTrade}
          onOpenHoldings={onOpenHoldings}
          onQuickSetup={onQuickSetup}
          pendingFuturesCount={pendingFuturesCount}
          quickSetupSavedCount={quickSetupSavedCount}
          setShowCryptoBreakdown={setShowCryptoBreakdown}
          showCryptoBreakdown={showCryptoBreakdown}
        />

        <DashboardProgressLink
          adaptiveLayoutMode={adaptiveLayoutMode}
          isMinimalMode={isMinimalMode}
          onOpenProgress={onOpenProgress}
        />

        <InsightCards store={store} now={now} onOpen={onOpenInsight} />
      </View>
    </ScreenContainer>
  );
}
