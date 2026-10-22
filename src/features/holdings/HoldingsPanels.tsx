import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppButton, AppText, GroupedListRow, PremiumCard } from "@/src/components/common";
import { useReducedMotionPreference } from "@/src/hooks";
import { formatPercentage } from "@/src/domain/formatters";
import { spacing } from "@/src/theme";

import type { ExposureSegment, HoldingReviewItem, getHoldingReviewSummary } from "./holdingsReview";
import { ExposurePanel, InsightCard } from "./HoldingsInsights";
import { useStyles } from "./holdingsStyles";
import type { getQuoteStatus } from "./holdingsViewModel";

export type HoldingsPanel = "add" | "insights" | "more" | "quotes";

/** The bottom sheet that hosts one Holdings panel at a time. */
export function HoldingsPanelSheet({
  activePanel,
  children,
  setActivePanel,
}: {
  activePanel?: HoldingsPanel;
  children: ReactNode;
  setActivePanel: (panel?: HoldingsPanel) => void;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const isReducedMotionEnabled = useReducedMotionPreference();
  return (
    <Modal
      animationType={isReducedMotionEnabled ? "none" : "fade"}
      onRequestClose={() => setActivePanel(undefined)}
      transparent
      visible={activePanel !== undefined}
    >
      <View
        style={[
          styles.panelBackdrop,
          {
            paddingBottom: Math.max(insets.bottom, spacing.md),
            paddingTop: Math.max(insets.top, spacing.md),
          },
        ]}
      >
        <Pressable
          accessibilityLabel="Close holdings panel"
          accessibilityRole="button"
          onPress={() => setActivePanel(undefined)}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={styles.panelSheet}>
          <View style={styles.panelHeader}>
            {activePanel === "quotes" ? (
              <AppButton
                onPress={() => setActivePanel("more")}
                title="Back"
                variant="ghost"
              />
            ) : null}
            <AppText
              accessibilityRole="header"
              style={styles.panelTitle}
              variant="title"
              weight="bold"
            >
              {activePanel === "add"
                ? "Add holdings"
                : activePanel === "more"
                  ? "Holdings options"
                  : activePanel === "quotes"
                    ? "Valuation details"
                    : "Portfolio insights"}
            </AppText>
            <AppButton
              onPress={() => setActivePanel(undefined)}
              testID="holdings-panel-close"
              title="Close"
              variant="ghost"
            />
          </View>
          <ScrollView contentContainerStyle={styles.panelContent}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Ways to add holdings: record activity, add what you own, or import. */
export function AddHoldingsPanel({
  onAddEpfAccount,
  onAddPpfAccount,
  onAddTrade,
  onClose,
  onImportHoldings,
  onImportTransactions,
  onOpenFutures,
  onQuickSetup,
  onRecordPurchase,
  quickSetupSavedCount,
}: {
  onAddEpfAccount?: () => void;
  onAddPpfAccount?: (legacy?: { assetId?: string; name?: string }) => void;
  onAddTrade?: () => void;
  onClose: () => void;
  onImportHoldings?: () => void;
  onImportTransactions?: () => void;
  onOpenFutures?: () => void;
  onQuickSetup?: () => void;
  onRecordPurchase?: (assetId?: string) => void;
  quickSetupSavedCount: number;
}) {
  return (
    <>
      <AppText color="secondary" variant="caption">
        Record new activity or add investments you already own.
      </AppText>
      {onRecordPurchase ? <AppButton title="Record purchase" testID="record-purchase-option"
        onPress={() => { onClose(); onRecordPurchase(); }} /> : null}
      {onAddTrade ? (
        <AppButton
          onPress={() => {
            onClose();
            onAddTrade();
          }}
          testID="add-one-holding-option"
          title="Add existing holding"
          variant="secondary"
        />
      ) : null}
      {onQuickSetup ? (
        <AppButton
          onPress={() => {
            onClose();
            onQuickSetup();
          }}
          testID="add-multiple-holdings-option"
          title={
            quickSetupSavedCount > 0
              ? `Continue setup (${quickSetupSavedCount} saved)`
              : "Add multiple holdings"
          }
        />
      ) : null}
      {onAddPpfAccount ? (
        <AppButton
          onPress={() => {
            onClose();
            onAddPpfAccount();
          }}
          testID="add-ppf-account"
          title="Add PPF account"
          variant="secondary"
        />
      ) : null}
      {onAddEpfAccount ? (
        <AppButton
          onPress={() => {
            onClose();
            onAddEpfAccount();
          }}
          testID="add-epf-account-option"
          title="Add EPF account"
          variant="secondary"
        />
      ) : null}
      {onImportHoldings ? (
        <AppButton
          onPress={() => {
            onClose();
            onImportHoldings();
          }}
          testID="import-holdings-csv-option"
          title="Import holdings CSV"
          variant="secondary"
        />
      ) : null}
      {onOpenFutures ? (
        <GroupedListRow
          title="Futures wallet"
          meta="Manual USDT positions · separate from holdings"
          value="›"
          testID="holdings-open-futures"
          onPress={() => { onClose(); onOpenFutures(); }}
        />
      ) : null}
      {onImportTransactions ? (
        <AppButton
          onPress={() => {
            onClose();
            onImportTransactions();
          }}
          testID="import-transactions-csv-option"
          title="Import transaction history"
          variant="secondary"
        />
      ) : null}
    </>
  );
}

/** Screen-level options: masking, valuation details, transactions and assets. */
export function HoldingsOptionsPanel({
  hasPpfAccounts,
  hasTrades,
  maskWealthValues,
  onAddPpfAccount,
  onClose,
  onManageAssets,
  onReviewAllTrades,
  onShowValuationDetails,
  toggleMaskWealthValues,
}: {
  hasPpfAccounts: boolean;
  hasTrades: boolean;
  maskWealthValues: boolean;
  onAddPpfAccount?: (legacy?: { assetId?: string; name?: string }) => void;
  onClose: () => void;
  onManageAssets?: () => void;
  onReviewAllTrades?: () => void;
  onShowValuationDetails: () => void;
  toggleMaskWealthValues: () => void;
}) {
  return (
    <>
      <AppButton
        onPress={() => {
          toggleMaskWealthValues();
          onClose();
        }}
        testID="holdings-mask-toggle"
        title={maskWealthValues ? "Show values" : "Mask values"}
        variant="secondary"
      />
      <AppButton
        onPress={onShowValuationDetails}
        testID="holdings-valuation-details-button"
        title="Valuation details"
        variant="secondary"
      />
      {onReviewAllTrades && hasTrades ? (
        <AppButton
          onPress={() => {
            onClose();
            onReviewAllTrades();
          }}
          testID="holdings-transactions-button"
          title="Transactions"
          variant="secondary"
        />
      ) : null}
      {onManageAssets ? (
        <AppButton
          onPress={() => {
            onClose();
            onManageAssets();
          }}
          testID="holdings-manage-assets-button"
          title="Manage assets"
          variant="secondary"
        />
      ) : null}
      {!hasPpfAccounts && onAddPpfAccount ? (
        <AppButton
          onPress={() => {
            onClose();
            onAddPpfAccount();
          }}
          testID="add-ppf-account"
          title="Add PPF account"
          variant="secondary"
        />
      ) : null}
    </>
  );
}

/** Quote coverage and the latest refresh outcome. */
export function ValuationDetailsPanel({
  hasMarketHoldings,
  quoteStatus,
  refresh,
  refreshIncomplete,
}: {
  hasMarketHoldings: boolean;
  quoteStatus: ReturnType<typeof getQuoteStatus>;
  refresh: () => Promise<unknown>;
  refreshIncomplete: boolean;
}) {
  return (
    <>
      <AppText weight="bold">{quoteStatus.title}</AppText>
      <AppText color="secondary" variant="caption">
        {quoteStatus.detail}
      </AppText>
      {refreshIncomplete ? (
        <AppText color="secondary" variant="caption">
          Some quote updates did not complete. Existing saved
          prices remain available when present.
        </AppText>
      ) : null}
      {hasMarketHoldings ? (
        <AppButton
          onPress={() => {
            void refresh();
          }}
          title="Refresh prices"
          variant="secondary"
        />
      ) : null}
    </>
  );
}

/** Concentration, best return and asset mix across market holdings. */
export function PortfolioInsightsPanel({
  allocationAvailable,
  distinctBestReturn,
  exposureSegments,
  onClose,
  onOpenDuration,
  summary,
}: {
  allocationAvailable: boolean;
  distinctBestReturn?: HoldingReviewItem;
  exposureSegments: ExposureSegment[];
  onClose: () => void;
  onOpenDuration?: () => void;
  summary: ReturnType<typeof getHoldingReviewSummary>;
}) {
  const styles = useStyles();
  return (
    <>
      {onOpenDuration ? (
        <AppButton
          title="Holding duration"
          variant="secondary"
          testID="holdings-duration-button"
          onPress={() => {
            onClose();
            onOpenDuration();
          }}
        />
      ) : null}
      <AppText color="secondary" variant="caption">
        Position allocation excludes cash and PPF accounts. Asset
        mix compares market holdings only.
      </AppText>
      <View style={styles.insightGrid}>
        <InsightCard
          eyebrow="Dominant position"
          title={
            allocationAvailable && summary.dominant
              ? summary.dominant.holding.asset.name
              : "Awaiting valuation"
          }
          detail={
            allocationAvailable && summary.dominant
              ? `${formatPercentage(summary.dominant.allocationPct).replace("+", "")} allocation`
              : "Allocation is unavailable while a price is missing"
          }
        />
        {distinctBestReturn ? (
          <InsightCard
            eyebrow="Best return"
            title={distinctBestReturn.holding.asset.name}
            detail={`${formatPercentage(distinctBestReturn.holding.unrealisedPnLPct ?? 0)} return`}
            positive={
              (distinctBestReturn.holding.unrealisedPnL ?? 0) >= 0
            }
          />
        ) : null}
      </View>
      {allocationAvailable && exposureSegments.length ? (
        <ExposurePanel segments={exposureSegments} />
      ) : (
        <PremiumCard>
          <AppText weight="bold">Asset mix unavailable</AppText>
          <AppText color="secondary" variant="caption">
            Allocation remains unavailable until every market
            holding has a price.
          </AppText>
        </PremiumCard>
      )}
      <PremiumCard style={styles.topThreeCard}>
        <AppText weight="bold">Top three concentration</AppText>
        <AppText color="secondary" variant="caption">
          {allocationAvailable
            ? `${formatPercentage(summary.topThreeAllocationPct).replace("+", "")} of holding value, excluding cash and PPF accounts.`
            : "Unavailable while a market holding needs a price."}
        </AppText>
      </PremiumCard>
    </>
  );
}
