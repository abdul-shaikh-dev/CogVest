import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  BackHandler,
  Keyboard,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  CategoryIcon,
  EmptyState,
  IconButton,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
} from "@/src/components/common";
import { calculateConsolidatedHoldingRows } from "@/src/domain/calculations";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { summarizeEpfForReporting } from "@/src/domain/epf/reporting";
import type { QuoteRefreshResult, RefreshQuotesInput } from "@/src/services/quotes";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { useTheme } from "@/src/theme";

import { HoldingDetailModal } from "./HoldingDetails";
import { HoldingRow } from "./HoldingRow";
import { EpfAccountsSection, PpfAccountsSection } from "./HoldingsAccountSections";
import { DestinationTab, FilterRow } from "./HoldingsFilters";
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
  getFilterLabel,
  getHoldingsSubtitle,
  getQuoteStatus,
} from "./holdingsViewModel";
import { useHoldings } from "./useHoldings";
import { destinationAfterSwipe, isHorizontalIntent, type HoldingsDestination } from "./destinationSwipe";

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
  onQuickSetup,
  quickSetupSavedCount = 0,
  refreshQuotes,
  statusMessage,
  store = getPortfolioStore(),
}: HoldingsScreenProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const observedAt = now ?? new Date();
  const { width, fontScale } = useWindowDimensions();
  const [activePanel, setActivePanel] = useState<HoldingsPanel>();
  const [selectedDestination, setSelectedDestination] =
    useState<HoldingsDestination>(destinationRequest?.destination ?? "market");
  useEffect(() => {
    if (destinationRequest) setSelectedDestination(destinationRequest.destination);
  }, [destinationRequest]);
  const scrollRef = useRef<ScrollView>(null);
  const detailScrollOffset = useRef(0);
  const verticalGesture = useRef(false);
  useEffect(() => {
    if (openAddMenu) {
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
  const reviewItems = createHoldingReviewItems(holdings, rollupRows);
  const marketHoldings = holdings.filter(
    (holding) => holding.asset.instrumentType !== "ppf",
  );
  const allocationHoldings = marketHoldings.filter(
    (holding) => holding.asset.assetClass !== "cash",
  );
  const marketReviewItems = createHoldingReviewItems(
    marketHoldings,
    calculateConsolidatedHoldingRows(allocationHoldings),
  );
  const legacyPpfHoldings = holdings.filter(
    (holding) => holding.asset.instrumentType === "ppf",
  );
  const ppfRecordCount = ppfSummary.accounts.length + legacyPpfHoldings.length;
  const hasMarketHoldings = marketHoldings.length > 0;
  const hasPpfDestination =
    ppfSummary.accounts.length > 0 || legacyPpfHoldings.length > 0;
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
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  const destinationGesture = PanResponder.create({
    onStartShouldSetPanResponderCapture: (_, gesture) => {
      verticalGesture.current = gesture.numberActiveTouches !== 1;
      return false;
    },
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      if (gesture.numberActiveTouches > 1 ||
          (Math.abs(gesture.dy) > 12 && Math.abs(gesture.dy) >= Math.abs(gesture.dx))) {
        verticalGesture.current = true;
      }
      return destinations.length > 1 && !activePanel &&
        !selectedAssetId && !verticalGesture.current && gesture.numberActiveTouches === 1 &&
        isHorizontalIntent(gesture.dx, gesture.dy);
    },
    onPanResponderMove: (_, gesture) => {
      if (gesture.numberActiveTouches > 1 ||
          Math.abs(gesture.dy) >= Math.abs(gesture.dx)) {
        verticalGesture.current = true;
      }
    },
    onPanResponderTerminate: () => { verticalGesture.current = true; },
    onPanResponderRelease: (_, gesture) => {
      const destination = destinationAfterSwipe(gesture.dx, gesture.dy, destinations, activeDestination);
      if (destination && !verticalGesture.current && destinations.length > 1 &&
          !activePanel && !selectedAssetId) selectDestination(destination);
    },
    onPanResponderTerminationRequest: () => true,
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
    timedOut: timedOut.length,
  });
  const pendingValuations = marketHoldings.filter(
    (holding) => holding.valuation.status === "pending",
  ).length;

  const selectedItem =
    marketReviewItems.find(
      (item) => item.holding.asset.id === selectedAssetId,
    ) ?? reviewItems.find((item) => item.holding.asset.id === selectedAssetId);
  useEffect(() => {
    if (selectedAssetId && !selectedItem) {
      detailScrollOffset.current = 0;
      setSelectedRecordsVisible(false);
      setSelectedAssetId(undefined);
    }
  }, [selectedAssetId, selectedItem]);

  function closeDetail() {
    detailScrollOffset.current = 0;
    setSelectedRecordsVisible(false);
    setSelectedAssetId(undefined);
  }
  useEffect(() => {
    if (!isActive || !selectedAssetId) return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        closeDetail();
        return true;
      },
    );
    return () => subscription.remove();
  }, [isActive, selectedAssetId]);

  function renderHoldingRow(item: HoldingReviewItem) {
    return (
      <HoldingRow
        allocationAvailable={
          allocationAvailable &&
          item.holding.asset.instrumentType !== "ppf" &&
          item.holding.asset.assetClass !== "cash"
        }
        item={item}
        key={item.holding.asset.id}
        masked={maskWealthValues}
        minimal={isMinimalMode}
        onPress={() => {
          Keyboard.dismiss();
          detailScrollOffset.current = 0;
          setSelectedRecordsVisible(false);
          setSelectedAssetId(item.holding.asset.id);
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1 }} testID="holdings-swipe-surface" {...destinationGesture.panHandlers}>
    <ScreenContainer
      scrollRef={scrollRef}
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
                  plain
                  accessibilityLabel={
                    onQuickSetup ? "Add holdings" : "Add Holding"
                  }
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
          <View style={styles.searchField}>
            <Ionicons
              accessible={false}
              name="search-outline"
              size={20}
              color={colors.text.secondary}
            />
            <TextInput
              accessibilityLabel="Search holdings"
              onChangeText={setSearchQuery}
              placeholder="Find a holding"
              placeholderTextColor={colors.text.secondary}
              style={styles.searchInput}
              testID="holdings-search-input"
              value={searchQuery}
            />
          </View>
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
        pendingValuations === 0 &&
        (isRefreshing || failed.length > 0 || timedOut.length > 0) ? (
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
          <View
            style={[styles.pendingValuationRow, (width < 400 || fontScale > 1.15) && styles.stackedContent]}
            testID="holdings-pending-valuations"
          >
            <View style={styles.pendingValuationCopy}>
              <AppText weight="bold">
                {pendingValuations} valuation
                {pendingValuations === 1 ? "" : "s"} pending
              </AppText>
              <AppText color="secondary" variant="caption">
                Invested values remain available. Current totals and allocation
                are incomplete.
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
            actionTestID={
              onQuickSetup ? "quick-setup-button" : "add-trade-button"
            }
            message={
              quickSetupSavedCount > 0
                ? `${quickSetupSavedCount} confirmed ${quickSetupSavedCount === 1 ? "holding is" : "holdings are"} saved locally.`
                : onQuickSetup
                  ? "Choose manual entry or import holdings and transaction history."
                  : "Holdings are created automatically from your portfolio entries."
            }
            title="No holdings yet"
            onAction={onQuickSetup ? () => setActivePanel("add") : onAddTrade}
            onSecondaryAction={onQuickSetup ? onAddTrade : undefined}
            secondaryActionLabel={onQuickSetup ? "Add one holding" : undefined}
            secondaryActionTestID="add-trade-button"
          />
        ) : activeDestination === "market" ? (
          <>
            <View style={styles.listHeading}>
              <AppText
                color="secondary"
                testID="holdings-allocation-scope"
                variant="caption"
              >
                Value order · Weight excludes cash and PPF
              </AppText>
              <View style={styles.listActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${filtersVisible ? "Hide" : "Show"} holding filters. Current filter: ${getFilterLabel(effectiveFilter)}`}
                  accessibilityState={{ expanded: filtersVisible }}
                  onPress={() => setFiltersVisible((visible) => !visible)}
                  style={styles.listAction}
                  testID="holdings-filter-toggle"
                >
                  <Ionicons
                    accessible={false}
                    name="options-outline"
                    size={18}
                    color={colors.text.primary}
                  />
                  <AppText variant="caption" weight="bold">
                    {effectiveFilter === "all"
                      ? "Filter"
                      : getFilterLabel(effectiveFilter)}
                  </AppText>
                </Pressable>
                {!isMinimalMode ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Portfolio insights"
                  onPress={() => setActivePanel("insights")}
                  style={styles.listAction}
                  testID="holdings-insights-button"
                >
                  <AppText variant="caption">Portfolio insights</AppText>
                  <Ionicons
                    accessible={false}
                    name="chevron-forward"
                    size={16}
                    color={colors.text.primary}
                  />
                </Pressable>
                ) : null}
              </View>
            </View>

            {filtersVisible ? (
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
            {!isMinimalMode ? <AppText color="secondary" variant="caption">
              Returns are since investment, not today.
            </AppText> : null}
          </>
        ) : null}

        {selectedItem ? (
          <HoldingDetailModal
            allocationAvailable={
              allocationAvailable &&
              selectedItem.holding.asset.instrumentType !== "ppf" &&
              selectedItem.holding.asset.assetClass !== "cash"
            }
            assets={assets}
            closeDetail={closeDetail}
            detailScrollOffset={detailScrollOffset}
            isActive={isActive}
            masked={maskWealthValues}
            minimal={isMinimalMode}
            now={observedAt}
            onRecordPurchase={onRecordPurchase}
            onReviewOpeningPosition={onReviewOpeningPosition}
            onReviewTrades={onReviewTrades}
            onSellRedeem={onSellRedeem}
            openingPositions={openingPositions}
            selectedItem={selectedItem}
            selectedRecordsVisible={selectedRecordsVisible}
            setSelectedRecordsVisible={setSelectedRecordsVisible}
            statusMessage={statusMessage}
            toggleMaskWealthValues={toggleMaskWealthValues}
            trades={trades}
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
      </View>
    </ScreenContainer>
    </View>
  );
}
