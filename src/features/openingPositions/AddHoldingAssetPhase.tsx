import type { Dispatch, SetStateAction } from "react";
import { Pressable, View } from "react-native";

import { AppButton, AppText, CategoryIcon, PremiumCard, SectionHeader } from "@/src/components/common";
import { FormTextField, SelectionField } from "@/src/components/forms";
import type { AssetLookupResult } from "@/src/services/assetLookup";
import type { Asset } from "@/src/types";

import { useStyles } from "./addHoldingStyles";
import { discoveryFilters } from "./assetDiscovery";
import { AssetSearchField } from "./AssetSearchField";
import { DiscoveryResults } from "./DiscoveryResults";
import type { AddOpeningPositionController } from "./useAddOpeningPosition";

/** Step 1: find the asset in saved assets or public listings, or enter it manually. */
export function AddHoldingAssetPhase({
  areRecentSearchesExpanded,
  hasSelectedAssetSummary,
  holding,
  isManualEntryExpanded,
  onAddPpfAccount,
  onDiscoveryAction,
  providerResultsSettled,
  quickSetup,
  savedResultsSettled,
  selectDiscoveryResult,
  selectedAssetSourceLabel,
  selectSavedResult,
  setAreRecentSearchesExpanded,
  setIsManualEntryExpanded,
  stackIdentifiers,
}: {
  areRecentSearchesExpanded: boolean;
  hasSelectedAssetSummary: boolean;
  holding: AddOpeningPositionController;
  isManualEntryExpanded: boolean;
  onAddPpfAccount?: (legacy?: { assetId?: string; name?: string }) => void;
  onDiscoveryAction?: (kind: "query" | "filter" | "saved-page" | "provider-page") => void;
  providerResultsSettled: () => void;
  quickSetup: boolean;
  savedResultsSettled: () => void;
  selectDiscoveryResult: (result: AssetLookupResult) => void;
  selectedAssetSourceLabel: string;
  selectSavedResult: (asset: Asset) => void;
  setAreRecentSearchesExpanded: Dispatch<SetStateAction<boolean>>;
  setIsManualEntryExpanded: Dispatch<SetStateAction<boolean>>;
  stackIdentifiers: boolean;
}) {
  const styles = useStyles();
  const {
    assetClass,
    assetName,
    canRetryLookup,
    changeSelectedAsset,
    errors,
    instrumentType,
    isLookupSearching,
    lookupQuery,
    lookupResults,
    lookupStatus,
    discoveryFilter,
    setDiscoveryFilter,
    recentSearches,
    recentSearchStatus,
    clearSearchHistory,
    hasMoreLookupResults,
    hasMoreSavedAssets,
    loadMoreLookupResults,
    loadMoreSavedAssets,
    matchingExistingAssets,
    quoteSourceId,
    quoteStatus,
    quickSetupDuplicate,
    retryLookup,
    resetReview,
    selectedAssetId,
    setAssetName,
    setLookupQuery,
    setQuoteStatus,
    setSymbol,
    symbol,
    ticker,
    updateQuoteSourceId,
    updateTicker,
  } = holding;
  return (
      <PremiumCard section testID="add-holding-phase-asset">
        {hasSelectedAssetSummary ? (
          <View style={styles.selectedAssetSummary} testID="selected-asset-summary">
            <CategoryIcon assetClass={assetClass} size={20} />
            <View style={styles.summaryCopy}>
              <AppText weight="bold">{assetName}</AppText>
              <AppText color="secondary" variant="caption">
                {symbol} • {ticker} • {selectedAssetSourceLabel}
              </AppText>
            </View>
            <AppButton
              accessibilityLabel="Change selected asset"
              onPress={() => {
                setIsManualEntryExpanded(false);
                changeSelectedAsset();
              }}
              style={styles.selectedAssetChange}
              testID="selected-asset-change"
              title="Change"
              variant="ghost"
            />
          </View>
        ) : !isManualEntryExpanded ? (
          <>
            <AssetSearchField
              onChangeText={(value) => {
                onDiscoveryAction?.("query");
                setLookupQuery(value);
                setQuoteStatus("");
              }}
              placeholder="Name, symbol, or ticker"
              returnKeyType="search"
              testID="asset-lookup-input"
              value={lookupQuery}
            />
            <View style={styles.discoveryActions}>
              <SelectionField
                compact
                label="Filter results"
                options={discoveryFilters}
                value={discoveryFilter}
                onChange={(value) => {
                  onDiscoveryAction?.("filter");
                  setDiscoveryFilter(value);
                }}
                testIDPrefix="asset-discovery-filter"
              />
              {lookupQuery.trim().length === 0 && recentSearches.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: areRecentSearchesExpanded }}
                  onPress={() =>
                    setAreRecentSearchesExpanded((expanded) => !expanded)
                  }
                  style={({ pressed }) => [
                    styles.discoveryAction,
                    pressed && styles.pressed,
                  ]}
                  testID="toggle-recent-asset-searches"
                >
                  <AppText color="secondary" variant="caption" weight="bold">
                    Recent searches ({recentSearches.length})
                  </AppText>
                </Pressable>
              ) : null}
              <AppButton
                accessibilityState={{ expanded: false }}
                onPress={() => setIsManualEntryExpanded(true)}
                variant="secondary"
                testID="toggle-manual-asset-entry"
                title="Enter details manually"
              />
            </View>
            {lookupQuery.trim().length === 0 &&
            recentSearches.length > 0 &&
            areRecentSearchesExpanded ? (
              <View style={styles.lookupResults} testID="recent-asset-searches">
                {recentSearches.map((query) => (
                  <AppButton key={query} title={query} variant="ghost" onPress={() => setLookupQuery(query)} />
                ))}
                <AppButton
                  title="Clear recent searches"
                  variant="ghost"
                  onPress={() => {
                    clearSearchHistory();
                    setAreRecentSearchesExpanded(false);
                  }}
                />
              </View>
            ) : null}
            {recentSearchStatus ? <AppText color="secondary" variant="caption">{recentSearchStatus}</AppText> : null}
            {matchingExistingAssets.length > 0 ? (
              <View
                style={styles.lookupResults}
                testID="existing-asset-results"
              >
                <AppText color="secondary" variant="caption" weight="medium">
                  Saved assets
                </AppText>
                <DiscoveryResults kind="saved" items={matchingExistingAssets} onSelect={selectSavedResult}
                  onSettled={savedResultsSettled}
                  footer={hasMoreSavedAssets ? <AppButton title="Show more saved assets" variant="ghost" onPress={() => {
                    onDiscoveryAction?.("saved-page");
                    loadMoreSavedAssets();
                  }} /> : null} />
              </View>
            ) : null}
            {lookupStatus ? (
              <View style={styles.lookupStatus}>
                <AppText color="secondary" variant="caption">
                  {isLookupSearching ? "Searching..." : lookupStatus}
                </AppText>
                {canRetryLookup ? (
                  <AppButton
                    onPress={retryLookup}
                    testID="asset-lookup-retry"
                    title="Try search again"
                    variant="ghost"
                  />
                ) : null}
              </View>
            ) : null}
            {lookupResults.length > 0 ? (
              <View style={styles.lookupResults} testID="asset-lookup-results">
                <AppText color="secondary" variant="caption" weight="medium">Listings</AppText>
                <DiscoveryResults kind="provider" items={lookupResults} onSelect={selectDiscoveryResult}
                  onSettled={providerResultsSettled}
                  footer={hasMoreLookupResults ? <AppButton title="Load more" variant="secondary" onPress={() => {
                    onDiscoveryAction?.("provider-page");
                    loadMoreLookupResults();
                  }} testID="asset-discovery-load-more" /> : null} />
              </View>
            ) : null}
            {!isLookupSearching && discoveryFilter !== "all" && lookupResults.length === 0 && matchingExistingAssets.length === 0 ? (
              <AppText color="secondary" variant="caption">No matches for this filter. Try All assets or enter details manually.</AppText>
            ) : null}
            {lookupQuery.trim().length >= 2 && lookupResults.length === 0 && !isLookupSearching ? (
              <AppText color="secondary" variant="caption">
                Public search covers Indian stocks, ETFs and crypto. For other instruments, use manual entry.
              </AppText>
            ) : null}
          </>
        ) : null}
        {quoteStatus ? (
          <AppText color="secondary" variant="caption">
            {quoteStatus}
          </AppText>
        ) : null}
        {quickSetupDuplicate.kind !== "new" ? (
          <AppText
            color={
              quickSetupDuplicate.kind === "blocked" ? "secondary" : "primary"
            }
            selectable
            testID={`quick-setup-duplicate-${quickSetupDuplicate.kind}`}
            variant="caption"
          >
            {quickSetupDuplicate.message}
          </AppText>
        ) : null}
        {instrumentType === "ppf" ? (
          <PremiumCard elevated testID="ppf-dedicated-flow-notice">
            <AppText weight="bold">PPF uses a dedicated account ledger</AppText>
            <AppText color="secondary" variant="caption">
              PPF has no units, average cost, or market price. Set it up with a confirmed balance instead.
            </AppText>
            {onAddPpfAccount ? (
              <AppButton
                onPress={() =>
                  onAddPpfAccount({
                    assetId: selectedAssetId || undefined,
                    name: assetName || undefined,
                  })
                }
                testID="open-ppf-account-flow"
                title="Add PPF account"
                variant="secondary"
              />
            ) : null}
          </PremiumCard>
        ) : null}
        {!hasSelectedAssetSummary && isManualEntryExpanded ? (
          <AppButton
            accessibilityState={{ expanded: isManualEntryExpanded }}
            onPress={() => setIsManualEntryExpanded((expanded) => !expanded)}
            testID="toggle-manual-asset-entry"
            title={
              isManualEntryExpanded
                ? "Use asset search instead"
                : "Enter details manually"
            }
            variant="secondary"
          />
        ) : null}
        {!hasSelectedAssetSummary && isManualEntryExpanded ? (
        <View style={styles.manualFields} testID="manual-asset-fields">
          <SectionHeader title="Manual asset details" />
          <FormTextField
            error={errors.assetName}
            label="Asset name"
            onChangeText={(value) => {
              setAssetName(value);
              resetReview();
            }}
            placeholder="Reliance Industries"
            testID="asset-input"
            value={assetName}
          />
          <View style={stackIdentifiers ? styles.stackedIdentifiers : styles.row} testID="manual-asset-identifiers">
            <View style={!stackIdentifiers && styles.flex}>
              <FormTextField
                error={errors.symbol}
                label="Symbol"
                onChangeText={(value) => {
                  setSymbol(value);
                  resetReview();
                }}
                placeholder="RELIANCE"
                testID="symbol-input"
                value={symbol}
              />
            </View>
            <View style={!stackIdentifiers && styles.flex}>
              <FormTextField
                error={errors.ticker}
                label="Ticker"
                onChangeText={updateTicker}
                placeholder="RELIANCE.NS"
                testID="ticker-input"
                value={ticker}
              />
            </View>
          </View>
          <FormTextField
            label="Quote source ID"
            onChangeText={updateQuoteSourceId}
            placeholder="RELIANCE.NS"
            testID="quote-source-id-input"
            value={quoteSourceId}
          />
        </View>
        ) : null}
        {quickSetup &&
        onAddPpfAccount &&
        !hasSelectedAssetSummary &&
        !isManualEntryExpanded &&
        lookupQuery.trim().length === 0 ? (
          <AppButton
            onPress={() => onAddPpfAccount()}
            testID="quick-setup-add-ppf"
            title="Add a PPF account"
            variant="secondary"
          />
        ) : null}
      </PremiumCard>
  );
}
