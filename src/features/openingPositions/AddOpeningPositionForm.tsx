import { useState } from "react";
import { Pressable, StyleSheet, TouchableOpacity, View } from "react-native";

import {
  AppButton,
  AppText,
  assetClassLabel,
  CategoryIcon,
  IconButton,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import {
  DatePickerField,
  FormTextField,
  SelectionField,
} from "@/src/components/forms";
import {
  equitySectorTypeOptions,
  getInstrumentTypeOptions,
  instrumentTypeLabel,
  sectorTypeLabel,
} from "@/src/domain/assets";
import { formatINR, formatPercentage } from "@/src/domain/formatters";
import { colors, interaction, radii, spacing } from "@/src/theme";
import type {
  AssetClass,
  ConvictionScore,
  Quote,
} from "@/src/types";

import {
  assetClasses,
  convictionScores,
  phases,
  type AddOpeningPositionControllerInput,
  type AddHoldingPhase,
  useAddOpeningPosition,
} from "./useAddOpeningPosition";

type AddOpeningPositionFormProps = AddOpeningPositionControllerInput & {
  onCancel?: () => void;
};

function formatSignedINR(value: number) {
  const amount = formatINR(value);

  return value > 0 ? `+${amount}` : amount;
}

function quoteSourceLabel(quote: Quote) {
  if (quote.source === "yahoo") {
    return "Yahoo Finance";
  }

  if (quote.source === "coingecko") {
    return "CoinGecko";
  }

  return "manual";
}

function ReviewDetailRow({
  label,
  testID,
  value,
}: {
  label: string;
  testID?: string;
  value: string;
}) {
  return (
    <View style={styles.reviewDetailRow} testID={testID}>
      <AppText color="secondary" variant="caption">
        {label}
      </AppText>
      <AppText style={styles.reviewDetailValue} weight="bold">
        {value}
      </AppText>
    </View>
  );
}

function ReviewSectionHeader({
  onEdit,
  testID,
  title,
}: {
  onEdit: () => void;
  testID: string;
  title: string;
}) {
  return (
    <View style={styles.reviewSectionHeader}>
      <SectionHeader title={title} />
      <TouchableOpacity
        accessibilityLabel={`Edit ${title.toLowerCase()}`}
        accessibilityRole="button"
        activeOpacity={0.74}
        onPress={onEdit}
        style={styles.reviewEditAction}
        testID={testID}
      >
        <AppText color="secondary" variant="caption" weight="bold">
          Edit
        </AppText>
      </TouchableOpacity>
    </View>
  );
}

export function AddOpeningPositionForm({
  initialVisualQaState,
  now,
  onCancel,
  onComplete,
  resolveQuote,
  searchAssetLookupResults,
  store,
}: AddOpeningPositionFormProps) {
  const holding = useAddOpeningPosition({
    initialVisualQaState,
    now,
    onComplete,
    resolveQuote,
    searchAssetLookupResults,
    store,
  });
  const {
    assetClass,
    assetName,
    averageCostPrice,
    changeSelectedAsset,
    continueFromAsset,
    continueFromClass,
    continueFromPosition,
    conviction,
    currentPhase,
    currentPrice,
    date,
    dateUnknown,
    errors,
    getPhaseIndex,
    handleConfirm,
    instrumentType,
    instrumentTypeConfidence,
    isLookupSearching,
    isSaving,
    lookupQuery,
    lookupResults,
    lookupStatus,
    matchingExistingAssets,
    metadataReviewMessage,
    moveToPhase,
    notes,
    previewHolding,
    quantity,
    quoteSourceId,
    quoteStatus,
    resetReview,
    reviewAsset,
    reviewOpeningPosition,
    savedAssetId,
    sectorType,
    sectorTypeConfidence,
    selectAsset,
    selectLookupResult,
    selectedAssetId,
    selectedLookupResult,
    selectedLookupQuote,
    setAssetName,
    setAverageCostPrice,
    setConviction,
    setCurrentPrice,
    setDate,
    setDateUnknown,
    setInstrumentType,
    setLookupQuery,
    setNotes,
    setQuantity,
    setQuoteStatus,
    setSectorType,
    setSymbol,
    snapshot,
    startAnotherHolding,
    successMessage,
    symbol,
    ticker,
    updateAssetClass,
    updateQuoteSourceId,
    updateTicker,
    viewSavedHolding,
  } = holding;
  const [isManualEntryExpanded, setIsManualEntryExpanded] = useState(false);
  const hasSelectedAssetSummary = Boolean(selectedAssetId || selectedLookupResult);
  const selectedAssetSourceLabel = selectedLookupResult
    ? `${selectedLookupResult.sourceLabel} suggestion`
    : selectedAssetId
      ? "Existing asset"
      : "";
  const availableInstrumentTypes = getInstrumentTypeOptions(assetClass);
  const instrumentOptions = (
    availableInstrumentTypes.includes(instrumentType)
      ? availableInstrumentTypes
      : [...availableInstrumentTypes, instrumentType]
  ).map(
    (value) => ({
      label: instrumentTypeLabel(value),
      value,
    }),
  );
  const availableSectorTypes = equitySectorTypeOptions.includes(sectorType)
    ? equitySectorTypeOptions
    : [...equitySectorTypeOptions, sectorType];
  const sectorOptions = availableSectorTypes.map((value) => ({
    label: sectorTypeLabel(value),
    value,
  }));
  const lookupGroups = [
    ...new Set(lookupResults.map((result) => result.provider)),
  ].map((provider) => ({
    label: provider === "yahoo" ? "Indian market" : "Crypto",
    results: lookupResults.filter((result) => result.provider === provider),
  }));
  const selectedSavedQuote = selectedAssetId
    ? snapshot.quoteCache[selectedAssetId]
    : undefined;
  const candidateProviderQuote = selectedLookupQuote ?? selectedSavedQuote;
  const currentPriceNumber = Number(currentPrice);
  const preservesProviderQuote =
    candidateProviderQuote !== undefined &&
    Number.isFinite(currentPriceNumber) &&
    candidateProviderQuote.price === currentPriceNumber;
  const reviewQuoteSourceLabel = currentPrice.trim().length === 0
    ? "Valuation pending"
    : selectedLookupResult
    ? selectedLookupQuote && preservesProviderQuote
      ? `Live quote • ${selectedLookupResult.sourceLabel}`
      : `Manual price • ${selectedLookupResult.sourceLabel} identity`
    : selectedSavedQuote && preservesProviderQuote
      ? selectedSavedQuote.source === "manual"
        ? "Saved manual price"
        : `Saved live quote • ${quoteSourceLabel(selectedSavedQuote)}`
      : "Manual price";

  function renderStepper() {
    const currentIndex = getPhaseIndex(currentPhase);

    return (
      <View style={styles.stepper}>
        {phases.map((phase, index) => {
          const isActive = phase.key === currentPhase;
          const isComplete = index < currentIndex;
          const isDisabled = Boolean(savedAssetId) || index > currentIndex;

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
      <ScreenHeader
        leading={
          onCancel ? (
            <IconButton
              accessibilityLabel="Back to Holdings"
              icon="arrow-back"
              onPress={onCancel}
              testID="add-holding-exit"
            />
          ) : null
        }
        title="Add Holding"
        subtitle="Opening position • local only"
      />
      {renderStepper()}

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
              onPress={() => {
                setIsManualEntryExpanded(false);
                changeSelectedAsset();
              }}
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
              placeholder="Search name, symbol, or ticker"
              returnKeyType="search"
              testID="asset-lookup-input"
              value={lookupQuery}
            />
            {matchingExistingAssets.length > 0 ? (
              <View
                style={styles.lookupResults}
                testID="existing-asset-results"
              >
                <AppText color="secondary" variant="caption" weight="medium">
                  Your assets
                </AppText>
                {matchingExistingAssets.map((asset) => (
                  <TouchableOpacity
                    accessibilityLabel={`Use ${asset.name}`}
                    accessibilityRole="button"
                    activeOpacity={0.74}
                    key={asset.id}
                    onPress={() => {
                      setIsManualEntryExpanded(false);
                      selectAsset(asset);
                    }}
                    style={styles.lookupResult}
                    testID={`existing-asset-${asset.id}`}
                  >
                    <CategoryIcon assetClass={asset.assetClass} size={18} />
                    <View style={styles.lookupResultCopy}>
                      <AppText weight="bold">{asset.name}</AppText>
                      <AppText color="secondary" variant="caption">
                        {asset.symbol} • {asset.ticker}
                      </AppText>
                    </View>
                    <AppText color="secondary" variant="caption" weight="bold">
                      Use
                    </AppText>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {lookupStatus ? (
              <AppText color="secondary" variant="caption">
                {isLookupSearching ? "Searching..." : lookupStatus}
              </AppText>
            ) : null}
            {lookupGroups.length > 0 ? (
              <View style={styles.lookupResults} testID="asset-lookup-results">
                <AppText color="secondary" variant="caption" weight="medium">
                  Select a result
                </AppText>
                {lookupGroups.map((group) => (
                  <View key={group.label} style={styles.lookupGroup}>
                    <AppText color="secondary" variant="caption" weight="bold">
                      {group.label}
                    </AppText>
                    {group.results.map((result) => (
                      <TouchableOpacity
                        accessibilityLabel={`Select ${result.name}`}
                        accessibilityRole="button"
                        activeOpacity={0.74}
                        key={result.id}
                        onPress={() => {
                          setIsManualEntryExpanded(false);
                          void selectLookupResult(result);
                        }}
                        style={styles.lookupResult}
                        testID={`asset-lookup-result-${result.id}`}
                      >
                        <CategoryIcon assetClass={result.assetClass} size={18} />
                        <View style={styles.lookupResultCopy}>
                          <AppText weight="bold">{result.name}</AppText>
                          <AppText color="secondary" variant="caption">
                            {result.symbol} • {result.ticker}
                          </AppText>
                        </View>
                        <AppText
                          color="secondary"
                          variant="caption"
                          weight="bold"
                        >
                          Select
                        </AppText>
                      </TouchableOpacity>
                    ))}
                  </View>
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
        {!hasSelectedAssetSummary ? (
          <AppButton
            accessibilityState={{ expanded: isManualEntryExpanded }}
            onPress={() => setIsManualEntryExpanded((expanded) => !expanded)}
            testID="toggle-manual-asset-entry"
            title={
              isManualEntryExpanded
                ? "Use asset search instead"
                : "Can't find your asset? Add manually"
            }
            variant="ghost"
          />
        ) : null}
        {!hasSelectedAssetSummary && isManualEntryExpanded ? (
        <View style={styles.manualFields} testID="manual-asset-fields">
          <SectionHeader title="Manual asset details" />
          <FormTextField
            error={errors.assetName}
            label="Asset name"
            onChangeText={(value) => {
              setAssetName(value);
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
                onChangeText={updateTicker}
                placeholder="RELIANCE.NS"
                testID="ticker-input"
                value={ticker}
              />
            </View>
          </View>
          <FormTextField
            label="Quote source ID"
            onChangeText={updateQuoteSourceId}
            placeholder="RELIANCE.NS"
            testID="quote-source-id-input"
            value={quoteSourceId}
          />
        </View>
        ) : null}
      </PremiumCard>
      ) : null}

      {currentPhase === "class" ? (
      <PremiumCard testID="add-holding-phase-class">
        <SectionHeader title="Confirm details" />
        <AppText
          color="secondary"
          testID="provider-metadata-review-copy"
          variant="caption"
        >
          Suggested details. Confirm anything marked for review.
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
        <AppText color="secondary" testID="metadata-review-message" variant="caption">
          {metadataReviewMessage}
        </AppText>
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
        <SelectionField
          helperText={
            instrumentTypeConfidence === "reviewRequired"
              ? "Confirm the instrument that best describes this holding."
              : undefined
          }
          helperTestID={
            instrumentTypeConfidence === "reviewRequired"
              ? "instrument-type-review-hint"
              : undefined
          }
          label="Instrument type"
          onChange={(value) => {
            setInstrumentType(value);
            resetReview();
          }}
          options={instrumentOptions}
          testIDPrefix="instrument-type"
          value={instrumentType}
        />
        {errors.instrumentType ? (
          <AppText selectable style={styles.errorText} variant="caption">
            {errors.instrumentType}
          </AppText>
        ) : null}
        {assetClass === "stock" ? (
          <>
            <SelectionField
              helperText={
                sectorTypeConfidence === "reviewRequired"
                  ? "Optional. Leave as Unknown if you are unsure."
                  : "Optional portfolio context."
              }
              helperTestID={
                sectorTypeConfidence === "reviewRequired"
                  ? "sector-type-review-hint"
                  : undefined
              }
              label="Sector"
              onChange={(value) => {
                setSectorType(value);
                resetReview();
              }}
              options={sectorOptions}
              testIDPrefix="sector-type"
              value={sectorType}
            />
            {errors.sectorType ? (
              <AppText selectable style={styles.errorText} variant="caption">
                {errors.sectorType}
              </AppText>
            ) : null}
          </>
        ) : (
          <AppText
            color="secondary"
            testID="sector-not-applicable"
            variant="caption"
          >
            Sector is not needed for this asset class.
          </AppText>
        )}
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
            <AppText color="secondary" variant="caption">
              If unavailable, save now and refresh or enter a manual price later.
            </AppText>
          </View>
          <View style={styles.flex}>
            {dateUnknown ? (
              <View style={styles.unknownDateSummary}>
                <AppText color="secondary" variant="caption">
                  First purchase date (optional)
                </AppText>
                <AppText weight="bold">Unknown</AppText>
              </View>
            ) : (
              <DatePickerField
                error={errors.date}
                label="First purchase date (optional)"
                maximumDate={now}
                onChange={(value) => {
                  setDate(value);
                  resetReview();
                }}
                testID="date-input"
                value={date}
              />
            )}
            <Pressable
              accessibilityLabel="First purchase date unknown"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: dateUnknown }}
              onPress={() => {
                setDateUnknown(!dateUnknown);
                setDate("");
                resetReview();
              }}
              style={({ pressed }) => [
                styles.unknownDateControl,
                dateUnknown && styles.unknownDateControlSelected,
                pressed && styles.pressed,
              ]}
              testID="first-purchase-date-unknown"
            >
              <AppText
                color={dateUnknown ? "primary" : "secondary"}
                variant="caption"
                weight="bold"
              >
                I don't know
              </AppText>
            </Pressable>
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
          testID="notes-input"
          value={notes}
        />
      </PremiumCard>
      ) : null}

      {currentPhase === "review" &&
      previewHolding &&
      reviewAsset &&
      reviewOpeningPosition ? (
        <View
          style={styles.reviewSections}
          testID="add-holding-phase-review"
        >
        <PremiumCard testID="review-identity">
          <ReviewSectionHeader
            onEdit={() => moveToPhase("asset")}
            testID="review-edit-asset"
            title="Asset"
          />
          <ReviewDetailRow label="Name" value={reviewAsset.name} />
          <ReviewDetailRow
            label="Symbol and ticker"
            value={`${reviewAsset.symbol} • ${reviewAsset.ticker}`}
          />
          <ReviewDetailRow
            label="Exchange and currency"
            value={`${reviewAsset.exchange ?? "Not set"} • ${reviewAsset.currency}`}
          />
          <ReviewDetailRow
            label="Price lookup symbol"
            value={reviewAsset.quoteSourceId ?? reviewAsset.ticker}
          />
          <ReviewDetailRow
            label="Price source"
            testID="review-quote-provenance"
            value={reviewQuoteSourceLabel}
          />
        </PremiumCard>

        <PremiumCard testID="review-classification">
          <ReviewSectionHeader
            onEdit={() => moveToPhase("class")}
            testID="review-edit-classification"
            title="Classification"
          />
          <ReviewDetailRow
            label="Asset class"
            value={assetClassLabel(reviewAsset.assetClass)}
          />
          <ReviewDetailRow
            label="Instrument"
            value={instrumentTypeLabel(
              reviewAsset.instrumentType ?? instrumentType,
            )}
          />
          {reviewAsset.assetClass === "stock" ? (
            <ReviewDetailRow
              label="Sector"
              value={sectorTypeLabel(reviewAsset.sectorType ?? "other")}
            />
          ) : null}
        </PremiumCard>

        <PremiumCard testID="review-position">
          <ReviewSectionHeader
            onEdit={() => moveToPhase("position")}
            testID="review-edit-position"
            title="Position"
          />
          <ReviewDetailRow
            label="Quantity"
            value={reviewOpeningPosition.quantity.toString()}
          />
          <ReviewDetailRow
            label="Average cost"
            value={formatINR(reviewOpeningPosition.averageCostPrice)}
          />
          <ReviewDetailRow
            label="Current price"
            value={
              reviewOpeningPosition.manualValuation
                ? formatINR(reviewOpeningPosition.manualValuation.price)
                : selectedLookupQuote
                  ? formatINR(selectedLookupQuote.price)
                  : "Valuation pending"
            }
          />
          <ReviewDetailRow
            label="First purchase date"
            value={reviewOpeningPosition.date?.slice(0, 10) ?? "Unknown"}
          />
          <ReviewDetailRow
            label="Note"
            value={reviewOpeningPosition.notes || "None"}
          />
          <ReviewDetailRow
            label="Conviction"
            value={
              reviewOpeningPosition.conviction
                ? `${reviewOpeningPosition.conviction} of 5`
                : "Not set"
            }
          />
        </PremiumCard>

        <PremiumCard elevated testID="derived-preview-card">
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
                {previewHolding.currentValue === null
                  ? "Unavailable"
                  : formatINR(previewHolding.currentValue)}
              </AppText>
            </View>
            <View style={styles.previewCell}>
              <AppText color="secondary" variant="caption">
                P&L
              </AppText>
              {previewHolding.unrealisedPnL === null ? (
                <AppText color="secondary" weight="bold">Unavailable</AppText>
              ) : (
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
              )}
            </View>
            <View style={styles.previewCell}>
              <AppText color="secondary" variant="caption">
                P&L %
              </AppText>
              {previewHolding.unrealisedPnLPct === null ? (
                <AppText color="secondary" weight="bold">Unavailable</AppText>
              ) : (
                <AppText
                  style={[
                    previewHolding.unrealisedPnLPct >= 0
                      ? styles.positiveText
                      : styles.negativeText,
                  ]}
                  weight="bold"
                >
                  {formatPercentage(previewHolding.unrealisedPnLPct)}
                </AppText>
              )}
            </View>
          </View>
          <View style={styles.cashImpact}>
            <AppText weight="bold">Cash impact</AppText>
            <AppText color="secondary" variant="caption">
              No cash movement. Opening positions are existing holdings funded
              outside CogVest.
            </AppText>
          </View>
          </View>
        </PremiumCard>
        </View>
      ) : null}

      {savedAssetId ? (
        <PremiumCard elevated testID="holding-save-complete">
          <SectionHeader title="Holding saved" />
          <AppText selectable style={styles.successText}>
            {successMessage}
          </AppText>
          <View style={styles.actions}>
            <AppButton
              onPress={viewSavedHolding}
              testID="view-holding-button"
              title="View holding"
            />
            <AppButton
              onPress={() => {
                setIsManualEntryExpanded(false);
                startAnotherHolding();
              }}
              testID="add-another-holding-button"
              title="Add another"
              variant="secondary"
            />
          </View>
        </PremiumCard>
      ) : null}

      <View style={styles.actions}>
        {currentPhase === "asset" ? (
          hasSelectedAssetSummary || isManualEntryExpanded ? (
            <AppButton
              onPress={continueFromAsset}
              testID="continue-class-button"
              title="Continue to confirm details"
            />
          ) : null
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
        {currentPhase === "review" && !savedAssetId ? (
          <>
            {errors.save ? (
              <AppText selectable style={styles.errorText} variant="caption">
                {errors.save}
              </AppText>
            ) : null}
            <AppButton
              accessibilityState={{ busy: isSaving, disabled: isSaving }}
              disabled={!reviewOpeningPosition || isSaving}
              onPress={handleConfirm}
              testID="save-holding-button"
              title={isSaving ? "Saving..." : "Save Holding"}
            />
            <AppButton
              disabled={isSaving}
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
    borderRadius: radii.button,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
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
    paddingVertical: spacing.xs,
  },
  classChipActive: {
    backgroundColor: "rgba(46,125,82,0.24)",
  },
  classRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  cashImpact: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.button,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  convictionChip: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: 40,
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
    backgroundColor: colors.surface.card,
    borderColor: colors.border.subtle,
    borderRadius: radii.button,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  lookupResultCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  lookupGroup: {
    gap: spacing.xs,
  },
  lookupResults: {
    gap: spacing.xs,
  },
  manualFields: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
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
    backgroundColor: colors.surface.card,
    borderRadius: radii.button,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    width: "48%",
  },
  previewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  reviewDetailRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  reviewDetailValue: {
    flex: 1,
    textAlign: "right",
  },
  reviewEditAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: interaction.minimumTouchTarget,
    paddingHorizontal: spacing.sm,
  },
  reviewSectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  reviewSections: {
    gap: spacing.cardGap,
  },
  selectedAssetSummary: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.button,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  successText: {
    color: colors.profit,
  },
  stepDot: {
    backgroundColor: colors.text.muted,
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  stepDotActive: {
    backgroundColor: colors.profit,
  },
  stepDotComplete: {
    backgroundColor: colors.primary,
  },
  stepItem: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.pill,
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: spacing.xs,
  },
  stepItemActive: {
    backgroundColor: "rgba(52,199,89,0.12)",
  },
  stepItemComplete: {
    backgroundColor: "rgba(46,125,82,0.1)",
  },
  stepItemDisabled: {
    opacity: 0.5,
  },
  stepper: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  summaryCard: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.button,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  summaryCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  unknownDateControl: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    minHeight: interaction.minimumTouchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  unknownDateControlSelected: {
    backgroundColor: "rgba(46,125,82,0.16)",
  },
  unknownDateSummary: {
    gap: spacing.xs,
    minHeight: interaction.minimumTouchTarget,
    justifyContent: "center",
  },
});
