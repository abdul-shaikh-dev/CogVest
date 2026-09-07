import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  CategoryIcon,
  EmptyState,
  IconButton,
  MaskedValue,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  androidRipple,
  assetClassLabel,
  getPressedStateStyle,
  minimumTouchTargetStyle,
} from "@/src/components/common";
import { FormTextField } from "@/src/components/forms";
import { useReducedMotionPreference } from "@/src/hooks";
import {
  instrumentTypeLabel,
  sectorTypeLabel,
} from "@/src/domain/assets";
import {
  formatCompactINR,
  formatDate,
  formatPercentage,
} from "@/src/domain/formatters";
import type {
  QuoteFreshnessSummary,
  QuoteRefreshResult,
  RefreshQuotesInput,
} from "@/src/services/quotes";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, interaction, radii, spacing } from "@/src/theme";
import type { OpeningPosition, Trade } from "@/src/types";

import {
  createHoldingReviewItems,
  filterHoldingReviewItems,
  getExposureSegments,
  getHoldingReviewSummary,
  type ExposureSegment,
  type HoldingFilter,
  type HoldingReviewItem,
} from "./holdingsReview";
import { useHoldings } from "./useHoldings";

type RefreshQuotes = (
  input: RefreshQuotesInput,
) => Promise<QuoteRefreshResult>;

type HoldingsScreenProps = {
  onOpenDuration?: () => void;
  now?: Date;
  onAddTrade?: () => void;
  onAddPpfAccount?: (legacy?: { assetId?: string; name?: string }) => void;
  onImportHoldings?: () => void;
  onImportTransactions?: () => void;
  onManageAssets?: () => void;
  onReviewAllTrades?: () => void;
  onReviewOpeningPosition?: (openingPositionId: string) => void;
  onReviewPpfAccount?: (accountId: string) => void;
  onReviewTrades?: (assetId: string) => void;
  onSellRedeem?: (assetId: string) => void;
  onQuickSetup?: () => void;
  quickSetupSavedCount?: number;
  statusMessage?: string;
  refreshQuotes?: RefreshQuotes;
  store?: StoreApi<PortfolioStoreState>;
};

const filterOrder: HoldingFilter[] = [
  "all",
  "winners",
  "losers",
  "high-allocation",
];

const exposureColors: Record<ExposureSegment["color"], string> = {
  amber: colors.cryptoAmber,
  blue: colors.blue,
  green: colors.primary,
};

export function HoldingsScreen({
  onOpenDuration,
  now,
  onAddTrade,
  onAddPpfAccount,
  onImportHoldings,
  onImportTransactions,
  onManageAssets,
  onReviewAllTrades,
  onReviewOpeningPosition,
  onReviewPpfAccount,
  onReviewTrades,
  onSellRedeem,
  onQuickSetup,
  quickSetupSavedCount = 0,
  refreshQuotes,
  statusMessage,
  store = getPortfolioStore(),
}: HoldingsScreenProps) {
  const insets = useSafeAreaInsets();
  const [activePanel, setActivePanel] = useState<"add" | "insights" | "more" | "quotes">();
  const [selectedDestination, setSelectedDestination] = useState<"market" | "ppf">("market");
  const {
    displayMode,
    failed,
    holdings,
    isRefreshing,
    maskWealthValues,
    openingPositions,
    ppfSummary,
    quoteFreshness,
    refresh,
    rollupRows,
    rollupTotals,
    timedOut,
    toggleMaskWealthValues,
    trades,
  } = useHoldings({
    now,
    refreshQuotes,
    store,
  });
  const isMinimalMode = displayMode === "minimal";
  const isReducedMotionEnabled = useReducedMotionPreference();
  const [selectedFilter, setSelectedFilter] = useState<HoldingFilter>("all");
  const [expandedAssetId, setExpandedAssetId] = useState<string>();
  const [searchQuery, setSearchQuery] = useState("");
  const reviewItems = createHoldingReviewItems(holdings, rollupRows);
  const marketReviewItems = reviewItems.filter(
    (item) => item.holding.asset.instrumentType !== "ppf",
  );
  const marketHoldings = marketReviewItems.map((item) => item.holding);
  const legacyPpfHoldings = holdings.filter(
    (holding) => holding.asset.instrumentType === "ppf",
  );
  const ppfRecordCount = ppfSummary.accounts.length + legacyPpfHoldings.length;
  const hasMarketHoldings = marketHoldings.length > 0;
  const hasPpfDestination =
    ppfSummary.accounts.length > 0 || legacyPpfHoldings.length > 0;
  const activeDestination = hasMarketHoldings
    ? hasPpfDestination
      ? selectedDestination
      : "market"
    : "ppf";
  const allocationAvailable =
    rollupTotals.valuationCoverage.status === "complete";
  const effectiveFilter =
    !allocationAvailable && selectedFilter === "high-allocation"
      ? "all"
      : selectedFilter;
  const visibleItems = filterHoldingReviewItems(
    marketReviewItems,
    effectiveFilter,
    searchQuery,
  );
  const summary = getHoldingReviewSummary(marketReviewItems);
  const distinctBestReturn =
    summary.bestReturn?.holding.asset.id === summary.dominant?.holding.asset.id
      ? undefined
      : summary.bestReturn;
  const exposureSegments = getExposureSegments(marketReviewItems);
  const filterCounts = getFilterCounts(marketReviewItems, allocationAvailable);
  const subtitle = `${marketHoldings.length} market ${marketHoldings.length === 1 ? "position" : "positions"} • ${ppfSummary.accounts.length} PPF ${ppfSummary.accounts.length === 1 ? "account" : "accounts"}`;
  const quoteStatus = getQuoteStatus({
    failed: failed.length,
    isRefreshing,
    quoteFreshness,
    timedOut: timedOut.length,
  });
  const pendingValuations = rollupTotals.valuationCoverage.pendingHoldings;

  function renderHoldingRow(item: HoldingReviewItem) {
    return (
      <HoldingRow
        allocationAvailable={allocationAvailable}
        expanded={expandedAssetId === item.holding.asset.id}
        item={item}
        key={item.holding.asset.id}
        masked={maskWealthValues}
        minimal={isMinimalMode}
        openingPositions={openingPositions.filter(
          (position) => position.assetId === item.holding.asset.id,
        )}
        onReviewOpeningPosition={onReviewOpeningPosition}
        onReviewTrades={onReviewTrades}
        onSellRedeem={onSellRedeem}
        trades={trades.filter((trade) => trade.assetId === item.holding.asset.id)}
        onPress={() =>
          setExpandedAssetId((current) =>
            current === item.holding.asset.id ? undefined : item.holding.asset.id,
          )
        }
      />
    );
  }

  return (
    <ScreenContainer
      refreshControl={
        holdings.length > 0 ? (
          <RefreshControl
            refreshing={isRefreshing}
            tintColor={colors.primary}
            onRefresh={() => refresh()}
          />
        ) : undefined
      }
      scroll
      testID="holdings-screen"
    >
      <View style={styles.content}>
        <ScreenHeader
          title="Holdings"
          subtitle={subtitle}
          action={
            <>
              {onAddTrade || onAddPpfAccount ? (
                <IconButton
                  accessibilityLabel={onQuickSetup ? "Add holdings" : "Add Holding"}
                  icon="add-outline"
                  onPress={() => setActivePanel("add")}
                  testID="holdings-add-button"
                />
              ) : null}
              <AppButton
                accessibilityLabel="More holdings options"
                onPress={() => setActivePanel("more")}
                testID="holdings-more-button"
                title="More"
                variant="secondary"
              />
            </>
          }
        />

        {statusMessage ? (
          <View
            accessibilityLiveRegion="polite"
            testID="holdings-status-message"
          >
            <PremiumCard style={styles.statusCard}>
              <AppText style={styles.positiveText} weight="bold">
                {statusMessage}
              </AppText>
            </PremiumCard>
          </View>
        ) : null}

        {hasMarketHoldings && activeDestination === "market" ? (
          <FormTextField
            label="Search"
            onChangeText={setSearchQuery}
            placeholder="Search name, symbol, sector..."
            testID="holdings-search-input"
            value={searchQuery}
          />
        ) : null}

        {quickSetupSavedCount > 0 &&
        onQuickSetup &&
        (holdings.length > 0 || ppfSummary.accounts.length > 0) ? (
          <View style={styles.resumeRow} testID="holdings-continue-setup">
            <View style={styles.flex}>
              <AppText weight="bold">Resume setup</AppText>
              <AppText color="secondary" variant="caption">
                {quickSetupSavedCount} saved locally.
              </AppText>
            </View>
            <AppButton
              onPress={onQuickSetup}
              testID="holdings-continue-setup-button"
              title="Resume"
              variant="secondary"
            />
          </View>
        ) : null}

        {hasMarketHoldings &&
        activeDestination === "market" &&
        pendingValuations === 0 ? (
          <View
            accessibilityLiveRegion={quoteStatus.prominent ? "polite" : "none"}
            style={[
              styles.quoteStatus,
              quoteStatus.prominent && styles.quoteStatusProminent,
            ]}
            testID="holdings-quote-health"
          >
            <CategoryIcon assetClass="neutral" size={18} />
            <View style={styles.quoteStatusCopy}>
              <AppText
                style={quoteStatus.prominent ? styles.warningText : undefined}
                variant="caption"
                weight="bold"
              >
                {quoteStatus.title}
              </AppText>
            </View>
            <AppButton
              onPress={() => setActivePanel("quotes")}
              style={styles.quoteDetailsAction}
              title="Details"
              variant="ghost"
            />
          </View>
        ) : null}

        {activeDestination === "market" && pendingValuations > 0 ? (
          <View style={styles.pendingValuationRow} testID="holdings-pending-valuations">
            <View style={styles.flex}>
              <AppText weight="bold">
                {pendingValuations} valuation{pendingValuations === 1 ? "" : "s"} pending
              </AppText>
              <AppText color="secondary" variant="caption">
                Invested values remain available; totals, returns, and allocation are unavailable.
              </AppText>
            </View>
            <AppButton
              title="Refresh prices"
              testID="holdings-refresh-pending-prices"
              onPress={() => {
                void refresh();
              }}
            />
          </View>
        ) : null}

        {hasMarketHoldings && hasPpfDestination ? (
          <View accessibilityRole="tablist" style={styles.destinationTabs}>
            <DestinationTab
              active={activeDestination === "market"}
              label={`Market ${marketHoldings.length}`}
              onPress={() => setSelectedDestination("market")}
              testID="holdings-market-tab"
            />
            <DestinationTab
              active={activeDestination === "ppf"}
              label={`PPF ${ppfRecordCount}`}
              onPress={() => setSelectedDestination("ppf")}
              testID="holdings-ppf-tab"
            />
          </View>
        ) : null}

        {activeDestination === "ppf" && hasPpfDestination ? (
          <View style={styles.ppfSection} testID="holdings-ppf-section">
          <View style={styles.sectionActionHeader}>
            <SectionHeader title="PPF accounts" />
            {onAddPpfAccount ? (
              <AppButton
                onPress={() => onAddPpfAccount()}
                testID="add-ppf-account"
                title="Add account"
                variant="secondary"
              />
            ) : null}
          </View>
          {ppfSummary.accounts.map((item) => (
              <Pressable
                accessibilityLabel={`Open ${item.account.nickname}`}
                accessibilityRole="button"
                key={item.account.id}
                onPress={() => onReviewPpfAccount?.(item.account.id)}
                style={({ pressed }) => [
                  styles.ppfAccountCard,
                  getPressedStateStyle({ pressed }),
                ]}
                testID={`ppf-account-${item.account.id}`}
              >
                <CategoryIcon assetClass="debt" size={22} />
                <View style={styles.flex}>
                  <AppText weight="bold">{item.account.nickname}</AppText>
                  <AppText color="secondary" variant="caption">
                    {item.account.provider} • {maskWealthValues
                      ? "Contribution details hidden"
                      : item.contributionContext.financialYearContributions > 0
                        ? `${formatCompactINR(item.contributionContext.financialYearContributions)} contributed this FY`
                        : "No contribution recorded this FY"}
                  </AppText>
                </View>
                <View style={styles.ppfValue}>
                  <MaskedValue
                    masked={maskWealthValues}
                    value={formatCompactINR(item.confirmedBalance)}
                    weight="bold"
                  />
                  <AppText color="secondary" variant="caption">Confirmed</AppText>
                </View>
              </Pressable>
            ))}
          {legacyPpfHoldings.map((holding) => (
            <PremiumCard elevated key={holding.asset.id} testID={`legacy-ppf-${holding.asset.id}`}>
              <AppText weight="bold">Move {holding.asset.name} to the PPF ledger</AppText>
              <AppText color="secondary" variant="caption">
                This older holding uses market-style fields. Linking it preserves the original record for audit and replaces it in portfolio totals with the confirmed account balance.
              </AppText>
              {onAddPpfAccount ? (
                <AppButton
                onPress={() =>
                  onAddPpfAccount({
                    assetId: holding.asset.id,
                    name: holding.asset.name,
                  })
                }
                  testID={`convert-legacy-ppf-${holding.asset.id}`}
                  title="Set up PPF account"
                  variant="secondary"
                />
              ) : null}
            </PremiumCard>
          ))}
          {reviewItems
            .filter((item) => item.holding.asset.instrumentType === "ppf")
            .map(renderHoldingRow)}
          </View>
        ) : null}

        {!hasMarketHoldings && !hasPpfDestination ? (
          <EmptyState
            actionLabel={
              onQuickSetup
                ? quickSetupSavedCount > 0
                  ? "Continue portfolio setup"
                  : "Set up your portfolio"
                : onAddTrade
                  ? "Add Holding"
                  : undefined
            }
            actionTestID={onQuickSetup ? "quick-setup-button" : "add-trade-button"}
            message={
              quickSetupSavedCount > 0
                ? `${quickSetupSavedCount} confirmed ${quickSetupSavedCount === 1 ? "holding is" : "holdings are"} saved locally.`
                : onQuickSetup
                  ? "Add existing holdings in one focused setup, or record a single holding."
                  : "Holdings are created automatically from your portfolio entries."
            }
            title="No holdings yet"
            onAction={onQuickSetup ?? onAddTrade}
            onSecondaryAction={onQuickSetup ? onAddTrade : undefined}
            secondaryActionLabel={onQuickSetup ? "Add one holding" : undefined}
            secondaryActionTestID="add-trade-button"
          />
        ) : activeDestination === "market" ? (
          <>
            <FilterRow
              allocationAvailable={allocationAvailable}
              counts={filterCounts}
              onSelect={(filter) => {
                if (filter !== "high-allocation" || allocationAvailable) {
                  setSelectedFilter(filter);
                }
              }}
              selected={effectiveFilter}
            />

            {!isMinimalMode ? (
              <AppButton
                onPress={() => setActivePanel("insights")}
                style={styles.insightsAction}
                testID="holdings-insights-button"
                title="Portfolio insights"
                textColor="secondary"
                variant="ghost"
              />
            ) : null}

            {visibleItems.length === 0 ? (
              <EmptyState
                message="Try another search or review filter."
                title="No holdings match"
              />
            ) : (
              <View style={styles.holdingsList} testID="holdings-list">
                {visibleItems.map(renderHoldingRow)}
              </View>
            )}
          </>
        ) : null}

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
                  {
                    activePanel === "add"
                      ? "Add holdings"
                      : activePanel === "more"
                        ? "Holdings options"
                        : activePanel === "quotes"
                          ? "Valuation details"
                          : "Portfolio insights"
                  }
                </AppText>
                <AppButton
                  onPress={() => setActivePanel(undefined)}
                  testID="holdings-panel-close"
                  title="Close"
                  variant="ghost"
                />
              </View>
              <ScrollView contentContainerStyle={styles.panelContent}>
                {activePanel === "add" ? (
                  <>
                    <AppText color="secondary" variant="caption">
                      Choose a focused single entry, a setup path, or an import.
                    </AppText>
                    {onAddTrade ? (
                      <AppButton
                        onPress={() => {
                          setActivePanel(undefined);
                          onAddTrade();
                        }}
                        testID="add-one-holding-option"
                        title="Add one holding"
                        variant="secondary"
                      />
                    ) : null}
                    {onQuickSetup ? (
                      <AppButton
                        onPress={() => {
                          setActivePanel(undefined);
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
                          setActivePanel(undefined);
                          onAddPpfAccount();
                        }}
                        testID="add-ppf-account"
                        title="Add PPF account"
                        variant="secondary"
                      />
                    ) : null}
                    {onImportHoldings ? (
                      <AppButton
                        onPress={() => {
                          setActivePanel(undefined);
                          onImportHoldings();
                        }}
                        testID="import-holdings-csv-option"
                        title="Import holdings CSV"
                        variant="secondary"
                      />
                    ) : null}
                    {onImportTransactions ? (
                      <AppButton
                        onPress={() => {
                          setActivePanel(undefined);
                          onImportTransactions();
                        }}
                        testID="import-transactions-csv-option"
                        title="Import transaction history"
                        variant="secondary"
                      />
                    ) : null}
                  </>
                ) : null}

                {activePanel === "more" ? (
                  <>
                    <AppButton
                      onPress={() => {
                        toggleMaskWealthValues();
                        setActivePanel(undefined);
                      }}
                      testID="holdings-mask-toggle"
                      title={maskWealthValues ? "Show values" : "Mask values"}
                      variant="secondary"
                    />
                    <AppButton
                      onPress={() => setActivePanel("quotes")}
                      testID="holdings-valuation-details-button"
                      title="Valuation details"
                      variant="secondary"
                    />
                    {onReviewAllTrades && trades.length > 0 ? (
                      <AppButton
                        onPress={() => {
                          setActivePanel(undefined);
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
                          setActivePanel(undefined);
                          onManageAssets();
                        }}
                        testID="holdings-manage-assets-button"
                        title="Manage assets"
                        variant="secondary"
                      />
                    ) : null}
                    {!ppfSummary.accounts.length && onAddPpfAccount ? (
                      <AppButton
                        onPress={() => {
                          setActivePanel(undefined);
                          onAddPpfAccount();
                        }}
                        testID="add-ppf-account"
                        title="Add PPF account"
                        variant="secondary"
                      />
                    ) : null}
                  </>
                ) : null}

                {activePanel === "quotes" ? (
                  <>
                    <AppText weight="bold">{quoteStatus.title}</AppText>
                    <AppText color="secondary" variant="caption">
                      {quoteStatus.detail}
                    </AppText>
                    {(failed.length > 0 || timedOut.length > 0) ? (
                      <AppText color="secondary" variant="caption">
                        Some quote updates did not complete. Existing saved prices remain available when present.
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
                ) : null}

                {activePanel === "insights" ? (
                  <>
                    {onOpenDuration ? (
                      <AppButton
                        title="Holding duration"
                        variant="secondary"
                        testID="holdings-duration-button"
                        onPress={() => {
                          setActivePanel(undefined);
                          onOpenDuration();
                        }}
                      />
                    ) : null}
                    <AppText color="secondary" variant="caption">
                      Position allocation excludes cash and PPF accounts. Asset mix compares market holdings only.
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
                          positive={(distinctBestReturn.holding.unrealisedPnL ?? 0) >= 0}
                        />
                      ) : null}
                    </View>
                    {allocationAvailable && exposureSegments.length ? (
                      <ExposurePanel segments={exposureSegments} />
                    ) : (
                      <PremiumCard>
                        <AppText weight="bold">Asset mix unavailable</AppText>
                        <AppText color="secondary" variant="caption">
                          Allocation remains unavailable until every market holding has a price.
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
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </ScreenContainer>
  );
}

function getQuoteStatus({
  failed,
  isRefreshing,
  quoteFreshness,
  timedOut,
}: {
  failed: number;
  isRefreshing: boolean;
  quoteFreshness: QuoteFreshnessSummary;
  timedOut: number;
}) {
  const counts = `Current ${quoteFreshness.current} · Stale ${quoteFreshness.stale} · Manual ${quoteFreshness.manual} · Missing ${quoteFreshness.missing}`;

  if (isRefreshing) {
    return {
      detail: counts,
      prominent: false,
      title: "Refreshing quotes...",
    };
  }

  if (failed > 0 || timedOut > 0) {
    const outcomes = [
      failed > 0 ? `${failed} failed` : "",
      timedOut > 0 ? `${timedOut} timed out` : "",
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
      detail: "Quote coverage appears after your first holding.",
      prominent: false,
      title: "No holdings to price",
    };
  }

  const prominent = quoteFreshness.missing > 0;
  const title = prominent
    ? "Price coverage needs attention"
    : quoteFreshness.status === "current"
      ? "Prices up to date"
      : "Using saved prices";

  return {
    detail: counts,
    prominent,
    title,
  };
}

function InsightCard({
  detail,
  eyebrow,
  positive,
  title,
}: {
  detail: string;
  eyebrow: string;
  positive?: boolean;
  title: string;
}) {
  return (
    <PremiumCard style={styles.insightCard}>
      <AppText color="secondary" variant="caption" weight="medium">
        {eyebrow}
      </AppText>
      <AppText numberOfLines={2} style={styles.insightTitle} weight="bold">
        {title}
      </AppText>
      <AppText
        color="secondary"
        style={positive === false ? styles.negativeText : undefined}
        variant="caption"
      >
        {detail}
      </AppText>
    </PremiumCard>
  );
}

function ExposurePanel({
  segments,
}: {
  segments: ExposureSegment[];
}) {
  return (
    <PremiumCard style={styles.exposureCard}>
      <View style={styles.sectionHeading}>
        <View style={styles.sectionHeadingCopy}>
          <AppText weight="bold">Asset mix</AppText>
          <AppText color="secondary" variant="caption">
            Portfolio split by asset class
          </AppText>
        </View>
      </View>

      <View style={styles.exposureRail}>
        {segments.map((segment) => (
          <View
            key={segment.key}
            style={[
              styles.exposureSegment,
              {
                backgroundColor: exposureColors[segment.color],
                flex: Math.max(segment.percentage, 1),
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.exposureLegend}>
        {segments.map((segment) => (
          <View key={segment.key} style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: exposureColors[segment.color] },
              ]}
            />
            <View style={styles.legendCopy}>
              <AppText variant="caption" weight="bold">
                {segment.label} {segment.percentage.toFixed(0)}%
              </AppText>
            </View>
          </View>
        ))}
      </View>
    </PremiumCard>
  );
}

function DestinationTab({
  active,
  label,
  onPress,
  testID,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      android_ripple={androidRipple(
        active ? interaction.primaryRippleColor : interaction.rippleColor,
      )}
      onPress={onPress}
      style={({ pressed }) => [
        styles.destinationTab,
        active && styles.destinationTabActive,
        getPressedStateStyle({ pressed }),
      ]}
      testID={testID}
    >
      <AppText color={active ? "primary" : "secondary"} weight="bold">
        {label}
      </AppText>
    </Pressable>
  );
}

function FilterRow({
  allocationAvailable,
  counts,
  onSelect,
  selected,
}: {
  allocationAvailable: boolean;
  counts: Record<HoldingFilter, number>;
  onSelect: (filter: HoldingFilter) => void;
  selected: HoldingFilter;
}) {
  return (
    <View style={styles.filters}>
      {filterOrder.map((filter) => {
        const active = selected === filter;
        const disabled = filter === "high-allocation" && !allocationAvailable;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled, selected: active }}
            android_ripple={androidRipple(
              active
                ? interaction.primaryRippleColor
                : interaction.rippleColor,
            )}
            key={filter}
            onPress={() => onSelect(filter)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.filterChip,
              minimumTouchTargetStyle,
              active && styles.filterChipActive,
              getPressedStateStyle({ pressed }),
            ]}
            testID={`holdings-filter-${filter}`}
          >
            <AppText
              color={active ? "inverse" : "secondary"}
              variant="caption"
              weight="bold"
            >
              {getFilterLabel(filter)} {counts[filter]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function HoldingRow({
  allocationAvailable,
  expanded,
  item,
  masked,
  minimal,
  openingPositions,
  onPress,
  onReviewOpeningPosition,
  onReviewTrades,
  onSellRedeem,
  trades,
}: {
  allocationAvailable: boolean;
  expanded: boolean;
  item: HoldingReviewItem;
  masked: boolean;
  minimal: boolean;
  openingPositions: OpeningPosition[];
  onPress: () => void;
  onReviewOpeningPosition?: (openingPositionId: string) => void;
  onReviewTrades?: (assetId: string) => void;
  onSellRedeem?: (assetId: string) => void;
  trades: Trade[];
}) {
  const { holding } = item;
  const isPending = holding.valuation.status === "pending";
  const positive = (holding.unrealisedPnL ?? 0) >= 0;

  return (
    <Pressable
      accessibilityHint={expanded ? "Collapses position details" : "Shows position details"}
      accessibilityLabel={
        isPending
          ? `${holding.asset.name}, valuation pending, invested ${formatCompactINR(holding.totalInvested)}`
          : `${holding.asset.name}, ${formatPercentage(holding.unrealisedPnLPct ?? 0)} return`
      }
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      android_ripple={androidRipple()}
      onPress={onPress}
      style={({ pressed }) => [
        styles.holdingCard,
        getPressedStateStyle({ pressed }),
      ]}
      testID={`holding-row-${holding.asset.id}`}
    >
      <View style={styles.compactRow}>
        <View style={styles.assetIcon}>
          <CategoryIcon assetClass={holding.asset.assetClass} size={22} />
        </View>
        <View style={styles.assetCopy}>
          <AppText numberOfLines={1} weight="bold">
            {holding.asset.name}
          </AppText>
          <AppText color="secondary" numberOfLines={1} variant="caption">
            {formatClassification(item)}
          </AppText>
        </View>
        <View style={styles.valueColumn}>
          <MaskedValue
            align="right"
            masked={masked && !isPending && holding.currentValue !== null}
            value={
              isPending || holding.currentValue === null
                ? "Valuation pending"
                : formatCompactINR(holding.currentValue)
            }
            weight="bold"
          />
          {!isPending && holding.unrealisedPnLPct !== null ? (
          <AppText
            align="right"
            color={minimal ? "secondary" : undefined}
            style={
              minimal
                ? undefined
                : positive
                  ? styles.positiveText
                  : styles.negativeText
            }
            variant="caption"
            weight={minimal ? "medium" : "bold"}
          >
            {formatPercentage(holding.unrealisedPnLPct)}
          </AppText>
          ) : null}
        </View>
        <Ionicons
          color={colors.text.secondary}
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
        />
      </View>

      <View style={styles.compactMeta}>
        <MaskedValue
          color="secondary"
          masked={masked}
          value={`Invested ${formatCompactINR(holding.totalInvested)}`}
          variant="caption"
        />
        <AppText color="secondary" variant="caption">
          {!allocationAvailable || isPending ? "Allocation unavailable" : `Alloc. ${item.allocationPct.toFixed(2)}%`}
        </AppText>
      </View>

      {expanded ? (
        <View
          style={styles.expandedSection}
          testID={`holding-expanded-${holding.asset.id}`}
        >
          <View style={styles.detailGrid}>
            <Detail
              label="Quantity"
              testID={`holding-quantity-${holding.asset.id}`}
              value={formatQuantity(holding.totalUnits)}
            />
            <Detail
              label="Avg cost"
              value={formatCompactINR(holding.averageCostPrice)}
            />
            <Detail
              label="Current price"
              value={
                holding.currentPrice === null
                  ? "Unavailable"
                  : formatCompactINR(holding.currentPrice)
              }
            />
            <Detail
              label="P&L"
              masked={masked && holding.unrealisedPnL !== null}
              subdued={minimal}
              tone={minimal ? undefined : positive ? "positive" : "negative"}
              value={
                holding.unrealisedPnL === null
                  ? "Unavailable"
                  : formatSignedCompactINR(holding.unrealisedPnL)
              }
            />
          </View>

          {allocationAvailable && !isPending ? (
          <View style={styles.allocationBlock}>
            <View style={styles.allocationHeading}>
              <AppText color="secondary" variant="caption">
                Current allocation
              </AppText>
              <AppText variant="caption" weight="bold">
                {item.allocationPct.toFixed(2)}%
              </AppText>
            </View>
            <View style={styles.allocationRail}>
              <View
                style={[
                  styles.allocationFill,
                  { width: `${Math.min(100, Math.max(0, item.allocationPct))}%` },
                ]}
              />
            </View>
          </View>
          ) : null}

          <View style={styles.sourceRow}>
            <View>
              <AppText color="secondary" variant="caption">
                Price source
              </AppText>
              <AppText variant="caption" weight="bold">
                {isPending ? "Valuation pending" : formatSource(holding.quoteSource)}
              </AppText>
            </View>
            <AppText color="secondary" align="right" variant="caption">
              {isPending
                ? "Refresh or enter manually"
                : holding.lastUpdated
                ? `Updated ${formatDate(holding.lastUpdated)}`
                : "Local position price"}
            </AppText>
          </View>

          {isPending && onReviewOpeningPosition && openingPositions[0] ? (
            <AppButton
              title="Enter manual price"
              variant="secondary"
              testID={`holding-enter-manual-price-${holding.asset.id}`}
              onPress={() => onReviewOpeningPosition(openingPositions[0].id)}
            />
          ) : null}

          {onReviewOpeningPosition && openingPositions.length > 0 ? (
            <View style={styles.openingRecords}>
              <AppText color="secondary" variant="caption" weight="bold">
                Opening {openingPositions.length === 1 ? "record" : "records"}
              </AppText>
              {openingPositions.map((position) => (
                <View key={position.id} style={styles.openingRecordRow}>
                  <View style={styles.openingRecordCopy}>
                    <AppText variant="caption" weight="bold">
                      {position.date === null
                        ? "First purchase date unknown"
                        : formatDate(position.date)}
                    </AppText>
                    <AppText color="secondary" variant="caption">
                      {formatQuantity(position.quantity)} units · avg{" "}
                      {formatCompactINR(position.averageCostPrice)}
                    </AppText>
                  </View>
                  <AppButton
                    title="Review"
                    variant="secondary"
                    testID={`review-opening-position-${position.id}`}
                    onPress={() => onReviewOpeningPosition(position.id)}
                  />
                </View>
              ))}
            </View>
          ) : null}

          {onReviewTrades && trades.length > 0 ? (
            <AppButton
              title={`Review ${trades.length} ${trades.length === 1 ? "transaction" : "transactions"}`}
              variant="secondary"
              testID={`review-transactions-${holding.asset.id}`}
              onPress={() => onReviewTrades(holding.asset.id)}
            />
          ) : null}

          {onSellRedeem ? (
            <AppButton
              title="Sell / redeem"
              variant="secondary"
              testID={`holding-sell-redeem-${holding.asset.id}`}
              onPress={() => onSellRedeem(holding.asset.id)}
            />
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function Detail({
  label,
  masked,
  subdued,
  testID,
  tone,
  value,
}: {
  label: string;
  masked?: boolean;
  subdued?: boolean;
  testID?: string;
  tone?: "negative" | "positive";
  value: string;
}) {
  return (
    <View style={styles.detail} testID={testID}>
      <AppText color="secondary" variant="caption">
        {label}
      </AppText>
      <MaskedValue
        color={subdued ? "secondary" : undefined}
        masked={masked}
        style={
          tone === "positive"
            ? styles.positiveText
            : tone === "negative"
              ? styles.negativeText
              : undefined
        }
        value={value}
        variant="caption"
        weight={subdued ? "medium" : "bold"}
      />
    </View>
  );
}

function getFilterCounts(
  items: HoldingReviewItem[],
  allocationAvailable: boolean,
) {
  return {
    all: items.length,
    "high-allocation": allocationAvailable
      ? items.filter((item) => item.allocationPct >= 10).length
      : 0,
    losers: items.filter(
      (item) =>
        item.holding.unrealisedPnL !== null && item.holding.unrealisedPnL < 0,
    ).length,
    winners: items.filter(
      (item) =>
        item.holding.unrealisedPnL !== null && item.holding.unrealisedPnL >= 0,
    ).length,
  };
}

function getFilterLabel(filter: HoldingFilter) {
  if (filter === "high-allocation") {
    return "High alloc.";
  }

  return filter.charAt(0).toUpperCase() + filter.slice(1);
}

function formatClassification(item: HoldingReviewItem) {
  return [
    assetClassLabel(item.holding.asset.assetClass),
    instrumentTypeLabel(item.holding.asset.instrumentType ?? "other"),
    sectorTypeLabel(item.holding.asset.sectorType ?? "other"),
  ].join(" · ");
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(4).replace(/0+$/, "");
}

function formatSignedCompactINR(value: number) {
  const amount = formatCompactINR(value);

  return value > 0 ? `+${amount}` : amount;
}

function formatSource(source?: string) {
  if (!source) {
    return "Manual";
  }

  return source.charAt(0).toUpperCase() + source.slice(1);
}

const styles = StyleSheet.create({
  allocationBlock: {
    gap: spacing.sm,
  },
  allocationFill: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: "100%",
  },
  allocationHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  allocationRail: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.pill,
    height: 6,
    overflow: "hidden",
  },
  assetCopy: {
    flex: 1,
    gap: 2,
  },
  assetIcon: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.pill,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  compactMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingLeft: 50,
  },
  compactRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  content: {
    gap: spacing.cardGap,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  destinationTab: {
    alignItems: "center",
    borderBottomColor: "transparent",
    borderBottomWidth: 2,
    flex: 1,
    justifyContent: "center",
    minHeight: interaction.minimumTouchTarget,
  },
  destinationTabActive: {
    borderBottomColor: colors.primary,
  },
  destinationTabs: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  detail: {
    flexBasis: "45%",
    flexGrow: 1,
    gap: 2,
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  expandedSection: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  exposureCard: {
    gap: spacing.sm,
  },
  exposureLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: spacing.md,
    rowGap: spacing.sm,
  },
  exposureRail: {
    borderRadius: radii.pill,
    flexDirection: "row",
    height: 10,
    overflow: "hidden",
  },
  exposureSegment: {
    height: "100%",
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: colors.surface.card,
    borderRadius: radii.pill,
    justifyContent: "center",
    paddingHorizontal: spacing.cardInner,
    paddingVertical: spacing.xs,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  holdingCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.card,
    gap: spacing.sm,
    overflow: "hidden",
    padding: spacing.cardInner,
  },
  holdingsList: {
    gap: spacing.sm,
  },
  insightCard: {
    flex: 1,
    gap: spacing.xs,
    minHeight: 88,
  },
  insightGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  insightsAction: {
    alignSelf: "flex-start",
    paddingHorizontal: 0,
  },
  insightTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  legendCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  legendDot: {
    borderRadius: radii.pill,
    height: 8,
    marginTop: 4,
    width: 8,
  },
  legendItem: {
    alignItems: "flex-start",
    flexBasis: "46%",
    flexGrow: 1,
    flexDirection: "row",
    gap: spacing.xs,
    minWidth: 144,
  },
  negativeText: {
    color: colors.loss,
  },
  openingRecordCopy: {
    flex: 1,
    gap: 2,
  },
  openingRecordRow: {
    alignItems: "center",
    borderTopColor: colors.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  openingRecords: {
    gap: spacing.sm,
  },
  positiveText: {
    color: colors.profit,
  },
  ppfAccountCard: {
    alignItems: "center",
    backgroundColor: colors.surface.card,
    borderRadius: radii.card,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.cardInner,
  },
  ppfEmptyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  ppfSection: {
    gap: spacing.sm,
  },
  ppfValue: {
    alignItems: "flex-end",
  },
  pendingValuationRow: {
    alignItems: "center",
    backgroundColor: colors.surface.card,
    borderRadius: radii.button,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  panelBackdrop: {
    backgroundColor: "rgba(0,0,0,0.72)",
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: spacing.md,
  },
  panelContent: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  panelHeader: {
    alignItems: "center",
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: spacing.sm,
  },
  panelTitle: {
    flex: 1,
    minWidth: 0,
  },
  panelSheet: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.sheet,
    gap: spacing.md,
    maxHeight: "90%",
    padding: spacing.md,
  },
  quoteStatus: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  quoteStatusCopy: {
    flex: 1,
    gap: 2,
  },
  quoteStatusProminent: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.card,
    padding: spacing.cardInner,
  },
  quoteDetailsAction: {
    paddingHorizontal: spacing.xs,
  },
  recordAction: {
    flexGrow: 0,
  },
  recordActions: {
    alignSelf: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  resumeRow: {
    alignItems: "center",
    backgroundColor: colors.surface.card,
    borderRadius: radii.button,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  sectionHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionActionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionHeadingCopy: {
    gap: 2,
  },
  sourceRow: {
    alignItems: "flex-end",
    borderTopColor: colors.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.md,
  },
  statusCard: {
    backgroundColor: colors.surface.card,
    paddingVertical: spacing.sm,
  },
  topThreeCard: {
    gap: spacing.xs,
  },
  valueColumn: {
    alignItems: "flex-end",
    minWidth: 72,
  },
  warningText: {
    color: colors.warning,
  },
});
