import { memo } from "react";
import { TouchableOpacity, View, StyleSheet } from "react-native";
import { AppText, assetClassLabel } from "@/src/components/common";
import {
  getDefaultAssetMetadata,
  instrumentTypeLabel,
} from "@/src/domain/assets";
import type { Asset } from "@/src/types";
import { colors, interaction, spacing } from "@/src/theme";
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
    <View style={styles.copy}>
      <AppText weight="bold">{result.name}</AppText>
      <AppText variant="caption" testID={`asset-lookup-instrument-${result.id}`}>
        <AppText variant="caption" weight="bold">{instrument}</AppText>
        {" • "}
        <AppText color="secondary" variant="caption" testID={`asset-lookup-venue-${result.id}`}>{venue}</AppText>
      </AppText>
      <AppText color="secondary" variant="caption">{[...new Set([result.symbol, result.ticker]), result.currency].join(" • ")}</AppText>
      <AppText color="secondary" variant="caption">{result.sourceLabel}</AppText>
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
    <View style={styles.savedCopy}>
      <AppText weight="bold">{asset.name}</AppText>
      <AppText variant="caption" testID={`saved-asset-instrument-${asset.id}`}>
        <AppText variant="caption" weight="bold">{instrument}</AppText>
        {" • "}
        <AppText color="secondary" variant="caption" testID={`saved-asset-venue-${asset.id}`}>{venue}</AppText>
      </AppText>
      <AppText color="secondary" variant="caption">{[...new Set([asset.symbol, asset.ticker ?? assetClassLabel(asset.assetClass)]), asset.currency].join(" • ")}</AppText>
    </View>
    <AppText color="secondary" variant="caption" weight="bold">Use</AppText>
  </TouchableOpacity>;
});

const styles = StyleSheet.create({
  savedRow: { alignItems: "flex-start", borderBottomColor: colors.border.subtle,
    borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: spacing.sm,
    minHeight: interaction.minimumTouchTarget, paddingVertical: spacing.sm },
  savedCopy: { flex: 1, gap: spacing.xs, minWidth: 0 },
  row: { alignItems: "flex-start", borderBottomColor: colors.border.subtle, borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm, minHeight: 56 },
  copy: { flex: 1, gap: spacing.xs, minWidth: 0 },
});
