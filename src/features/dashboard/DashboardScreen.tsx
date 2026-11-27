import { useState } from "react";
import { RefreshControl, useWindowDimensions, View } from "react-native";
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
import { useDashboardWidgetSync } from "@/src/features/widget/useWidgetSync";
import type { AppLockState } from "@/src/services/security/appLock";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { BackupReminderNote } from "@/src/features/backup/BackupReminderNote";
import type { BackupStatusState } from "@/src/services/backup/backupStatus";
import { useTheme } from "@/src/theme";

import { useDashboard } from "./useDashboard";
import { InsightCards } from "@/src/features/insights";
import { SipDueCard } from "@/src/features/sips";
import type { InsightKind } from "@/src/domain/calculations/behaviorInsightDetails";
import { DashboardAllocation } from "./DashboardAllocation";
import { DashboardPortfolioHero } from "./DashboardPortfolioHero";
import {
  DashboardCashLiability,
  DashboardContinueSetup,
  DashboardCurrencyWarning,
  DashboardEpfStatus,
  DashboardFuturesStatus,
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
  onReviewPayouts?: (assetId: string) => void;
  onConfirmPayouts?: () => void;
  onSetBasis?: () => void;
  /** Opens the due SIP instalments (#766). */
  onOpenSipDue?: () => void;
  onQuickSetup?: () => void;
  quickSetupSavedCount?: number;
  refreshQuotes?: RefreshQuotes;
  store?: StoreApi<PortfolioStoreState>;
  /** The backup reminder shows only when this is given (#759). */
  backupStatusStore?: StoreApi<BackupStatusState>;
  /** App lock state for the home-screen widget; without it the widget stays hidden (#786). */
  appLockStore?: StoreApi<AppLockState>;
};

export function DashboardScreen({
  now,
  onAddTrade,
  onOpenHoldings,
  onOpenEpf,
  onOpenProgress,
  onOpenInsight,
  onQuickSetup,
  onReviewPayouts,
  onConfirmPayouts,
  onSetBasis,
  onOpenSipDue,
  quickSetupSavedCount = 0,
  refreshQuotes,
  store = getPortfolioStore(),
  backupStatusStore,
  appLockStore,
}: DashboardScreenProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const currentDate = now ?? new Date();
  const [showPriceDetails, setShowPriceDetails] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [showCryptoBreakdown, setShowCryptoBreakdown] = useState(false);
  const { fontScale } = useWindowDimensions();
  const adaptiveLayoutMode = getAdaptiveLayoutMode(fontScale);
  const dashboard = useDashboard({ now: currentDate, refreshQuotes, store });
  const isMinimalMode = dashboard.displayMode === "minimal";
  const [disclosureMinimalMode, setDisclosureMinimalMode] = useState(isMinimalMode);
  if (disclosureMinimalMode !== isMinimalMode) {
    setDisclosureMinimalMode(isMinimalMode);
    setShowPerformance(false);
    setShowCryptoBreakdown(false);
  }
  const pendingFuturesCount = dashboard.futuresContributions.filter((item) => item.status === "pending").length;
  const hasCompleteValuation =
    dashboard.rollupTotals.valuationCoverage.status === "complete";
  // The home-screen widget shows this same valuation (#786).
  useDashboardWidgetSync({
    appLockStore,
    dashboard,
    hasCompleteValuation,
    maskWealthValues: dashboard.maskWealthValues,
    now: currentDate,
    showWidgetValue: dashboard.showWidgetValue,
    store,
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
    <ScreenContainer
      refreshControl={
        <RefreshControl
          refreshing={dashboard.isRefreshing}
          tintColor={colors.primary}
          onRefresh={() => {
            void dashboard.refresh();
          }}
        />
      }
      scroll
      testID="dashboard-screen"
    >
      <View style={styles.content}>
        <ScreenHeader
          compact
          title="Dashboard"
          action={
            <>
              <IconButton
                plain
                accessibilityLabel={
                  dashboard.maskWealthValues ? "Show values" : "Hide values"
                }
                icon={dashboard.maskWealthValues ? "eye-off-outline" : "eye-outline"}
                onPress={dashboard.toggleMaskWealthValues}
                testID="dashboard-mask-toggle"
              />
              <IconButton
                plain
                accessibilityLabel={dashboard.isRefreshing ? "Refreshing quotes" : "Refresh quotes"}
                busy={dashboard.isRefreshing}
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
          onReviewPayouts={onReviewPayouts}
          onConfirmPayouts={onConfirmPayouts}
          onOpenProgress={onOpenProgress}
          onSetBasis={onSetBasis}
          adaptiveLayoutMode={adaptiveLayoutMode}
          currentDate={currentDate}
          dashboard={dashboard}
          hasCompleteValuation={hasCompleteValuation}
          isMinimalMode={isMinimalMode}
          pendingFuturesCount={pendingFuturesCount}
          setShowPerformance={setShowPerformance}
          setShowPriceDetails={setShowPriceDetails}
          showPerformance={showPerformance}
          showPriceDetails={showPriceDetails}
        />

        {backupStatusStore ? (
          <BackupReminderNote
            backupStatusStore={backupStatusStore}
            minimalMode={isMinimalMode}
            now={currentDate}
            store={store}
          />
        ) : null}

        <SipDueCard now={currentDate} onOpen={onOpenSipDue} store={store} />

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
