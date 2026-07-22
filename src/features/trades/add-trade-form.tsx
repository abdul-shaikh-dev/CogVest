import { Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import { DatePickerField, FormTextField } from "@/src/components/forms";
import { colors, interaction, radii, spacing } from "@/src/theme";
import type { ConvictionScore, InstrumentType, SectorType } from "@/src/types";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { useAddTrade } from "./useAddTrade";

type AddTradeFormProps = {
  now?: Date;
  store?: StoreApi<PortfolioStoreState>;
};

const convictionScores: ConvictionScore[] = [1, 2, 3, 4, 5];

export function AddTradeForm({
  now = new Date(),
  store = getPortfolioStore(),
}: AddTradeFormProps) {
  const trade = useAddTrade({ now, store });

  return (
    <ScreenContainer scroll testID="add-trade-screen">
      <View testID="add-holding-screen">
        <ScreenHeader
          title="Add Holding"
          subtitle="Portfolio entry • local only"
        />
      </View>

      <View style={styles.segmentedControl}>
        {(["buy", "sell"] as const).map((tradeType) => (
          <Pressable
            accessibilityRole="button"
            key={tradeType}
            onPress={() => trade.updateType(tradeType)}
            style={({ pressed }) => [
              styles.segment,
              trade.type === tradeType && styles.segmentActive,
              pressed && styles.pressed,
            ]}
          >
            <AppText
              color={trade.type === tradeType ? "inverse" : "secondary"}
              weight="bold"
            >
              {tradeType === "buy" ? "Buy" : "Sell"}
            </AppText>
          </Pressable>
        ))}
      </View>

      {trade.snapshot.assets.length > 0 ? (
        <PremiumCard>
          <AppText color="secondary" variant="caption" weight="medium">
            Existing assets
          </AppText>
          <View style={styles.assetGrid}>
            {trade.snapshot.assets.map((asset) => (
              <Pressable
                key={asset.id}
                onPress={() => trade.selectAsset(asset)}
                style={({ pressed }) => [
                  styles.assetChip,
                  trade.selectedAssetId === asset.id && styles.assetChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <AppText weight="bold">{asset.symbol}</AppText>
                <AppText color="secondary" variant="caption">
                  {asset.name}
                </AppText>
              </Pressable>
            ))}
          </View>
        </PremiumCard>
      ) : null}

      <PremiumCard>
        <SectionHeader title="Asset" />
        <FormTextField
          error={trade.errors.assetName}
          label="Asset name"
          onChangeText={(value) => {
            trade.setAssetName(value);
            trade.clearSelectedAsset();
          }}
          placeholder="Reliance Industries"
          testID="asset-input"
          value={trade.assetName}
        />
        <View style={styles.row}>
          <View style={styles.flex}>
            <FormTextField
              error={trade.errors.symbol}
              label="Symbol"
              onChangeText={(value) => {
                trade.setSymbol(value);
                trade.clearSelectedAsset();
              }}
              placeholder="RELIANCE"
              testID="symbol-input"
              value={trade.symbol}
            />
          </View>
          <View style={styles.flex}>
            <FormTextField
              error={trade.errors.ticker}
              label="Ticker"
              onChangeText={(value) => {
                trade.setTicker(value);
                trade.clearSelectedAsset();
              }}
              placeholder="RELIANCE.NS"
              testID="ticker-input"
              value={trade.ticker}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <FormTextField
              error={trade.errors.instrumentType}
              label="Instrument type"
              onChangeText={(value) => {
                trade.setInstrumentType(value as InstrumentType);
                trade.clearSelectedAsset();
              }}
              placeholder="stock"
              testID="instrument-type-input"
              value={trade.instrumentType}
            />
          </View>
          <View style={styles.flex}>
            <FormTextField
              error={trade.errors.sectorType}
              label="Sector type"
              onChangeText={(value) => {
                trade.setSectorType(value as SectorType);
                trade.clearSelectedAsset();
              }}
              placeholder="financialServices"
              testID="sector-type-input"
              value={trade.sectorType}
            />
          </View>
        </View>
        <FormTextField
          label="Quote source ID"
          onChangeText={(value) => {
            trade.setQuoteSourceId(value);
            trade.clearSelectedAsset();
          }}
          placeholder="RELIANCE.NS"
          testID="quote-source-id-input"
          value={trade.quoteSourceId}
        />
      </PremiumCard>

      <PremiumCard>
        <SectionHeader title="Position Details" />
        <View style={styles.row}>
          <View style={styles.flex}>
            <FormTextField
              error={trade.errors.quantity}
              keyboardType="decimal-pad"
              label="Quantity"
              onChangeText={(value) => {
                trade.setQuantity(value);
              }}
              placeholder="2"
              testID="quantity-input"
              value={trade.quantity}
            />
          </View>
          <View style={styles.flex}>
            <FormTextField
              error={trade.errors.pricePerUnit}
              keyboardType="decimal-pad"
              label="Price per unit"
              onChangeText={(value) => {
                trade.setPricePerUnit(value);
              }}
              placeholder="100"
              testID="price-input"
              value={trade.pricePerUnit}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <FormTextField
              error={trade.errors.fees}
              keyboardType="decimal-pad"
              label="Fees"
              onChangeText={(value) => {
                trade.setFees(value);
              }}
              placeholder="0"
              value={trade.fees}
            />
          </View>
          <View style={styles.flex}>
            <DatePickerField
              error={trade.errors.date}
              label="Trade date"
              maximumDate={now}
              onChange={(value) => {
                trade.setDate(value);
              }}
              testID="trade-date-input"
              value={trade.date}
            />
          </View>
        </View>
        <View style={styles.convictionGroup}>
          <AppText color="secondary" variant="caption" weight="medium">
            Conviction
          </AppText>
          <View style={styles.convictionRow}>
            {convictionScores.map((score) => {
              const scoreValue = score.toString();
              const isSelected = trade.conviction === scoreValue;

              return (
                <Pressable
                  accessibilityLabel={`Conviction ${score}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={score}
                  onPress={() => {
                    trade.setConviction(isSelected ? "" : scoreValue);
                  }}
                  style={({ pressed }) => [
                    styles.convictionChip,
                    isSelected && styles.convictionChipActive,
                    pressed && styles.pressed,
                  ]}
                  testID={`conviction-${score}`}
                >
                  <AppText
                    color={isSelected ? "inverse" : "secondary"}
                    weight="bold"
                  >
                    {score}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          {trade.errors.conviction ? (
            <AppText selectable style={styles.errorText} variant="caption">
              {trade.errors.conviction}
            </AppText>
          ) : null}
        </View>
        <FormTextField
          label="Note"
          multiline
          onChangeText={(value) => {
            trade.setNotes(value);
          }}
          placeholder="Optional note"
          value={trade.notes}
        />
      </PremiumCard>

      {trade.reviewTrade && trade.reviewAsset ? (
        <PremiumCard elevated>
          <AppText variant="body" weight="bold">
            Derived preview
          </AppText>
          <AppText color="secondary">
            {trade.reviewAsset.symbol} · {trade.reviewTrade.quantity} units @ ₹
            {trade.reviewTrade.pricePerUnit.toFixed(2)}
          </AppText>
          <AppText selectable weight="bold">
            Total: ₹{trade.reviewTrade.totalValue.toFixed(2)}
          </AppText>
        </PremiumCard>
      ) : null}

      {trade.successMessage ? (
        <AppText selectable style={styles.successText}>
          {trade.successMessage}
        </AppText>
      ) : null}

      {trade.errors.cash ? (
        <AppText selectable style={styles.errorText} variant="caption">
          {trade.errors.cash}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        <AppButton
          title="Review Holding"
          testID="review-trade-button"
          onPress={trade.handleReview}
        />
        <AppButton
          disabled={!trade.reviewTrade}
          testID="save-trade-button"
          title="Save Holding"
          onPress={trade.handleConfirm}
          variant="secondary"
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  assetChip: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.card,
    gap: spacing.xs,
    padding: spacing.cardInner,
    width: "48%",
  },
  assetChipActive: {
    backgroundColor: colors.deepGreen,
  },
  assetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  convictionChip: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  convictionChipActive: {
    backgroundColor: colors.primary,
  },
  convictionGroup: {
    gap: spacing.xs,
  },
  convictionRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  errorText: {
    color: colors.loss,
  },
  flex: {
    flex: 1,
  },
  header: {
    gap: spacing.xs,
  },
  pressed: {
    opacity: interaction.pressedOpacity,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  segment: {
    alignItems: "center",
    borderRadius: radii.pill,
    flex: 1,
    paddingVertical: spacing.cardInner,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentedControl: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.pill,
    flexDirection: "row",
    padding: spacing.xs,
  },
  successText: {
    color: colors.profit,
  },
});
