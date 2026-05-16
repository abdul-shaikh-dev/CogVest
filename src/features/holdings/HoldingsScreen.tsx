import { useState } from "react";
import { RefreshControl, Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { HoldingCard } from "@/src/components/cards";
import {
  AppButton,
  AppText,
  EmptyState,
  IconButton,
  MetricGroup,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
} from "@/src/components/common";
import { FormTextField } from "@/src/components/forms";
import { formatDate, formatINR } from "@/src/domain/formatters";
import type { RefreshQuotesInput, QuoteRefreshResult } from "@/src/services/quotes";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, spacing } from "@/src/theme";
import type { AssetClass, Holding } from "@/src/types";

import { useHoldings } from "./useHoldings";

type RefreshQuotes = (
  input: RefreshQuotesInput,
) => Promise<QuoteRefreshResult>;

type HoldingsScreenProps = {
  onAddTrade?: () => void;
  refreshQuotes?: RefreshQuotes;
  store?: StoreApi<PortfolioStoreState>;
};

type HoldingFilter = "all" | "equity" | "debt" | "crypto" | "cash";

const filters: Array<{ key: HoldingFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "equity", label: "Equity" },
  { key: "debt", label: "Debt" },
  { key: "crypto", label: "Crypto" },
  { key: "cash", label: "Cash" },
];

export function HoldingsScreen({
  onAddTrade,
  refreshQuotes,
  store = getPortfolioStore(),
}: HoldingsScreenProps) {
  const {
    failures,
    holdings,
    isRefreshing,
    latestQuoteAsOf,
    manualFallbackCount,
    maskWealthValues,
    refresh,
    rollupRows,
    rollupTotals,
    toggleMaskWealthValues,
  } = useHoldings({
    refreshQuotes,
    store,
  });
  const [selectedFilter, setSelectedFilter] = useState<HoldingFilter>("all");
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const visibleHoldings = filterHoldings(holdings, selectedFilter, searchQuery);
  const quoteStatus = getQuoteStatus({
    latestQuoteAsOf,
    manualFallbackCount,
  });

  function getRollupRow(assetId: string) {
    return rollupRows.find((row) => row.asset.id === assetId);
  }

  return (
    <ScreenContainer
      refreshControl={
        holdings.length > 0 ? (
          <RefreshControl
            refreshing={isRefreshing}
            tintColor={colors.primary}
            onRefresh={() => {
              void refresh();
            }}
          />
        ) : undefined
      }
      scroll
      testID="holdings-screen"
    >
      <View style={styles.content}>
        <ScreenHeader
          title="Holdings"
          subtitle={`${holdings.length} positions • local data`}
          action={
            <>
              {onAddTrade ? (
                <IconButton
                  accessibilityLabel="Add Holding"
                  icon="add-outline"
                  onPress={onAddTrade}
                  testID="holdings-add-button"
                />
              ) : null}
              <IconButton
                accessibilityLabel="Search holdings"
                icon="search-outline"
                onPress={() => {
                  setIsSearchVisible((value) => !value);
                }}
                testID="holdings-search-toggle"
              />
              <IconButton
                accessibilityLabel={maskWealthValues ? "Show values" : "Mask values"}
                icon={maskWealthValues ? "eye-off-outline" : "eye-outline"}
                onPress={toggleMaskWealthValues}
                testID="holdings-mask-toggle"
              />
            </>
          }
        />

        {isSearchVisible ? (
          <FormTextField
            label="Search holdings input"
            onChangeText={setSearchQuery}
            placeholder="Search name, symbol, sector..."
            testID="holdings-search-input"
            value={searchQuery}
          />
        ) : null}

        {holdings.length > 0 ? (
          <MetricGroup
            metrics={[
              {
                label: "Current",
                masked: maskWealthValues,
                value: formatINR(rollupTotals.holdingsCurrentValue),
              },
              {
                label: "Invested",
                masked: maskWealthValues,
                value: formatINR(rollupTotals.totalInvested),
              },
              {
                label: "P&L",
                masked: maskWealthValues,
                value: formatINR(rollupTotals.pnl),
              },
              {
                label: "Drift",
                value: "Not enough data",
              },
            ]}
          />
        ) : null}

        <View style={styles.actionRow}>
          {holdings.length > 0 ? (
            <AppButton
              title="Refresh Quotes"
              variant="secondary"
              onPress={() => {
                void refresh();
              }}
            />
          ) : null}
        </View>

        {holdings.length > 0 ? (
          <PremiumCard>
            <AppText color="secondary" variant="caption">
              {quoteStatus}
            </AppText>
          </PremiumCard>
        ) : null}

        <View style={styles.filters}>
          {filters.map((filter) => (
            <Pressable
              accessibilityRole="button"
              key={filter.key}
              onPress={() => setSelectedFilter(filter.key)}
              style={[
                styles.filterChip,
                selectedFilter === filter.key && styles.filterChipActive,
              ]}
              testID={`holdings-filter-${filter.key}`}
            >
              <AppText
                color={selectedFilter === filter.key ? "inverse" : "secondary"}
                variant="caption"
                weight="bold"
              >
                {filter.label}
              </AppText>
            </Pressable>
          ))}
        </View>

        {holdings.length === 0 ? (
          <EmptyState
            actionLabel={onAddTrade ? "Add Holding" : undefined}
            actionTestID="add-trade-button"
            message="Holdings are created automatically from your portfolio entries."
            title="No holdings yet"
            onAction={onAddTrade}
          />
        ) : visibleHoldings.length === 0 ? (
          <EmptyState
            message={
              selectedFilter === "cash"
                ? "Cash is tracked in the Cash tab, not as holding rows."
                : "Try another search or filter."
            }
            title="No holdings match"
          />
        ) : (
          <PremiumCard style={styles.list} testID="holdings-list">
            {visibleHoldings.map((holding) => (
              <HoldingCard
                key={holding.asset.id}
                allocationPct={
                  getRollupRow(holding.asset.id)?.currentAllocationPct ?? 0
                }
                holding={holding}
                initialAllocationPct={
                  getRollupRow(holding.asset.id)?.initialAllocationPct ?? 0
                }
                masked={maskWealthValues}
              />
            ))}
          </PremiumCard>
        )}

        {failures.length > 0 ? (
          <AppText color="secondary">
            Some quotes could not refresh. Manual prices remain in use.
          </AppText>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

function getQuoteStatus({
  latestQuoteAsOf,
  manualFallbackCount,
}: {
  latestQuoteAsOf?: string;
  manualFallbackCount: number;
}) {
  if (!latestQuoteAsOf) {
    return "Quotes refresh after holdings have prices. Manual fallback ready.";
  }

  const fallbackLabel =
    manualFallbackCount === 1 ? "1 manual fallback" : `${manualFallbackCount} manual fallback`;

  return `Quotes updated ${formatDate(latestQuoteAsOf)} • ${fallbackLabel}`;
}

function isEquityClass(assetClass: AssetClass) {
  return assetClass === "stock" || assetClass === "etf";
}

function matchesFilter(holding: Holding, filter: HoldingFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "equity") {
    return isEquityClass(holding.asset.assetClass);
  }

  return holding.asset.assetClass === filter;
}

function matchesSearch(holding: Holding, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    holding.asset.name,
    holding.asset.symbol,
    holding.asset.ticker,
    holding.asset.assetClass,
    holding.asset.instrumentType,
    holding.asset.sectorType,
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}

function filterHoldings(
  holdings: Holding[],
  filter: HoldingFilter,
  searchQuery: string,
) {
  if (filter === "cash") {
    return [];
  }

  return holdings.filter(
    (holding) =>
      matchesFilter(holding, filter) && matchesSearch(holding, searchQuery),
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.cardGap,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  actionRow: {
    flexDirection: "row",
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterChip: {
    backgroundColor: colors.surface.elevated,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  list: {
    gap: spacing.sm,
    padding: spacing.sm,
  },
});
