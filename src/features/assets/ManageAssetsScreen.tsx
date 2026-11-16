import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { memo, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import type { StoreApi } from "zustand/vanilla";

import {
  AppText,
  CategoryIcon,
  EmptyState,
  IconButton,
  ScreenContainer,
  ScreenHeader,
  assetClassLabel,
  getPressedStateStyle,
} from "@/src/components/common";
import { instrumentTypeLabel } from "@/src/domain/assets";
import {
  decimal,
  normalizeQuantity,
  quantityQuantum,
} from "@/src/domain/precision";
import { positionQuantity, StockSplitError } from "@/src/domain/stockSplits";
import { projectDemergers } from "@/src/domain/demergers";
import type { DemergerAdjustment } from "@/src/domain/demergerEvents";
import { isTransactionAfterOpeningCutover } from "@/src/domain/openingPositions";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import type { Asset, OpeningPosition, Trade } from "@/src/types";
import { radii, spacing, useTheme, createThemedStyles } from "@/src/theme";
import { usePortfolioFields } from "@/src/hooks";

type ManageAssetsScreenProps = {
  onBack: () => void;
  onReviewAsset: (assetId: string) => void;
  store?: StoreApi<PortfolioStoreState>;
};

function groupByAsset<Item extends { assetId: string }>(items: readonly Item[]) {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const group = groups.get(item.assetId);
    if (group) group.push(item);
    else groups.set(item.assetId, [item]);
  }
  return groups;
}

/**
 * Remaining units for every asset, worked out once per record change rather
 * than per asset and per search keystroke (#664). Null when a stock split
 * leaves the quantity unknown.
 */
function remainingUnitsByAsset(
  state: Pick<PortfolioStoreState, "assets" | "openingPositions" | "trades">,
) {
  const demergerAdjustments = groupByAsset(projectDemergers({
    assets: state.assets,
    openingPositions: state.openingPositions,
    trades: state.trades,
  }));
  const openingsByAsset = groupByAsset<OpeningPosition>(state.openingPositions);
  const tradesByAsset = groupByAsset<Trade>(state.trades);
  return new Map(state.assets.map((asset) => [asset.id, remainingUnits(
    asset,
    openingsByAsset.get(asset.id) ?? [],
    tradesByAsset.get(asset.id) ?? [],
    demergerAdjustments.get(asset.id) ?? [],
  )]));
}

function remainingUnits(
  asset: Asset,
  assetOpenings: OpeningPosition[],
  assetTrades: readonly Trade[],
  demergerAdjustments: readonly DemergerAdjustment[],
) {
  const trades = assetTrades.filter((trade) =>
    isTransactionAfterOpeningCutover(trade.date, assetOpenings));

  try {
    return normalizeQuantity(positionQuantity({
      openingPositions: assetOpenings,
      trades,
      stockSplits: asset.stockSplits,
      demergerAdjustments,
    }));
  } catch (error) {
    if (!(error instanceof StockSplitError)) throw error;
    return null;
  }
}

/** The space between rows, and above the first and below the last, as in the section card it replaces. */
function RowGap() {
  const styles = useStyles();
  return <View style={styles.rowGap} />;
}

const ManageAssetRow = memo(function ManageAssetRow({
  asset,
  isLast,
  onReviewAsset,
  units,
}: {
  asset: Asset;
  isLast: boolean;
  onReviewAsset: (assetId: string) => void;
  units: string | number | null;
}) {
  const styles = useStyles();
  const isActive = units !== null && decimal(units).greaterThanOrEqualTo(quantityQuantum);
  const status = units === null ? "Unavailable quantity" : isActive ? "Active" : "Closed";
  const identity = [...new Set([
    asset.symbol,
    asset.ticker && asset.ticker !== asset.symbol ? asset.ticker : undefined,
    asset.isin,
  ].filter((value): value is string => Boolean(value)))].join(" · ");
  return (
    <Pressable
      accessibilityHint="Opens asset details and deletion impact"
      accessibilityLabel={`Review ${asset.name}, ${identity || "no market identifier"}, ${instrumentTypeLabel(asset.instrumentType ?? "other")}, ${assetClassLabel(asset.assetClass)}, ${status}`}
      accessibilityRole="button"
      onPress={() => onReviewAsset(asset.id)}
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.divider,
        getPressedStateStyle({ pressed }),
      ]}
      testID={`manage-asset-${asset.id}`}
    >
      <View style={styles.icon}>
        <CategoryIcon assetClass={asset.assetClass} size={20} />
      </View>
      <View style={styles.copy}>
        <AppText testID={`manage-asset-name-${asset.id}`} weight="bold">{asset.name}</AppText>
        <AppText color="secondary" variant="caption">
          {identity || "No market identifier"}
        </AppText>
        <View style={styles.classification}>
          <AppText color="secondary" variant="caption" style={styles.classificationCopy}>
            {[...new Set([instrumentTypeLabel(asset.instrumentType ?? "other"), assetClassLabel(asset.assetClass)])].join(" · ")}
          </AppText>
          <View style={[styles.status, isActive ? styles.active : styles.closed]}>
            <AppText color={isActive ? "primary" : "secondary"} variant="caption" weight="bold">
              {units === null ? "Unavailable" : isActive ? "Active" : "Closed"}
            </AppText>
          </View>
        </View>
      </View>
      <AppText color="secondary">›</AppText>
    </Pressable>
  );
});

export function ManageAssetsScreen({
  onBack,
  onReviewAsset,
  store = getPortfolioStore(),
}: ManageAssetsScreenProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const snapshot = usePortfolioFields(store, ["assets", "openingPositions", "trades"]);
  const unitsByAsset = useMemo(() => remainingUnitsByAsset(snapshot), [snapshot]);
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const visibleAssets = normalizedQuery
    ? snapshot.assets.filter((asset) => [
        asset.name,
        asset.symbol,
        asset.ticker,
        asset.isin,
        asset.exchange,
      ].filter((value): value is string => Boolean(value)).some((value) => value.toLocaleLowerCase().includes(normalizedQuery)))
    : snapshot.assets;

  return (
    <ScreenContainer testID="manage-assets-screen">
      <View style={styles.screen}>
        <ScreenHeader
          leading={<IconButton accessibilityLabel="Back to Holdings" icon="chevron-back" onPress={onBack} testID="manage-assets-back" />}
          title="Manage Assets"
          subtitle="Asset details and categories"
        />
        {snapshot.assets.length > 0 ? <View style={styles.searchField}>
          <Ionicons accessible={false} name="search-outline" size={20} color={colors.text.secondary} />
          <TextInput
            accessibilityLabel="Search assets"
            onChangeText={setSearchQuery}
            placeholder="Search assets"
            placeholderTextColor={colors.text.secondary}
            style={styles.searchInput}
            testID="manage-assets-search-input"
            value={searchQuery}
          />
        </View> : null}
        {snapshot.assets.length === 0 ? (
          <EmptyState
            actionLabel="Back to Holdings"
            message="Add a holding before managing its asset details."
            onAction={onBack}
            title="No assets yet"
          />
        ) : (
          <FlatList
            ItemSeparatorComponent={RowGap}
            ListEmptyComponent={(
              <EmptyState
                message={`No asset identity matches “${searchQuery.trim()}”. Try a name, symbol, ticker, or ISIN.`}
                title="No matching assets"
              />
            )}
            ListFooterComponent={visibleAssets.length > 0 ? RowGap : undefined}
            ListHeaderComponent={visibleAssets.length > 0 ? (
              <AppText color="secondary" style={styles.resultCount} testID="manage-assets-result-count" variant="caption">
                {visibleAssets.length === snapshot.assets.length
                  ? `${snapshot.assets.length} ${snapshot.assets.length === 1 ? "asset" : "assets"}`
                  : `${visibleAssets.length} of ${snapshot.assets.length} assets`}
              </AppText>
            ) : undefined}
            contentContainerStyle={styles.content}
            data={visibleAssets}
            initialNumToRender={12}
            keyExtractor={(asset) => asset.id}
            keyboardShouldPersistTaps="always"
            renderItem={({ index, item }) => (
              <ManageAssetRow
                asset={item}
                isLast={index === visibleAssets.length - 1}
                onReviewAsset={onReviewAsset}
                units={unitsByAsset.get(item.id) ?? null}
              />
            )}
            testID="manage-assets-list-scroll"
            windowSize={7}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  active: { backgroundColor: colors.selected },
  closed: { backgroundColor: colors.surface.elevated },
  content: { paddingBottom: spacing.xl },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
  classification: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  classificationCopy: { flexShrink: 1 },
  divider: { borderBottomColor: colors.border.subtle, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { alignItems: "center", justifyContent: "center", width: 32 },
  resultCount: { marginBottom: spacing.cardGap },
  row: { alignItems: "center", flexDirection: "row", gap: spacing.sm, minHeight: 72, paddingHorizontal: spacing.xs, paddingVertical: spacing.sm },
  rowGap: { height: spacing.md },
  screen: { flex: 1, gap: spacing.md },
  searchField: { alignItems: "center", backgroundColor: colors.surface.card, borderRadius: radii.button, flexDirection: "row", gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.md },
  searchInput: { color: colors.text.primary, flex: 1, minHeight: 48, paddingVertical: spacing.sm },
  status: { borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
}));
