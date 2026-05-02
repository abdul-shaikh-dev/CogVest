import * as Haptics from "expo-haptics";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { AppButton, AppText, ScreenContainer } from "@/src/components/common";
import { FormTextField } from "@/src/components/forms";
import { validateTradeForm } from "@/src/features/trades/tradeForm";
import { colors, interaction, radii, spacing } from "@/src/theme";
import type { Asset, ConvictionScore, Trade, TradeType } from "@/src/types";
import { createId } from "@/src/utils";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";

type AddTradeFormProps = {
  store?: StoreApi<PortfolioStoreState>;
};

type FieldErrors = Partial<Record<string, string>>;

const manualAssetId = "__manual_asset__";
const convictionScores: ConvictionScore[] = [1, 2, 3, 4, 5];

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function AddTradeForm({ store = getPortfolioStore() }: AddTradeFormProps) {
  const snapshot = usePortfolioSnapshot(store);
  const [type, setType] = useState<TradeType>("buy");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [assetName, setAssetName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [fees, setFees] = useState("");
  const [date, setDate] = useState(todayInputValue());
  const [conviction, setConviction] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [reviewTrade, setReviewTrade] = useState<Trade | undefined>();
  const [reviewAsset, setReviewAsset] = useState<Asset | undefined>();
  const [successMessage, setSuccessMessage] = useState("");

  const selectedAsset = useMemo(
    () => snapshot.assets.find((asset) => asset.id === selectedAssetId),
    [selectedAssetId, snapshot.assets],
  );
  const isManualAsset = !selectedAsset;

  function resetReview() {
    setReviewTrade(undefined);
    setReviewAsset(undefined);
    setSuccessMessage("");
  }

  function updateType(nextType: TradeType) {
    setType(nextType);
    resetReview();
  }

  function selectAsset(asset: Asset) {
    const quote = snapshot.quoteCache[asset.id];

    setSelectedAssetId(asset.id);
    setAssetName(asset.name);
    setSymbol(asset.symbol);
    setTicker(asset.ticker);
    if (quote) {
      setPricePerUnit(quote.price.toString());
    }
    resetReview();
  }

  function buildManualAsset(): Asset {
    return {
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: createId("asset"),
      name: assetName.trim(),
      symbol: symbol.trim().toUpperCase(),
      ticker: ticker.trim().toUpperCase(),
    };
  }

  function validateManualAsset() {
    const nextErrors: FieldErrors = {};

    if (isManualAsset && assetName.trim().length === 0) {
      nextErrors.assetName = "Asset name is required.";
    }

    if (isManualAsset && symbol.trim().length === 0) {
      nextErrors.symbol = "Symbol is required.";
    }

    if (isManualAsset && ticker.trim().length === 0) {
      nextErrors.ticker = "Ticker is required.";
    }

    if (type === "sell" && isManualAsset) {
      nextErrors.assetName = "Select an existing holding to sell.";
    }

    return nextErrors;
  }

  function handleReview() {
    resetReview();
    const manualErrors = validateManualAsset();
    const formAssetId = selectedAsset?.id ?? manualAssetId;
    const result = validateTradeForm(
      {
        assetId: formAssetId,
        conviction,
        date,
        pricePerUnit,
        quantity,
        type,
      },
      snapshot.trades,
    );

    if (!result.isValid || Object.keys(manualErrors).length > 0) {
      setErrors({
        ...manualErrors,
        ...result.isValid ? {} : result.errors,
      });
      return;
    }

    const asset = selectedAsset ?? buildManualAsset();
    const feeValue = fees.trim().length > 0 ? Number(fees) : 0;

    if (!Number.isFinite(feeValue) || feeValue < 0) {
      setErrors({ fees: "Fees must be zero or greater." });
      return;
    }

    const grossValue = result.value.quantity * result.value.pricePerUnit;
    const totalValue =
      result.value.type === "buy" ? grossValue + feeValue : grossValue - feeValue;

    setErrors({});
    setReviewAsset(asset);
    setReviewTrade({
      assetId: asset.id,
      conviction: result.value.conviction as ConvictionScore | undefined,
      date: result.value.date,
      fees: feeValue || undefined,
      id: createId("trade"),
      notes: notes.trim() || undefined,
      pricePerUnit: result.value.pricePerUnit,
      quantity: result.value.quantity,
      totalValue,
      type: result.value.type,
    });
  }

  async function handleConfirm() {
    if (!reviewTrade || !reviewAsset) {
      return;
    }

    if (!selectedAsset) {
      store.getState().addAsset(reviewAsset);
    }

    store.getState().addTrade(reviewTrade);
    store.getState().upsertQuote({
      asOf: new Date().toISOString(),
      assetId: reviewAsset.id,
      currency: "INR",
      price: reviewTrade.pricePerUnit,
      source: "manual",
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSuccessMessage("Trade logged.");
    setReviewTrade(undefined);
  }

  return (
    <ScreenContainer scroll testID="add-trade-screen">
      <View style={styles.header}>
        <AppText variant="title" weight="bold">
          Add Trade
        </AppText>
        <AppText color="secondary">
          Log a buy or sell in under a minute. Holdings stay local.
        </AppText>
      </View>

      <View style={styles.segmentedControl}>
        {(["buy", "sell"] as const).map((tradeType) => (
          <Pressable
            accessibilityRole="button"
            key={tradeType}
            onPress={() => updateType(tradeType)}
            style={({ pressed }) => [
              styles.segment,
              type === tradeType && styles.segmentActive,
              pressed && styles.pressed,
            ]}
          >
            <AppText
              color={type === tradeType ? "inverse" : "secondary"}
              weight="bold"
            >
              {tradeType === "buy" ? "Buy" : "Sell"}
            </AppText>
          </Pressable>
        ))}
      </View>

      {snapshot.assets.length > 0 ? (
        <View style={styles.card}>
          <AppText color="secondary" variant="caption" weight="medium">
            Existing assets
          </AppText>
          <View style={styles.assetGrid}>
            {snapshot.assets.map((asset) => (
              <Pressable
                key={asset.id}
                onPress={() => selectAsset(asset)}
                style={({ pressed }) => [
                  styles.assetChip,
                  selectedAssetId === asset.id && styles.assetChipActive,
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
        </View>
      ) : null}

      <View style={styles.card}>
        <AppText variant="body" weight="bold">
          Asset
        </AppText>
        <FormTextField
          error={errors.assetName}
          label="Asset name"
          onChangeText={(value) => {
            setAssetName(value);
            setSelectedAssetId("");
            resetReview();
          }}
          placeholder="Reliance Industries"
          testID="asset-input"
          value={assetName}
        />
        <View style={styles.row}>
          <View style={styles.flex}>
            <FormTextField
              error={errors.symbol}
              label="Symbol"
              onChangeText={(value) => {
                setSymbol(value);
                setSelectedAssetId("");
                resetReview();
              }}
              placeholder="RELIANCE"
              testID="symbol-input"
              value={symbol}
            />
          </View>
          <View style={styles.flex}>
            <FormTextField
              error={errors.ticker}
              label="Ticker"
              onChangeText={(value) => {
                setTicker(value);
                setSelectedAssetId("");
                resetReview();
              }}
              placeholder="RELIANCE.NS"
              testID="ticker-input"
              value={ticker}
            />
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <AppText variant="body" weight="bold">
          Trade details
        </AppText>
        <View style={styles.row}>
          <View style={styles.flex}>
            <FormTextField
              error={errors.quantity}
              keyboardType="decimal-pad"
              label="Quantity"
              onChangeText={(value) => {
                setQuantity(value);
                resetReview();
              }}
              placeholder="2"
              testID="quantity-input"
              value={quantity}
            />
          </View>
          <View style={styles.flex}>
            <FormTextField
              error={errors.pricePerUnit}
              keyboardType="decimal-pad"
              label="Price per unit"
              onChangeText={(value) => {
                setPricePerUnit(value);
                resetReview();
              }}
              placeholder="100"
              testID="price-input"
              value={pricePerUnit}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <FormTextField
              error={errors.fees}
              keyboardType="decimal-pad"
              label="Fees"
              onChangeText={(value) => {
                setFees(value);
                resetReview();
              }}
              placeholder="0"
              value={fees}
            />
          </View>
          <View style={styles.flex}>
            <FormTextField
              error={errors.date}
              label="Trade date"
              onChangeText={(value) => {
                setDate(value);
                resetReview();
              }}
              placeholder="YYYY-MM-DD"
              value={date}
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
              const isSelected = conviction === scoreValue;

              return (
                <Pressable
                  accessibilityLabel={`Conviction ${score}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={score}
                  onPress={() => {
                    setConviction(isSelected ? "" : scoreValue);
                    resetReview();
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
          {errors.conviction ? (
            <AppText selectable style={styles.errorText} variant="caption">
              {errors.conviction}
            </AppText>
          ) : null}
        </View>
        <FormTextField
          label="Note"
          multiline
          onChangeText={(value) => {
            setNotes(value);
            resetReview();
          }}
          placeholder="Optional note"
          value={notes}
        />
      </View>

      {reviewTrade && reviewAsset ? (
        <View style={styles.reviewCard}>
          <AppText variant="body" weight="bold">
            Review {reviewTrade.type}
          </AppText>
          <AppText color="secondary">
            {reviewAsset.symbol} · {reviewTrade.quantity} units @ ₹
            {reviewTrade.pricePerUnit.toFixed(2)}
          </AppText>
          <AppText selectable weight="bold">
            Total: ₹{reviewTrade.totalValue.toFixed(2)}
          </AppText>
        </View>
      ) : null}

      {successMessage ? (
        <AppText selectable style={styles.successText}>
          {successMessage}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        <AppButton
          title="Review Trade"
          testID="review-trade-button"
          onPress={handleReview}
        />
        <AppButton
          disabled={!reviewTrade}
          testID="save-trade-button"
          title="Confirm Trade"
          onPress={handleConfirm}
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
    borderColor: colors.border.subtle,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.cardInner,
    width: "48%",
  },
  assetChipActive: {
    borderColor: colors.primary,
  },
  assetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface.card,
    borderColor: colors.border.subtle,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.cardInner,
    padding: spacing.cardInner,
  },
  convictionChip: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderColor: colors.border.subtle,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  convictionChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
  reviewCard: {
    backgroundColor: colors.surface.elevated,
    borderColor: colors.primary,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.cardInner,
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
    borderColor: colors.border.subtle,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    padding: spacing.xs,
  },
  successText: {
    color: colors.profit,
  },
});
