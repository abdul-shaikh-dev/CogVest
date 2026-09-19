import { memo } from "react";
import { TouchableOpacity, View, StyleSheet } from "react-native";
import { AppText, CategoryIcon, assetClassLabel } from "@/src/components/common";
import {
  getDefaultAssetMetadata,
  instrumentTypeLabel,
} from "@/src/domain/assets";
import type { Asset } from "@/src/types";
import { colors, interaction, radii, spacing } from "@/src/theme";
import type { AssetLookupResult } from "@/src/services/assetLookup";

function resultInstrumentLabel(result: Pick<AssetLookupResult, "instrumentType">) {
  if (result.instrumentType === "stock") return "Company share";
  if (result.instrumentType === "crypto") return "Crypto asset";
  return instrumentTypeLabel(result.instrumentType);
}

function venueLabel(exchange: AssetLookupResult["exchange"]) {
  if (exchange === "NSE" || exchange === "BSE") return `${exchange} listing`;
  if (exchange === "CRYPTO") return "Not an NSE/BSE share";
  return "No exchange listing";
}

function savedInstrumentLabel(asset: Asset) {
  const instrumentType = asset.instrumentType ??
    getDefaultAssetMetadata(asset.assetClass).instrumentType;

  if (instrumentType === "stock") return "Company share";
  if (instrumentType === "crypto") return "Crypto asset";
  return instrumentTypeLabel(instrumentType);
}

// Keep already-visible rows stable while another page is appended.
export const DiscoveryResultRow = memo(function DiscoveryResultRow({ result, onSelect }: {
  result: AssetLookupResult;
  onSelect: (result: AssetLookupResult) => void;
}) {
  const instrument = resultInstrumentLabel(result);
  const venue = venueLabel(result.exchange);

  return <TouchableOpacity accessibilityLabel={`Select ${result.name}. ${instrument}. ${venue}. ${result.symbol}.`} accessibilityRole="button"
    activeOpacity={0.74} onPress={() => onSelect(result)} style={styles.row}
    testID={`asset-lookup-result-${result.id}`}>
    <CategoryIcon assetClass={result.assetClass} size={18} />
    <View style={styles.copy}>
      <View style={styles.identityBadges}>
        <View style={styles.badge} testID={`asset-lookup-instrument-${result.id}`}>
          <AppText variant="caption" weight="bold">{instrument}</AppText>
        </View>
        <View style={styles.badge} testID={`asset-lookup-venue-${result.id}`}>
          <AppText color="secondary" variant="caption" weight="bold">{venue}</AppText>
        </View>
      </View>
      <AppText weight="bold">{result.name}</AppText>
      <AppText color="secondary" variant="caption">{result.symbol} • {result.ticker} • {result.currency}</AppText>
      <AppText color="secondary" variant="caption">Price identity: {result.sourceLabel}</AppText>
    </View>
    <AppText color="secondary" variant="caption" weight="bold">Select</AppText>
  </TouchableOpacity>;
});

export const SavedAssetRow = memo(function SavedAssetRow({ asset, onSelect }: {
  asset: Asset;
  onSelect: (asset: Asset) => void;
}) {
  const instrument = savedInstrumentLabel(asset);
  const venue = venueLabel(asset.exchange);

  return <TouchableOpacity accessibilityLabel={`Use ${asset.name}. Saved ${instrument}. ${venue}. ${asset.symbol}.`} accessibilityRole="button"
    activeOpacity={0.74} onPress={() => onSelect(asset)} style={styles.savedRow}
    testID={`existing-asset-${asset.id}`}>
    <CategoryIcon assetClass={asset.assetClass} size={18} />
    <View style={styles.savedCopy}>
      <View style={styles.identityBadges}>
        <View style={styles.badge} testID={`saved-asset-instrument-${asset.id}`}>
          <AppText variant="caption" weight="bold">{instrument}</AppText>
        </View>
        <View style={styles.badge} testID={`saved-asset-venue-${asset.id}`}>
          <AppText color="secondary" variant="caption" weight="bold">{venue}</AppText>
        </View>
      </View>
      <AppText weight="bold">{asset.name}</AppText>
      <AppText color="secondary" variant="caption">{asset.symbol} • {asset.ticker ?? assetClassLabel(asset.assetClass)} • {asset.currency}</AppText>
    </View>
    <AppText color="secondary" variant="caption" weight="bold">Use</AppText>
  </TouchableOpacity>;
});

const styles = StyleSheet.create({
  savedRow: { alignItems: "flex-start", backgroundColor: colors.surface.card,
    borderColor: colors.border.subtle, borderRadius: radii.button,
    borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: spacing.sm,
    minHeight: interaction.minimumTouchTarget, padding: spacing.sm },
  savedCopy: { flex: 1, gap: spacing.xs },
  row: { alignItems: "flex-start", borderColor: colors.border.subtle, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.button, flexDirection: "row", gap: spacing.sm, padding: spacing.sm, minHeight: 56 },
  copy: { flex: 1, gap: spacing.xs, minWidth: 0 },
  identityBadges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  badge: { backgroundColor: colors.surface.elevated, borderColor: colors.border.subtle,
    borderRadius: radii.pill, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm, paddingVertical: 2 },
});
