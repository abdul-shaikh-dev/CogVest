import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
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
  androidRipple,
  assetClassLabel,
  getPressedStateStyle,
  minimumTouchTargetStyle,
} from "@/src/components/common";
import { FormTextField } from "@/src/components/forms";
import {
  formatCompactINR,
  formatDate,
  formatPercentage,
} from "@/src/domain/formatters";
import type { QuoteRefreshResult, RefreshQuotesInput } from "@/src/services/quotes";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, interaction, radii, spacing } from "@/src/theme";

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
  onAddTrade?: () => void;
  onSellRedeem?: (assetId: string) => void;
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
  onAddTrade,
  onSellRedeem,
  refreshQuotes,
  store = getPortfolioStore(),
}: HoldingsScreenProps) {
  const {
    failures,
    holdings,
    isRefreshing,
    latestQuoteAsOf,
    maskWealthValues,
    refresh,
    rollupRows,
    toggleMaskWealthValues,
  } = useHoldings({
    refreshQuotes,
    store,
  });
  const [selectedFilter, setSelectedFilter] = useState<HoldingFilter>("all");
  const [expandedAssetId, setExpandedAssetId] = useState<string>();
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const reviewItems = createHoldingReviewItems(holdings, rollupRows);
  const visibleItems = filterHoldingReviewItems(
    reviewItems,
    selectedFilter,
    searchQuery,
  );
  const summary = getHoldingReviewSummary(reviewItems);
  const exposureSegments = getExposureSegments(reviewItems);
  const filterCounts = getFilterCounts(reviewItems);
  const subtitle = latestQuoteAsOf
    ? `${holdings.length} positions · quotes updated ${formatDate(latestQuoteAsOf)}`
    : `${holdings.length} positions · local data`;

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
              <IconButton
                accessibilityLabel="Search holdings"
                icon="search-outline"
                onPress={() => setIsSearchVisible((value) => !value)}
                testID="holdings-search-toggle"
              />
              {onAddTrade ? (
                <IconButton
                  accessibilityLabel="Add Holding"
                  icon="add-outline"
                  onPress={onAddTrade}
                  testID="holdings-add-button"
                />
              ) : null}
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

        {holdings.length === 0 ? (
          <EmptyState
            actionLabel={onAddTrade ? "Add Holding" : undefined}
            actionTestID="add-trade-button"
            message="Holdings are created automatically from your portfolio entries."
            title="No holdings yet"
            onAction={onAddTrade}
          />
        ) : (
          <>
            <View style={styles.insightGrid}>
              <InsightCard
                eyebrow="Dominant position"
                title={summary.dominant?.holding.asset.name ?? "Not enough data"}
                detail={
                  summary.dominant
                    ? `${formatPercentage(summary.dominant.allocationPct).replace("+", "")} allocation`
                    : "Add holdings to compare exposure"
                }
              />
              <InsightCard
                eyebrow="Best return"
                title={summary.bestReturn?.holding.asset.name ?? "Not enough data"}
                detail={
                  summary.bestReturn
                    ? `${formatPercentage(summary.bestReturn.holding.unrealisedPnLPct)} return`
                    : "Returns appear after prices are available"
                }
                positive={(summary.bestReturn?.holding.unrealisedPnL ?? 0) >= 0}
              />
            </View>

            <ExposurePanel
              segments={exposureSegments}
              topThreeAllocationPct={summary.topThreeAllocationPct}
            />

            <FilterRow
              counts={filterCounts}
              onSelect={setSelectedFilter}
              selected={selectedFilter}
            />

            {visibleItems.length === 0 ? (
              <EmptyState
                message="Try another search or review filter."
                title="No holdings match"
              />
            ) : (
              <View style={styles.holdingsList} testID="holdings-list">
                {visibleItems.map((item) => (
                  <HoldingRow
                    expanded={expandedAssetId === item.holding.asset.id}
                    item={item}
                    key={item.holding.asset.id}
                    masked={maskWealthValues}
                    onSellRedeem={onSellRedeem}
                    onPress={() =>
                      setExpandedAssetId((current) =>
                        current === item.holding.asset.id
                          ? undefined
                          : item.holding.asset.id,
                      )
                    }
                  />
                ))}
              </View>
            )}
          </>
        )}

        {failures.length > 0 ? (
          <AppText color="secondary" variant="caption">
            Some prices could not refresh. Existing values remain available.
          </AppText>
        ) : null}
      </View>
    </ScreenContainer>
  );
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
  topThreeAllocationPct,
}: {
  segments: ExposureSegment[];
  topThreeAllocationPct: number;
}) {
  return (
    <PremiumCard style={styles.exposureCard}>
      <View style={styles.sectionHeading}>
        <View>
          <AppText color="secondary" variant="caption" weight="medium">
            Exposure mix
          </AppText>
          <AppText weight="bold">Asset-class concentration</AppText>
        </View>
        <View style={styles.topThree}>
          <AppText color="secondary" variant="caption">
            Top 3
          </AppText>
          <AppText variant="title" weight="bold">
            {formatPercentage(topThreeAllocationPct).replace("+", "")}
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
              <AppText color="secondary" numberOfLines={1} variant="caption">
                {segment.count} {segment.count === 1 ? "position" : "positions"}
              </AppText>
            </View>
          </View>
        ))}
      </View>
    </PremiumCard>
  );
}

function FilterRow({
  counts,
  onSelect,
  selected,
}: {
  counts: Record<HoldingFilter, number>;
  onSelect: (filter: HoldingFilter) => void;
  selected: HoldingFilter;
}) {
  return (
    <View style={styles.filters}>
      {filterOrder.map((filter) => {
        const active = selected === filter;

        return (
          <Pressable
            accessibilityRole="button"
            android_ripple={androidRipple(
              active
                ? interaction.primaryRippleColor
                : interaction.rippleColor,
            )}
            key={filter}
            onPress={() => onSelect(filter)}
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
  expanded,
  item,
  masked,
  onPress,
  onSellRedeem,
}: {
  expanded: boolean;
  item: HoldingReviewItem;
  masked: boolean;
  onPress: () => void;
  onSellRedeem?: (assetId: string) => void;
}) {
  const { holding } = item;
  const positive = holding.unrealisedPnL >= 0;

  return (
    <Pressable
      accessibilityHint={expanded ? "Collapses position details" : "Shows position details"}
      accessibilityLabel={`${holding.asset.name}, ${formatPercentage(holding.unrealisedPnLPct)} return`}
      accessibilityRole="button"
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
            masked={masked}
            value={formatCompactINR(holding.currentValue)}
            weight="bold"
          />
          <AppText
            align="right"
            style={positive ? styles.positiveText : styles.negativeText}
            variant="caption"
            weight="bold"
          >
            {formatPercentage(holding.unrealisedPnLPct)}
          </AppText>
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
          Alloc. {item.allocationPct.toFixed(2)}%
        </AppText>
      </View>

      {expanded ? (
        <View
          style={styles.expandedSection}
          testID={`holding-expanded-${holding.asset.id}`}
        >
          <View style={styles.detailGrid}>
            <Detail label="Quantity" value={formatQuantity(holding.totalUnits)} />
            <Detail
              label="Avg cost"
              masked={masked}
              value={formatCompactINR(holding.averageCostPrice)}
            />
            <Detail
              label="Current price"
              masked={masked}
              value={formatCompactINR(holding.currentPrice)}
            />
            <Detail
              label="P&L"
              masked={masked}
              tone={positive ? "positive" : "negative"}
              value={formatSignedCompactINR(holding.unrealisedPnL)}
            />
          </View>

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

          <View style={styles.sourceRow}>
            <View>
              <AppText color="secondary" variant="caption">
                Price source
              </AppText>
              <AppText variant="caption" weight="bold">
                {formatSource(holding.quoteSource)}
              </AppText>
            </View>
            <AppText color="secondary" align="right" variant="caption">
              {holding.lastUpdated
                ? `Updated ${formatDate(holding.lastUpdated)}`
                : "Local position price"}
            </AppText>
          </View>

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
  tone,
  value,
}: {
  label: string;
  masked?: boolean;
  tone?: "negative" | "positive";
  value: string;
}) {
  return (
    <View style={styles.detail}>
      <AppText color="secondary" variant="caption">
        {label}
      </AppText>
      <MaskedValue
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
        weight="bold"
      />
    </View>
  );
}

function getFilterCounts(items: HoldingReviewItem[]) {
  return {
    all: items.length,
    "high-allocation": items.filter((item) => item.allocationPct >= 10).length,
    losers: items.filter((item) => item.holding.unrealisedPnL < 0).length,
    winners: items.filter((item) => item.holding.unrealisedPnL >= 0).length,
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
    humanize(item.holding.asset.instrumentType ?? "other"),
    humanize(item.holding.asset.sectorType ?? "other"),
  ].join(" · ");
}

function humanize(value: string) {
  const spaced = value.replace(/([a-z])([A-Z])/g, "$1 $2");

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
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
    backgroundColor: colors.deepGreen,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
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
    minHeight: 102,
  },
  insightGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  insightTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  legendCopy: {
    gap: 1,
  },
  legendDot: {
    borderRadius: radii.pill,
    height: 8,
    marginTop: 4,
    width: 8,
  },
  legendItem: {
    alignItems: "flex-start",
    flexBasis: "42%",
    flexGrow: 1,
    flexDirection: "row",
    gap: spacing.xs,
    minWidth: 126,
  },
  negativeText: {
    color: colors.loss,
  },
  positiveText: {
    color: colors.profit,
  },
  sectionHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sourceRow: {
    alignItems: "flex-end",
    borderTopColor: colors.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.md,
  },
  topThree: {
    alignItems: "flex-end",
  },
  valueColumn: {
    alignItems: "flex-end",
    minWidth: 72,
  },
});
