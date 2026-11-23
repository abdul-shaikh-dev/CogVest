import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { type FlatList, Keyboard, RefreshControl, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppText,
  EmptyState,
  IconButton,
  PremiumCard,
  ScreenHeader,
  ScreenList,
} from "@/src/components/common";
import { calculateConsolidatedHoldingRows } from "@/src/domain/calculations";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { summarizeEpfForReporting } from "@/src/domain/epf/reporting";
import { useBackHandler, useLatestCallback } from "@/src/hooks";
import type { QuoteRefreshResult, RefreshQuotesInput } from "@/src/services/quotes";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { useTheme } from "@/src/theme";

import { assetXirrSummary } from "./assetXirr";
import { HoldingDetailModal } from "./HoldingDetails";
import { SelectableHoldingRow } from "./HoldingRow";
import { EpfAccountsSection, PpfAccountsSection } from "./HoldingsAccountSections";
import { DestinationTab } from "./HoldingsFilters";
import {
  HoldingsSearchField,
  MarketListControls,
  NoHoldingsState,
  PendingValuationsRow,
  QuoteHealthRow,
  ResumeSetupRow,
} from "./HoldingsHeaderSections";
import {
  AddHoldingsPanel,
  HoldingsOptionsPanel,
  HoldingsPanelSheet,
  PortfolioInsightsPanel,
  ValuationDetailsPanel,
  type HoldingsPanel,
} from "./HoldingsPanels";
import {
  createHoldingReviewItems,
  filterHoldingReviewItems,
  getExposureSegments,
  getHoldingReviewSummary,
  type HoldingFilter,
  type HoldingReviewItem,
} from "./holdingsReview";
import { useStyles } from "./holdingsStyles";
import {
  getFilterCounts,
  getHoldingsSubtitle,
  getQuoteStatus,
} from "./holdingsViewModel";
import { useHoldings } from "./useHoldings";
import type { HoldingsDestination } from "./destinationSwipe";
import { useDestinationSwipe } from "./useDestinationSwipe";

type RefreshQuotes = (input: RefreshQuotesInput) => Promise<QuoteRefreshResult>;

type HoldingsScreenProps = {
  isActive?: boolean;
  openAddMenu?: boolean;
  onAddMenuOpened?: () => void;
  onOpenDuration?: () => void;
  now?: Date;
  onAddTrade?: () => void;
  onRecordPurchase?: (assetId?: string) => void;
  onAddPpfAccount?: (legacy?: { assetId?: string; name?: string }) => void;
  onAddEpfAccount?: () => void;
  /** A new object requests that destination once, e.g. from the Dashboard EPF card. */
  destinationRequest?: { destination: HoldingsDestination };
  onOpenFutures?: () => void;
  onImportHoldings?: () => void;
  onImportTransactions?: () => void;
  onManageAssets?: () => void;
  onReviewAllTrades?: () => void;
  onReviewOpeningPosition?: (openingPositionId: string) => void;
  onReviewPpfAccount?: (accountId: string) => void;
  onReviewEpfAccount?: (accountId: string) => void;
  onReviewTrades?: (assetId: string) => void;
  onSellRedeem?: (assetId: string) => void;
  onReviewPayouts?: (assetId: string) => void;
  onQuickSetup?: () => void;
  quickSetupSavedCount?: number;
  statusMessage?: string;
  refreshQuotes?: RefreshQuotes;
  store?: StoreApi<PortfolioStoreState>;
};

export function HoldingsScreen({
  isActive = true,
  openAddMenu,
  onAddMenuOpened,
  onOpenDuration,
  now,
  onAddTrade,
  onRecordPurchase,
  onAddPpfAccount,
  onAddEpfAccount,
  destinationRequest,
  onOpenFutures,
  onImportHoldings,
  onImportTransactions,
  onManageAssets,
  onReviewAllTrades,
  onReviewOpeningPosition,
  onReviewPpfAccount,
  onReviewEpfAccount,
  onReviewTrades,
  onSellRedeem,
  onReviewPayouts,
  onQuickSetup,
  quickSetupSavedCount = 0,
  refreshQuotes,
  statusMessage,
  store = getPortfolioStore(),
}: HoldingsScreenProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const observedAt = now ?? new Date();
  const [activePanel, setActivePanel] = useState<HoldingsPanel>();
  const [selectedDestination, setSelectedDestination] =
    useState<HoldingsDestination>(destinationRequest?.destination ?? "market");
  const [appliedDestinationRequest, setAppliedDestinationRequest] = useState(destinationRequest);
  if (appliedDestinationRequest !== destinationRequest) {
    setAppliedDestinationRequest(destinationRequest);
    if (destinationRequest) setSelectedDestination(destinationRequest.destination);
  }
  const scrollRef = useRef<FlatList<HoldingReviewItem>>(null);
  const detailScrollOffsetRef = useRef(0);
  useEffect(() => {
    if (openAddMenu) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot route param, consumed then cleared by onAddMenuOpened.
      setActivePanel("add");
      onAddMenuOpened?.();
    }
  }, [openAddMenu, onAddMenuOpened]);
  const {
    assets,
    displayMode,
    failed,
    hasCash,
    holdings,
    isRefreshing,
    maskWealthValues,
    openingPositions,
    ppfSummary,
    quoteFreshness,
    refresh,
    refreshError,
    rollupRows,
    timedOut,
    toggleMaskWealthValues,
    trades,
  } = useHoldings({
    now: observedAt,
    refreshQuotes,
    store,
  });
  const isMinimalMode = displayMode === "minimal";
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<HoldingFilter>("all");
  const [selectedAssetId, setSelectedAssetId] = useState<string>();
  const [selectedRecordsVisible, setSelectedRecordsVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Stable item objects let memoized rows skip focus-only re-renders (#138).
  const { allocationHoldings, legacyPpfHoldings, marketHoldings, marketReviewItems, reviewItems } = useMemo(() => {
    const marketHoldings = holdings.filter(
      (holding) => holding.asset.instrumentType !== "ppf",
    );
    const allocationHoldings = marketHoldings.filter(
      (holding) => holding.asset.assetClass !== "cash",
    );
    return {
      allocationHoldings,
      legacyPpfHoldings: holdings.filter(
        (holding) => holding.asset.instrumentType === "ppf",
      ),
      marketHoldings,
      marketReviewItems: createHoldingReviewItems(
        marketHoldings,
        calculateConsolidatedHoldingRows(allocationHoldings),
      ),
      reviewItems: createHoldingReviewItems(holdings, rollupRows),
    };
  }, [holdings, rollupRows]);
  const ppfRecordCount = ppfSummary.accounts.length + legacyPpfHoldings.length;
  const hasMarketHoldings = marketHoldings.length > 0;
  const hasPpfDestination =
    ppfSummary.accounts.length > 0 || legacyPpfHoldings.length > 0;
  const distributions = useSyncExternalStore(store.subscribe, () => store.getState().distributions, () => store.getState().distributions);
  const distributionCoverage = useSyncExternalStore(store.subscribe, () => store.getState().distributionCoverage,
    () => store.getState().distributionCoverage);
  const epfState = useSyncExternalStore(store.subscribe, () => store.getState().epf, () => store.getState().epf);
  const epfAsOf = formatLocalCalendarDate(observedAt);
  const epfSummary = useMemo(() => summarizeEpfForReporting(epfState, epfAsOf), [epfState, epfAsOf]);
  const hasEpfDestination = epfState.accounts.length > 0;
  const destinations = (["market", "ppf", "epf"] as const).filter((destination) =>
    destination === "market" ? hasMarketHoldings
      : destination === "ppf" ? hasPpfDestination : hasEpfDestination);
  const activeDestination: HoldingsDestination = (destinations as readonly HoldingsDestination[]).includes(selectedDestination)
    ? selectedDestination
    : destinations[0] ?? "market";
  function selectDestination(destination: HoldingsDestination) {
    if (destination === activeDestination) return;
    Keyboard.dismiss();
    setSelectedDestination(destination);
    scrollRef.current?.scrollToOffset({ offset: 0, animated: false });
  }
  const destinationGesture = useDestinationSwipe({
    active: activeDestination,
    blocked: Boolean(activePanel || selectedAssetId),
    destinations,
    onSelect: selectDestination,
  });
  const allocationAvailable = allocationHoldings.every(
    (holding) => holding.valuation.status !== "pending",
  );
  const effectiveFilter =
    !allocationAvailable && selectedFilter === "high-allocation"
      ? "all"
      : selectedFilter;
  const visibleItems = filterHoldingReviewItems(
    marketReviewItems,
    effectiveFilter,
    searchQuery,
  );
  // Rows are virtualised, so only those near the screen are mounted (#664).
  const showMarketList = activeDestination === "market" && hasMarketHoldings;
  const marketRows = showMarketList ? visibleItems : [];
  const showNoMatches = showMarketList && visibleItems.length === 0;
  const allocationItems = marketReviewItems.filter(
    (item) => item.holding.asset.assetClass !== "cash",
  );
  const summary = getHoldingReviewSummary(allocationItems);
  const distinctBestReturn =
    summary.bestReturn?.holding.asset.id === summary.dominant?.holding.asset.id
      ? undefined
      : summary.bestReturn;
  const exposureSegments = getExposureSegments(allocationItems);
  const filterCounts = getFilterCounts(marketReviewItems, allocationAvailable);
  const subtitle = getHoldingsSubtitle({
    epfAccounts: epfState.accounts.length,
    marketPositions: marketHoldings.length,
    ppfRecords: ppfRecordCount,
  });
  const quoteStatus = getQuoteStatus({
    failed: failed.length,
    isRefreshing,
    quoteFreshness,
    refreshError,
    timedOut: timedOut.length,
  });
  const pendingValuations = marketHoldings.filter(
    (holding) => holding.valuation.status === "pending",
  ).length;

  const selectedItem =
    marketReviewItems.find(
      (item) => item.holding.asset.id === selectedAssetId,
    ) ?? reviewItems.find((item) => item.holding.asset.id === selectedAssetId);
  // The selected holding disappeared (for example, its last record was removed).
  // selectHolding resets detailScrollOffsetRef before any later selection.
  if (selectedAssetId && !selectedItem) {
    setSelectedRecordsVisible(false);
    setSelectedAssetId(undefined);
  }

  function closeDetail() {
    detailScrollOffsetRef.current = 0;
    setSelectedRecordsVisible(false);
    setSelectedAssetId(undefined);
  }
  useBackHandler(closeDetail, isActive && Boolean(selectedAssetId));

  const selectHolding = useLatestCallback((assetId: string) => {
    Keyboard.dismiss();
    detailScrollOffsetRef.current = 0;
    setSelectedRecordsVisible(false);
    setSelectedAssetId(assetId);
  });

  function renderHoldingRow(item: HoldingReviewItem) {
    return (
      <SelectableHoldingRow
        allocationAvailable={
          allocationAvailable &&
          item.holding.asset.instrumentType !== "ppf" &&
          item.holding.asset.assetClass !== "cash"
        }
        item={item}
        key={item.holding.asset.id}
        // Only rows without a price change while quotes load, so the other
        // memoised rows do not re-render.
        loadingPrice={isRefreshing && item.holding.currentValue === null}
        masked={maskWealthValues}
        minimal={isMinimalMode}
        onSelect={selectHolding}
      />
    );
  }

  return (
    <View style={{ flex: 1 }} testID="holdings-swipe-surface" {...destinationGesture.panHandlers}>
    <ScreenList
      data={marketRows}
      empty={showNoMatches ? (
        <View style={styles.listGap}>
          <EmptyState
            message="Try another search or review filter."
            title="No holdings match"
          />
        </View>
      ) : undefined}
      footer={activeDestination === "market" && hasMarketHoldings && !isMinimalMode ? (
        <AppText color="secondary" style={styles.listGap} variant="caption">
          Returns are since investment, not today.
        </AppText>
      ) : undefined}
      itemGap={0}
      keyExtractor={(item: HoldingReviewItem) => item.holding.asset.id}
      listRef={scrollRef}
      listStyle={styles.listContent}
      listTestID="holdings-list"
      renderItem={({ item }: { item: HoldingReviewItem }) => renderHoldingRow(item)}
      refreshControl={
        holdings.length > 0 ? (
          <RefreshControl
            refreshing={isRefreshing}
            tintColor={colors.primary}
            onRefresh={async () => {
              await refresh();
            }}
          />
        ) : undefined
      }
      testID="holdings-screen"
      header={(
      <View style={styles.listHeaderContent}>
        <ScreenHeader
          compact
          title="Holdings"
          subtitle={subtitle}
          action={
            <>
              <IconButton
                plain
                accessibilityLabel={
                  maskWealthValues ? "Show values" : "Hide values"
                }
                icon={maskWealthValues ? "eye-off-outline" : "eye-outline"}
                onPress={toggleMaskWealthValues}
                testID="holdings-header-mask-toggle"
              />
              {onAddTrade || onAddPpfAccount || onRecordPurchase || onOpenFutures ? (
                <IconButton
                  prominent
                  accessibilityLabel="Add Holding"
                  icon="add-outline"
                  onPress={() => setActivePanel("add")}
                  testID="holdings-add-button"
                />
              ) : null}
              <IconButton
                plain
                accessibilityLabel="More holdings options"
                icon="ellipsis-horizontal"
                onPress={() => setActivePanel("more")}
                testID="holdings-more-button"
              />
            </>
          }
        />

        {destinations.length > 1 ? (
          <View accessibilityRole="tablist" testID="holdings-destination-tabs" style={styles.destinationTabs}>
            {destinations.map((destination) => (
              <DestinationTab
                active={activeDestination === destination}
                key={destination}
                label={destination === "market" ? `Market ${marketHoldings.length}`
                  : destination === "ppf" ? `PPF ${ppfRecordCount}` : `EPF ${epfState.accounts.length}`}
                onPress={() => selectDestination(destination)}
                testID={`holdings-${destination}-tab`}
              />
            ))}
          </View>
        ) : null}

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
          <HoldingsSearchField onChange={setSearchQuery} value={searchQuery} />
        ) : null}

        {quickSetupSavedCount > 0 &&
        onQuickSetup &&
        (holdings.length > 0 || ppfSummary.accounts.length > 0) ? (
          <ResumeSetupRow onResume={onQuickSetup} savedCount={quickSetupSavedCount} />
        ) : null}

        {hasMarketHoldings &&
        activeDestination === "market" &&
        pendingValuations === 0 &&
        (isRefreshing || refreshError || failed.length > 0 || timedOut.length > 0) ? (
          <QuoteHealthRow
            onShowDetails={() => setActivePanel("quotes")}
            quoteStatus={quoteStatus}
          />
        ) : null}

        {activeDestination === "market" && pendingValuations > 0 ? (
          <PendingValuationsRow
            count={pendingValuations}
            onRefresh={() => {
              void refresh();
            }}
          />
        ) : null}

        {activeDestination === "ppf" && hasPpfDestination ? (
          <PpfAccountsSection
            legacyPpfHoldings={legacyPpfHoldings}
            maskWealthValues={maskWealthValues}
            onAddPpfAccount={onAddPpfAccount}
            onReviewPpfAccount={onReviewPpfAccount}
            ppfHoldingRows={reviewItems
              .filter((item) => item.holding.asset.instrumentType === "ppf")
              .map(renderHoldingRow)}
            ppfSummary={ppfSummary}
          />
        ) : null}

        {activeDestination === "epf" && hasEpfDestination ? (
          <EpfAccountsSection
            epfState={epfState}
            epfSummary={epfSummary}
            maskWealthValues={maskWealthValues}
            onAddEpfAccount={onAddEpfAccount}
            onReviewEpfAccount={onReviewEpfAccount}
          />
        ) : null}

        {!hasMarketHoldings && !hasPpfDestination && !hasEpfDestination ? (
          <NoHoldingsState
            onAddTrade={onAddTrade}
            onOpenAddPanel={() => setActivePanel("add")}
            onQuickSetup={onQuickSetup}
            savedCount={quickSetupSavedCount}
          />
        ) : activeDestination === "market" ? (
          <MarketListControls
            allocationAvailable={allocationAvailable}
            filter={effectiveFilter}
            filterCounts={filterCounts}
            filtersVisible={filtersVisible}
            minimal={isMinimalMode}
            onOpenInsights={() => setActivePanel("insights")}
            onSelectFilter={setSelectedFilter}
            onToggleFilters={() => setFiltersVisible((visible) => !visible)}
          />
        ) : null}
      </View>
      )}
    >
        {selectedItem ? (
          <HoldingDetailModal
            allocationAvailable={
              allocationAvailable &&
              selectedItem.holding.asset.instrumentType !== "ppf" &&
              selectedItem.holding.asset.assetClass !== "cash"
            }
            assets={assets}
            closeDetail={closeDetail}
            detailScrollOffsetRef={detailScrollOffsetRef}
            isActive={isActive}
            masked={maskWealthValues}
            minimal={isMinimalMode}
            now={observedAt}
            onRecordPurchase={onRecordPurchase}
            onReviewOpeningPosition={onReviewOpeningPosition}
            onReviewTrades={onReviewTrades}
            onSellRedeem={onSellRedeem}
            onReviewPayouts={onReviewPayouts}
            openingPositions={openingPositions}
            payouts={{ coverage: distributionCoverage, distributions }}
            selectedItem={selectedItem}
            selectedRecordsVisible={selectedRecordsVisible}
            setSelectedRecordsVisible={setSelectedRecordsVisible}
            statusMessage={statusMessage}
            toggleMaskWealthValues={toggleMaskWealthValues}
            trades={trades}
            xirrFor={(assetId) => assetXirrSummary(store.getState(), assetId, observedAt)}
          />
        ) : null}

        <HoldingsPanelSheet activePanel={activePanel} setActivePanel={setActivePanel}>
          {activePanel === "add" ? (
            <AddHoldingsPanel
              hasCash={hasCash}
              onAddEpfAccount={onAddEpfAccount}
              onAddPpfAccount={onAddPpfAccount}
              onAddTrade={onAddTrade}
              onClose={() => setActivePanel(undefined)}
              onImportHoldings={onImportHoldings}
              onImportTransactions={onImportTransactions}
              onOpenFutures={onOpenFutures}
              onQuickSetup={onQuickSetup}
              onRecordPurchase={onRecordPurchase}
              quickSetupSavedCount={quickSetupSavedCount}
            />
          ) : null}

          {activePanel === "more" ? (
            <HoldingsOptionsPanel
              hasPpfAccounts={ppfSummary.accounts.length > 0}
              hasTrades={trades.length > 0}
              maskWealthValues={maskWealthValues}
              onAddPpfAccount={onAddPpfAccount}
              onClose={() => setActivePanel(undefined)}
              onManageAssets={onManageAssets}
              onReviewAllTrades={onReviewAllTrades}
              onShowValuationDetails={() => setActivePanel("quotes")}
              toggleMaskWealthValues={toggleMaskWealthValues}
            />
          ) : null}

          {activePanel === "quotes" ? (
            <ValuationDetailsPanel
              hasMarketHoldings={hasMarketHoldings}
              quoteStatus={quoteStatus}
              refresh={() => refresh()}
              refreshIncomplete={failed.length > 0 || timedOut.length > 0}
            />
          ) : null}

          {activePanel === "insights" ? (
            <PortfolioInsightsPanel
              allocationAvailable={allocationAvailable}
              distinctBestReturn={distinctBestReturn}
              exposureSegments={exposureSegments}
              onClose={() => setActivePanel(undefined)}
              onOpenDuration={onOpenDuration}
              summary={summary}
            />
          ) : null}
        </HoldingsPanelSheet>
    </ScreenList>
    </View>
  );
}
