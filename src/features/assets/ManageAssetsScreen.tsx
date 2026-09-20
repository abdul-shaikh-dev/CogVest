import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useState, useSyncExternalStore } from "react";
import { Ionicons } from "@expo/vector-icons";
import type { StoreApi } from "zustand/vanilla";

import {
  AppText,
  CategoryIcon,
  EmptyState,
  IconButton,
  PremiumCard,
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
import { colors, radii, spacing } from "@/src/theme";

type ManageAssetsScreenProps = {
  onBack: () => void;
  onReviewAsset: (assetId: string) => void;
  store?: StoreApi<PortfolioStoreState>;
};

function remainingUnits(
  state: PortfolioStoreState,
  assetId: string,
  demergerAdjustments: readonly DemergerAdjustment[],
) {
  const assetOpenings = state.openingPositions.filter(
    (position) => position.assetId === assetId,
  );
  const trades = state.trades
    .filter(
      (trade) =>
        trade.assetId === assetId &&
        isTransactionAfterOpeningCutover(trade.date, assetOpenings),
    );

  try {
    return normalizeQuantity(positionQuantity({
      openingPositions: assetOpenings,
      trades,
      stockSplits: state.assets.find((asset) => asset.id === assetId)?.stockSplits,
      demergerAdjustments,
    }));
  } catch (error) {
    if (!(error instanceof StockSplitError)) throw error;
    return null;
  }
}

export function ManageAssetsScreen({
  onBack,
  onReviewAsset,
  store = getPortfolioStore(),
}: ManageAssetsScreenProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const demergerAdjustments = projectDemergers({
    assets: snapshot.assets,
    openingPositions: snapshot.openingPositions,
    trades: snapshot.trades,
  });
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
          subtitle="Identity and classification"
        />
        {snapshot.assets.length > 0 ? <View style={styles.searchField}>
          <Ionicons accessible={false} name="search-outline" size={20} color={colors.text.secondary} />
          <TextInput
            accessibilityLabel="Search assets"
            onChangeText={setSearchQuery}
            placeholder="Search name, symbol, ticker, or ISIN"
            placeholderTextColor={colors.text.secondary}
            style={styles.searchInput}
            testID="manage-assets-search-input"
            value={searchQuery}
          />
        </View> : null}
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="always" testID="manage-assets-list-scroll">
        <AppText color="secondary" variant="caption">
          Correct asset details here. Positions and transactions keep their stable links.
        </AppText>

        {snapshot.assets.length === 0 ? (
          <EmptyState
            actionLabel="Back to Holdings"
            message="Add a holding before managing its asset details."
            onAction={onBack}
            title="No assets yet"
          />
        ) : visibleAssets.length === 0 ? (
          <EmptyState
            message={`No asset identity matches “${searchQuery.trim()}”. Try a name, symbol, ticker, or ISIN.`}
            title="No matching assets"
          />
        ) : (
          <>
          <AppText color="secondary" testID="manage-assets-result-count" variant="caption">
            {visibleAssets.length === snapshot.assets.length
              ? `${snapshot.assets.length} ${snapshot.assets.length === 1 ? "asset" : "assets"}`
              : `${visibleAssets.length} of ${snapshot.assets.length} assets`}
          </AppText>
          <PremiumCard style={styles.list}>
            {visibleAssets.map((asset, index) => {
              const units = remainingUnits(
                snapshot,
                asset.id,
                demergerAdjustments.filter((adjustment) => adjustment.assetId === asset.id),
              );
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
                  key={asset.id}
                  onPress={() => onReviewAsset(asset.id)}
                  style={({ pressed }) => [
                    styles.row,
                    index < visibleAssets.length - 1 && styles.divider,
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
                    <AppText color="secondary" variant="caption">
                      {instrumentTypeLabel(asset.instrumentType ?? "other")} · {assetClassLabel(asset.assetClass)}
                    </AppText>
                  </View>
                  <View style={[styles.status, isActive ? styles.active : styles.closed]}>
                    <AppText color={isActive ? "primary" : "secondary"} variant="caption" weight="bold">
                      {units === null ? "Unavailable" : isActive ? "Active" : "Closed"}
                    </AppText>
                  </View>
                  <AppText color="secondary">›</AppText>
                </Pressable>
              );
            })}
          </PremiumCard>
          </>
        )}
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  active: { backgroundColor: "rgba(52,199,89,0.12)" },
  closed: { backgroundColor: colors.surface.elevated },
  content: { gap: spacing.cardGap, paddingBottom: spacing.xl },
  copy: { flex: 1, gap: spacing.xs },
  divider: { borderBottomColor: colors.border.subtle, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { alignItems: "center", justifyContent: "center", width: 32 },
  list: { paddingHorizontal: spacing.md, paddingVertical: 0 },
  row: { alignItems: "center", flexDirection: "row", gap: spacing.sm, minHeight: 72, paddingVertical: spacing.sm },
  screen: { flex: 1, gap: spacing.md },
  searchField: { alignItems: "center", backgroundColor: colors.surface.card, borderRadius: radii.button, flexDirection: "row", gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.md },
  searchInput: { color: colors.text.primary, flex: 1, minHeight: 48, paddingVertical: spacing.sm },
  status: { borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
});
