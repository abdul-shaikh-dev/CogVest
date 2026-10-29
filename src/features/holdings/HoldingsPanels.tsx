import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppButton, AppText, GroupedListRow, PremiumCard, SectionHeader } from "@/src/components/common";
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

type AddOption = { meta: string; onPress: () => void; testID: string; title: string };

/**
 * Ways to add holdings: one primary action (Record purchase once Cash exists,
 * else Add existing holding), then quiet rows grouped into accounts and imports.
 */
export function AddHoldingsPanel({
  hasCash,
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
  hasCash: boolean;
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
  const option = (
    action: (() => void) | undefined,
    title: string,
    meta: string,
    testID: string,
  ): AddOption[] =>
    action ? [{ meta, onPress: () => { onClose(); action(); }, testID, title }] : [];
  const recordPurchase = option(
    onRecordPurchase && (() => onRecordPurchase()),
    "Record purchase",
    "Buy more, funded from Cash",
    "record-purchase-option",
  );
  const addExisting = option(onAddTrade, "Add existing holding", "One position you already own", "add-one-holding-option");
  const [primary, ...firstRows] = hasCash && recordPurchase.length
    ? [...recordPurchase, ...addExisting]
    : [...addExisting, ...recordPurchase];
  const quickSetup = option(
    onQuickSetup,
    quickSetupSavedCount > 0 ? `Continue setup (${quickSetupSavedCount} saved)` : "Add multiple holdings",
    "Set up several at once",
    "add-multiple-holdings-option",
  );
  const groups = [
    { rows: [...firstRows, ...quickSetup] },
    {
      rows: [
        ...option(onAddPpfAccount && (() => onAddPpfAccount()), "PPF account", "Public Provident Fund balance", "add-ppf-account"),
        ...option(onAddEpfAccount, "EPF account", "Employees' Provident Fund", "add-epf-account-option"),
        ...option(onOpenFutures, "Futures wallet", "Manual USDT positions · separate from holdings", "holdings-open-futures"),
      ],
      title: "Add an account",
    },
    {
      rows: [
        ...option(onImportHoldings, "Holdings CSV", "Current positions from a spreadsheet", "import-holdings-csv-option"),
        ...option(onImportTransactions, "Transaction history", "Zerodha tradebook, CAS or CSV", "import-transactions-csv-option"),
      ],
      title: "Import",
    },
  ];

  const styles = useStyles();
  return (
    <>
      {primary ? <AppButton onPress={primary.onPress} testID={primary.testID} title={primary.title} /> : null}
      {groups.map((group) => group.rows.length ? (
        <View key={group.title ?? "start"} style={styles.addOptionGroup}>
          {group.title ? <SectionHeader title={group.title} /> : null}
          {group.rows.map((row) => (
            <GroupedListRow
              key={row.testID}
              meta={row.meta}
              onPress={row.onPress}
              showChevron
              testID={row.testID}
              title={row.title}
            />
          ))}
        </View>
      ) : null)}
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
