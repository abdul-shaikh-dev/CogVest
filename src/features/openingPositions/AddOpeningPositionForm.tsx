import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  assetClassLabel,
  CategoryIcon,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import { FormTextField } from "@/src/components/forms";
import { getDefaultAssetMetadata } from "@/src/domain/assets";
import { calculateHolding } from "@/src/domain/calculations";
import { formatINR, formatPercentage } from "@/src/domain/formatters";
import {
  searchAssetLookupResults as defaultSearchAssetLookupResults,
  type AssetLookupResult,
  type AssetLookupSearchResult,
} from "@/src/services/assetLookup";
import {
  resolveQuote as defaultResolveQuote,
  type QuoteResult,
  type ResolveQuoteInput,
} from "@/src/services/quotes";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, interaction, radii, spacing } from "@/src/theme";
import type {
  Asset,
  AssetClass,
  ConvictionScore,
  InstrumentType,
  OpeningPosition,
  SectorType,
} from "@/src/types";
import { createId } from "@/src/utils";

import { validateOpeningPositionForm } from "./openingPositionForm";

type AddOpeningPositionFormProps = {
  resolveQuote?: (input: ResolveQuoteInput) => Promise<QuoteResult>;
  searchAssetLookupResults?: (input: {
    query: string;
  }) => Promise<AssetLookupSearchResult>;
  store?: StoreApi<PortfolioStoreState>;
};

type FieldErrors = Partial<Record<string, string>>;

const assetClasses: AssetClass[] = ["stock", "etf", "debt", "crypto"];
const convictionScores: ConvictionScore[] = [1, 2, 3, 4, 5];

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

function formatSignedINR(value: number) {
  const amount = formatINR(value);

  return value > 0 ? `+${amount}` : amount;
}

export function AddOpeningPositionForm({
  resolveQuote = defaultResolveQuote,
  searchAssetLookupResults = defaultSearchAssetLookupResults,
  store = getPortfolioStore(),
}: AddOpeningPositionFormProps) {
  const snapshot = usePortfolioSnapshot(store);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResults, setLookupResults] = useState<AssetLookupResult[]>([]);
  const [isLookupSearching, setIsLookupSearching] = useState(false);
  const [lookupStatus, setLookupStatus] = useState("");
  const [quoteStatus, setQuoteStatus] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [assetClass, setAssetClass] = useState<AssetClass>("stock");
  const [assetName, setAssetName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [ticker, setTicker] = useState("");
  const [instrumentType, setInstrumentType] = useState<InstrumentType>("stock");
  const [sectorType, setSectorType] = useState<SectorType>("financialServices");
  const [quoteSourceId, setQuoteSourceId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [averageCostPrice, setAverageCostPrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [date, setDate] = useState(todayInputValue());
  const [conviction, setConviction] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [reviewAsset, setReviewAsset] = useState<Asset | undefined>();
  const [reviewOpeningPosition, setReviewOpeningPosition] =
    useState<OpeningPosition | undefined>();
  const [successMessage, setSuccessMessage] = useState("");

  const selectedAsset = useMemo(
    () => snapshot.assets.find((asset) => asset.id === selectedAssetId),
    [selectedAssetId, snapshot.assets],
  );

  const previewHolding =
    reviewAsset && reviewOpeningPosition
      ? calculateHolding({
          asset: reviewAsset,
          currentPrice: reviewOpeningPosition.currentPrice ?? 0,
          openingPositions: [reviewOpeningPosition],
          trades: [],
        })
      : undefined;

  function resetReview() {
    setReviewAsset(undefined);
    setReviewOpeningPosition(undefined);
    setSuccessMessage("");
  }

  useEffect(() => {
    const trimmedQuery = lookupQuery.trim();

    if (trimmedQuery.length === 0) {
      setLookupResults([]);
      setLookupStatus("");
      setIsLookupSearching(false);
      return undefined;
    }

    if (trimmedQuery.length < 2) {
      setLookupResults([]);
      setLookupStatus("Type at least 2 characters to search.");
      setIsLookupSearching(false);
      return undefined;
    }

    let isCancelled = false;

    setIsLookupSearching(true);
    setLookupStatus("Searching public asset directories...");

    const timeout = setTimeout(async () => {
      try {
        const result = await searchAssetLookupResults({ query: trimmedQuery });

        if (isCancelled) {
          return;
        }

        setLookupResults(result.results);
        setLookupStatus(
          result.results.length > 0
            ? "Select a result to autofill asset details."
            : "No public result found. You can enter details manually.",
        );

        if (result.failures.length > 0 && result.results.length === 0) {
          setLookupStatus("Lookup unavailable. You can enter details manually.");
        }
      } catch {
        if (!isCancelled) {
          setLookupResults([]);
          setLookupStatus("Lookup unavailable. You can enter details manually.");
        }
      } finally {
        if (!isCancelled) {
          setIsLookupSearching(false);
        }
      }
    }, 350);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [lookupQuery, searchAssetLookupResults]);

  function clearSelectedAsset() {
    if (selectedAssetId) {
      setSelectedAssetId("");
    }
  }

  function selectAsset(asset: Asset) {
    const quote = snapshot.quoteCache[asset.id];

    setSelectedAssetId(asset.id);
    setAssetClass(asset.assetClass);
    setAssetName(asset.name);
    setInstrumentType(asset.instrumentType ?? getDefaultAssetMetadata(asset.assetClass).instrumentType);
    setQuoteSourceId(asset.quoteSourceId ?? asset.ticker);
    setSectorType(asset.sectorType ?? getDefaultAssetMetadata(asset.assetClass).sectorType);
    setSymbol(asset.symbol);
    setTicker(asset.ticker);
    if (quote) {
      setCurrentPrice(quote.price.toString());
    }
    resetReview();
  }

  function buildManualAsset(id: string): Asset {
    const trimmedTicker = ticker.trim();

    return {
      assetClass,
      currency: "INR",
      exchange: assetClass === "crypto" ? "CRYPTO" : "NSE",
      id,
      instrumentType,
      name: assetName.trim(),
      quoteSourceId: quoteSourceId.trim() || trimmedTicker,
      sectorType,
      symbol: symbol.trim().toUpperCase(),
      ticker: assetClass === "crypto" ? trimmedTicker : trimmedTicker.toUpperCase(),
    };
  }

  function buildLookupAsset(result: AssetLookupResult): Asset {
    return {
      assetClass: result.assetClass,
      currency: result.currency,
      exchange: result.exchange,
      id: createId("asset"),
      instrumentType: result.instrumentType,
      name: result.name,
      quoteSourceId: result.quoteSourceId,
      sectorType: result.sectorType,
      symbol: result.symbol,
      ticker: result.ticker,
    };
  }

  async function selectLookupResult(result: AssetLookupResult) {
    setSelectedAssetId("");
    setAssetClass(result.assetClass);
    setAssetName(result.name);
    setInstrumentType(result.instrumentType);
    setQuoteSourceId(result.quoteSourceId);
    setSectorType(result.sectorType);
    setSymbol(result.symbol);
    setTicker(result.ticker);
    setQuoteStatus("Fetching live current price...");
    resetReview();

    const quoteResult = await resolveQuote({ asset: buildLookupAsset(result) });

    if (quoteResult.ok) {
      setCurrentPrice(quoteResult.quote.price.toString());
      setQuoteStatus(`Live price autofilled from ${result.sourceLabel}.`);
      return;
    }

    setCurrentPrice("");
    setQuoteStatus("Live price unavailable. Enter current price manually.");
  }

  function updateAssetClass(nextAssetClass: AssetClass) {
    const defaults = getDefaultAssetMetadata(nextAssetClass);

    setAssetClass(nextAssetClass);
    setInstrumentType(defaults.instrumentType);
    setSectorType(defaults.sectorType);
    clearSelectedAsset();
    resetReview();
  }

  function handleReview() {
    resetReview();
    const result = validateOpeningPositionForm({
      assetClass,
      assetName,
      averageCostPrice,
      conviction,
      currentPrice,
      date,
      instrumentType,
      notes,
      quoteSourceId,
      quantity,
      sectorType,
      symbol,
      ticker,
    });

    if (!result.isValid) {
      setErrors(result.errors);
      return;
    }

    const assetId = selectedAsset?.id ?? createId("asset");
    const asset = selectedAsset ?? buildManualAsset(assetId);

    setErrors({});
    setReviewAsset(asset);
    setReviewOpeningPosition({
      assetId: asset.id,
      averageCostPrice: result.value.averageCostPrice,
      conviction: result.value.conviction,
      currentPrice: result.value.currentPrice,
      date: `${result.value.date}T00:00:00.000Z`,
      id: createId("opening"),
      notes: result.value.notes,
      quantity: result.value.quantity,
    });
  }

  async function handleConfirm() {
    if (!reviewAsset || !reviewOpeningPosition) {
      return;
    }

    if (!selectedAsset) {
      store.getState().addAsset(reviewAsset);
    }

    store.getState().addOpeningPosition(reviewOpeningPosition);
    store.getState().upsertQuote({
      asOf: new Date().toISOString(),
      assetId: reviewAsset.id,
      currency: "INR",
      price: reviewOpeningPosition.currentPrice ?? 0,
      source: "manual",
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSuccessMessage("Opening position saved.");
    setReviewOpeningPosition(undefined);
  }

  return (
    <ScreenContainer scroll testID="add-holding-screen">
      <ScreenHeader title="Add Holding" subtitle="Opening position • local only" />

      {snapshot.assets.length > 0 ? (
        <PremiumCard>
          <AppText color="secondary" variant="caption" weight="medium">
            Existing assets
          </AppText>
          <View style={styles.assetGrid}>
            {snapshot.assets.map((asset) => (
              <Pressable
                accessibilityRole="button"
                key={asset.id}
                onPress={() => selectAsset(asset)}
                style={({ pressed }) => [
                  styles.assetChip,
                  selectedAssetId === asset.id && styles.assetChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <CategoryIcon assetClass={asset.assetClass} size={18} />
                <View style={styles.assetChipCopy}>
                  <AppText weight="bold">{asset.symbol}</AppText>
                  <AppText color="secondary" variant="caption">
                    {asset.name}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </View>
        </PremiumCard>
      ) : null}

      <PremiumCard>
        <SectionHeader title="Asset" />
        <FormTextField
          label="Search asset"
          onChangeText={(value) => {
            setLookupQuery(value);
            setQuoteStatus("");
          }}
          placeholder="Search HDFC Bank, NIFTYBEES, Bitcoin..."
          testID="asset-lookup-input"
          value={lookupQuery}
        />
        {lookupStatus ? (
          <AppText color="secondary" variant="caption">
            {isLookupSearching ? "Searching..." : lookupStatus}
          </AppText>
        ) : null}
        {lookupResults.length > 0 ? (
          <View style={styles.lookupResults}>
            {lookupResults.map((result) => (
              <Pressable
                accessibilityRole="button"
                key={result.id}
                onPress={() => {
                  void selectLookupResult(result);
                }}
                style={({ pressed }) => [
                  styles.lookupResult,
                  pressed && styles.pressed,
                ]}
                testID={`asset-lookup-result-${result.id}`}
              >
                <CategoryIcon assetClass={result.assetClass} size={18} />
                <View style={styles.lookupResultCopy}>
                  <AppText weight="bold">{result.name}</AppText>
                  <AppText color="secondary" variant="caption">
                    {result.symbol} • {result.ticker} • {result.sourceLabel}
                  </AppText>
                </View>
                <AppText color="secondary" variant="caption" weight="bold">
                  {assetClassLabel(result.assetClass)}
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : null}
        {quoteStatus ? (
          <AppText color="secondary" variant="caption">
            {quoteStatus}
          </AppText>
        ) : null}
        <View style={styles.classRow}>
          {assetClasses.map((currentClass) => {
            const isSelected = assetClass === currentClass;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={currentClass}
                onPress={() => updateAssetClass(currentClass)}
                style={({ pressed }) => [
                  styles.classChip,
                  isSelected && styles.classChipActive,
                  pressed && styles.pressed,
                ]}
                testID={`asset-class-${currentClass}`}
              >
                <CategoryIcon assetClass={currentClass} size={16} />
                <AppText
                  color={isSelected ? "primary" : "secondary"}
                  variant="caption"
                  weight="bold"
                >
                  {assetClassLabel(currentClass)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <FormTextField
          error={errors.assetName}
          label="Asset name"
          onChangeText={(value) => {
            setAssetName(value);
            clearSelectedAsset();
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
                clearSelectedAsset();
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
                clearSelectedAsset();
                resetReview();
              }}
              placeholder="RELIANCE.NS"
              testID="ticker-input"
              value={ticker}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <FormTextField
              error={errors.instrumentType}
              label="Instrument type"
              onChangeText={(value) => {
                setInstrumentType(value as InstrumentType);
                clearSelectedAsset();
                resetReview();
              }}
              placeholder="stock"
              testID="instrument-type-input"
              value={instrumentType}
            />
          </View>
          <View style={styles.flex}>
            <FormTextField
              error={errors.sectorType}
              label="Sector type"
              onChangeText={(value) => {
                setSectorType(value as SectorType);
                clearSelectedAsset();
                resetReview();
              }}
              placeholder="financialServices"
              testID="sector-type-input"
              value={sectorType}
            />
          </View>
        </View>
        <FormTextField
          label="Quote source ID"
          onChangeText={(value) => {
            setQuoteSourceId(value);
            clearSelectedAsset();
            resetReview();
          }}
          placeholder="RELIANCE.NS"
          testID="quote-source-id-input"
          value={quoteSourceId}
        />
      </PremiumCard>

      <PremiumCard>
        <SectionHeader title="Position Details" />
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
              placeholder="25"
              testID="quantity-input"
              value={quantity}
            />
          </View>
          <View style={styles.flex}>
            <FormTextField
              error={errors.averageCostPrice}
              keyboardType="decimal-pad"
              label="Average cost"
              onChangeText={(value) => {
                setAverageCostPrice(value);
                resetReview();
              }}
              placeholder="1450"
              testID="average-cost-input"
              value={averageCostPrice}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <FormTextField
              error={errors.currentPrice}
              keyboardType="decimal-pad"
              label="Current price"
              onChangeText={(value) => {
                setCurrentPrice(value);
                resetReview();
              }}
              placeholder="1678.25"
              testID="price-input"
              value={currentPrice}
            />
          </View>
          <View style={styles.flex}>
            <FormTextField
              error={errors.date}
              label="Date acquired"
              onChangeText={(value) => {
                setDate(value);
                resetReview();
              }}
              placeholder="YYYY-MM-DD"
              testID="date-input"
              value={date}
            />
          </View>
        </View>
        <View style={styles.convictionGroup}>
          <AppText color="secondary" variant="caption" weight="medium">
            Conviction optional
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
      </PremiumCard>

      {previewHolding ? (
        <PremiumCard elevated testID="derived-preview">
          <SectionHeader title="Derived Preview" />
          <View style={styles.previewGrid}>
            <View style={styles.previewCell}>
              <AppText color="secondary" variant="caption">
                Invested
              </AppText>
              <AppText weight="bold">
                {formatINR(previewHolding.totalInvested)}
              </AppText>
            </View>
            <View style={styles.previewCell}>
              <AppText color="secondary" variant="caption">
                Current
              </AppText>
              <AppText weight="bold">
                {formatINR(previewHolding.currentValue)}
              </AppText>
            </View>
            <View style={styles.previewCell}>
              <AppText color="secondary" variant="caption">
                P&L
              </AppText>
              <AppText
                style={[
                  previewHolding.unrealisedPnL >= 0
                    ? styles.positiveText
                    : styles.negativeText,
                ]}
                weight="bold"
              >
                {formatSignedINR(previewHolding.unrealisedPnL)}
              </AppText>
            </View>
            <View style={styles.previewCell}>
              <AppText color="secondary" variant="caption">
                P&L %
              </AppText>
              <AppText
                style={[
                  previewHolding.unrealisedPnL >= 0
                    ? styles.positiveText
                    : styles.negativeText,
                ]}
                weight="bold"
              >
                {formatPercentage(previewHolding.unrealisedPnLPct)}
              </AppText>
            </View>
          </View>
        </PremiumCard>
      ) : null}

      {successMessage ? (
        <AppText selectable style={styles.successText}>
          {successMessage}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        <AppButton
          onPress={handleReview}
          testID="review-holding-button"
          title="Review Holding"
        />
        <AppButton
          disabled={!reviewOpeningPosition}
          onPress={handleConfirm}
          testID="save-holding-button"
          title="Save Holding"
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
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.card,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    width: "48%",
  },
  assetChipActive: {
    backgroundColor: "rgba(46,125,82,0.24)",
  },
  assetChipCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  assetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  classChip: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  classChipActive: {
    backgroundColor: "rgba(46,125,82,0.24)",
  },
  classRow: {
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
  lookupResult: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.card,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  lookupResultCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  lookupResults: {
    gap: spacing.sm,
  },
  negativeText: {
    color: colors.loss,
  },
  positiveText: {
    color: colors.profit,
  },
  pressed: {
    opacity: interaction.pressedOpacity,
  },
  previewCell: {
    gap: spacing.xs,
    width: "48%",
  },
  previewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  successText: {
    color: colors.profit,
  },
});
