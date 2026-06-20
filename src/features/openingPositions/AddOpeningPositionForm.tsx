import { Pressable, StyleSheet, TouchableOpacity, View } from "react-native";

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
import { formatINR, formatPercentage } from "@/src/domain/formatters";
import { colors, interaction, radii, spacing } from "@/src/theme";
import type {
  AssetClass,
  ConvictionScore,
  InstrumentType,
  SectorType,
} from "@/src/types";

import {
  assetClasses,
  convictionScores,
  phases,
  type AddOpeningPositionControllerInput,
  type AddHoldingPhase,
  useAddOpeningPosition,
} from "./useAddOpeningPosition";

type AddOpeningPositionFormProps = AddOpeningPositionControllerInput;

function formatSignedINR(value: number) {
  const amount = formatINR(value);

  return value > 0 ? `+${amount}` : amount;
}

export function AddOpeningPositionForm({
  initialVisualQaState,
  resolveQuote,
  searchAssetLookupResults,
  store,
}: AddOpeningPositionFormProps) {
  const holding = useAddOpeningPosition({
    initialVisualQaState,
    resolveQuote,
    searchAssetLookupResults,
    store,
  });
  const {
    assetClass,
    assetName,
    averageCostPrice,
    changeSelectedAsset,
    clearSelectedAsset,
    continueFromAsset,
    continueFromClass,
    continueFromPosition,
    conviction,
    currentPhase,
    currentPrice,
    date,
    errors,
    getPhaseIndex,
    handleConfirm,
    instrumentType,
    isLookupSearching,
    lookupQuery,
    lookupResults,
    lookupStatus,
    moveToPhase,
    notes,
    previewHolding,
    quantity,
    quoteSourceId,
    quoteStatus,
    resetReview,
    reviewAsset,
    reviewOpeningPosition,
    sectorType,
    selectAsset,
    selectLookupResult,
    selectedAssetId,
    selectedLookupResult,
    setAssetName,
    setAverageCostPrice,
    setConviction,
    setCurrentPrice,
    setDate,
    setInstrumentType,
    setLookupQuery,
    setNotes,
    setQuantity,
    setQuoteSourceId,
    setQuoteStatus,
    setSectorType,
    setSymbol,
    setTicker,
    snapshot,
    successMessage,
    symbol,
    ticker,
    updateAssetClass,
  } = holding;
  const hasSelectedAssetSummary = Boolean(selectedAssetId || selectedLookupResult);
  const selectedAssetSourceLabel = selectedLookupResult
    ? `${selectedLookupResult.sourceLabel} suggestion`
    : selectedAssetId
      ? "Existing asset"
      : "";

  function renderStepper() {
    const currentIndex = getPhaseIndex(currentPhase);

    return (
      <View style={styles.stepper}>
        {phases.map((phase, index) => {
          const isActive = phase.key === currentPhase;
          const isComplete = index < currentIndex;
          const isDisabled = index > currentIndex;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isDisabled, selected: isActive }}
              disabled={isDisabled}
              key={phase.key}
              onPress={() => moveToPhase(phase.key)}
              style={({ pressed }) => [
                styles.stepItem,
                isActive && styles.stepItemActive,
                isComplete && styles.stepItemComplete,
                isDisabled && styles.stepItemDisabled,
                pressed && styles.pressed,
              ]}
              testID={`add-holding-step-${phase.key}`}
            >
              <View
                style={[
                  styles.stepDot,
                  isActive && styles.stepDotActive,
                  isComplete && styles.stepDotComplete,
                ]}
              />
              <AppText
                color={isActive || isComplete ? "primary" : "secondary"}
                variant="caption"
                weight="bold"
              >
                {phase.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <ScreenContainer scroll testID="add-holding-screen">
      <ScreenHeader title="Add Holding" subtitle="Opening position • local only" />
      {renderStepper()}

      {currentPhase === "asset" && snapshot.assets.length > 0 ? (
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

      {currentPhase === "asset" ? (
      <PremiumCard testID="add-holding-phase-asset">
        <SectionHeader title="Asset" />
        {hasSelectedAssetSummary ? (
          <View style={styles.selectedAssetSummary} testID="selected-asset-summary">
            <CategoryIcon assetClass={assetClass} size={20} />
            <View style={styles.summaryCopy}>
              <AppText weight="bold">{assetName}</AppText>
              <AppText color="secondary" variant="caption">
                {symbol} • {ticker} • {selectedAssetSourceLabel}
              </AppText>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.74}
              onPress={changeSelectedAsset}
              testID="selected-asset-change"
            >
              <AppText color="secondary" variant="caption" weight="bold">
                Change
              </AppText>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <FormTextField
              label="Search asset"
              onChangeText={(value) => {
                setLookupQuery(value);
                setQuoteStatus("");
              }}
              placeholder="Search HDFC Bank, NIFTYBEES, Bitcoin..."
              returnKeyType="search"
              testID="asset-lookup-input"
              value={lookupQuery}
            />
            {lookupStatus ? (
              <AppText color="secondary" variant="caption">
                {isLookupSearching ? "Searching..." : lookupStatus}
              </AppText>
            ) : null}
            {lookupResults.length > 0 ? (
              <View style={styles.lookupResults} testID="asset-lookup-results">
                {lookupResults.map((result) => (
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.74}
                    key={result.id}
                    onPress={() => {
                      void selectLookupResult(result);
                    }}
                    style={styles.lookupResult}
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
                      Select
                    </AppText>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </>
        )}
        {quoteStatus ? (
          <AppText color="secondary" variant="caption">
            {quoteStatus}
          </AppText>
        ) : null}
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
      ) : null}

      {currentPhase === "class" ? (
      <PremiumCard testID="add-holding-phase-class">
        <SectionHeader title="Review metadata" />
        <AppText
          color="secondary"
          testID="provider-metadata-review-copy"
          variant="caption"
        >
          Provider details are suggestions. Review and edit them before saving.
        </AppText>
        <View style={styles.summaryCard}>
          <CategoryIcon assetClass={assetClass} size={20} />
          <View style={styles.summaryCopy}>
            <AppText weight="bold">{assetName || "Asset not named"}</AppText>
            <AppText color="secondary" variant="caption">
              {symbol || "Symbol"} • {ticker || "Ticker"}
            </AppText>
          </View>
        </View>
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
      </PremiumCard>
      ) : null}

      {currentPhase === "position" ? (
      <PremiumCard testID="add-holding-phase-position">
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
      ) : null}

      {currentPhase === "review" && previewHolding ? (
        <PremiumCard elevated testID="add-holding-phase-review">
          <SectionHeader title="Derived Preview" />
          <View testID="derived-preview">
          <View style={styles.summaryCard}>
            <CategoryIcon assetClass={reviewAsset!.assetClass} size={20} />
            <View style={styles.summaryCopy}>
              <AppText weight="bold">{reviewAsset!.name}</AppText>
              <AppText color="secondary" variant="caption">
                {reviewAsset!.symbol} • {assetClassLabel(reviewAsset!.assetClass)}
              </AppText>
            </View>
          </View>
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
          </View>
        </PremiumCard>
      ) : null}

      {successMessage ? (
        <AppText selectable style={styles.successText}>
          {successMessage}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        {currentPhase === "asset" ? (
          <AppButton
            onPress={continueFromAsset}
            testID="continue-class-button"
            title="Continue to classification"
          />
        ) : null}
        {currentPhase === "class" ? (
          <>
            <AppButton
              onPress={continueFromClass}
              testID="continue-position-button"
              title="Continue to position"
            />
            <AppButton
              onPress={() => moveToPhase("asset")}
              testID="back-button"
              title="Back"
              variant="secondary"
            />
          </>
        ) : null}
        {currentPhase === "position" ? (
          <>
            <AppButton
              onPress={continueFromPosition}
              testID="review-holding-button"
              title="Review and save"
            />
            <AppButton
              onPress={() => moveToPhase("class")}
              testID="back-button"
              title="Back"
              variant="secondary"
            />
          </>
        ) : null}
        {currentPhase === "review" ? (
          <>
            <AppButton
              disabled={!reviewOpeningPosition}
              onPress={handleConfirm}
              testID="save-holding-button"
              title="Save Holding"
            />
            <AppButton
              onPress={() => moveToPhase("position")}
              testID="back-button"
              title="Back"
              variant="secondary"
            />
          </>
        ) : null}
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
  selectedAssetSummary: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.card,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  successText: {
    color: colors.profit,
  },
  stepDot: {
    backgroundColor: colors.text.muted,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  stepDotActive: {
    backgroundColor: colors.profit,
  },
  stepDotComplete: {
    backgroundColor: colors.primary,
  },
  stepItem: {
    alignItems: "center",
    backgroundColor: colors.surface.card,
    borderRadius: radii.pill,
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: spacing.xs,
  },
  stepItemActive: {
    backgroundColor: "rgba(52,199,89,0.16)",
  },
  stepItemComplete: {
    backgroundColor: "rgba(46,125,82,0.14)",
  },
  stepItemDisabled: {
    opacity: 0.62,
  },
  stepper: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  summaryCard: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.card,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  summaryCopy: {
    flex: 1,
    gap: spacing.xs,
  },
});
