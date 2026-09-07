import { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
  type ScrollView,
} from "react-native";

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
  InstrumentType,
  Quote,
} from "@/src/types";
import type { OpeningPositionCommandResult } from "@/src/store";
import { ContextualNudge } from "@/src/features/onboarding/ContextualNudge";

import {
  assetClasses,
  convictionScores,
  phases,
  type AddOpeningPositionControllerInput,
  type AddHoldingPhase,
  useAddOpeningPosition,
} from "./useAddOpeningPosition";

type AddOpeningPositionFormProps = AddOpeningPositionControllerInput & {
  hardwareBackEnabled?: boolean;
  onAddPpfAccount?: (legacy?: { assetId?: string; name?: string }) => void;
  onCancel?: () => void;
  onQuickSetupItemSaved?: (
    result: OpeningPositionCommandResult,
    action: "addNext" | "finish",
  ) => void;
  quickSetupSavedCount?: number;
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
  hardwareBackEnabled = true,
  initialVisualQaState,
  now,
  onAddPpfAccount,
  onCancel,
  onComplete,
  onQuickSetupItemSaved,
  quickSetup = false,
  quickSetupSavedCount = 0,
  resolveQuote,
  searchAssetLookupResults,
  store,
}: AddOpeningPositionFormProps) {
  const holding = useAddOpeningPosition({
    initialVisualQaState,
    now,
    onComplete,
    quickSetup,
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
    intendedHoldDays,
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
    quickSetupDuplicate,
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
    setIntendedHoldDays,
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
  const isMinimalMode = snapshot.preferences.displayMode === "minimal";
  const [isManualEntryExpanded, setIsManualEntryExpanded] = useState(false);
  const [arePositionOptionsExpanded, setArePositionOptionsExpanded] = useState(false);
  const [areReviewDetailsExpanded, setAreReviewDetailsExpanded] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const showPositionOptions = arePositionOptionsExpanded || Boolean(
    errors.conviction || errors.intendedHoldDays,
  );
  const [isExitConfirmationVisible, setIsExitConfirmationVisible] =
    useState(false);
  const displayPhases = quickSetup
    ? phases.filter((phase) => phase.key !== "class")
    : phases;
  const hasSelectedAssetSummary = Boolean(selectedAssetId || selectedLookupResult);
  const selectedAssetSourceLabel = selectedLookupResult
    ? `${selectedLookupResult.sourceLabel} suggestion`
    : selectedAssetId
      ? "Existing asset"
      : "";
  const availableInstrumentTypes: InstrumentType[] = getInstrumentTypeOptions(
    assetClass,
  ).filter((value) => value !== "ppf");
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
  const hasUnfinishedDraft = !savedAssetId && Boolean(
    hasSelectedAssetSummary ||
      isManualEntryExpanded ||
      lookupQuery.trim() ||
      quantity.trim() ||
      averageCostPrice.trim() ||
      currentPrice.trim() || assetName.trim() || symbol.trim() || ticker.trim() ||
      notes.trim() || intendedHoldDays.trim() || conviction || date || dateUnknown,
  );

  function requestExit() {
    if (isSaving) return;
    if (hasUnfinishedDraft) {
      setIsExitConfirmationVisible(true);
    } else {
      onCancel?.();
    }
  }

  useEffect(() => {
    Keyboard.dismiss();
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    setAreReviewDetailsExpanded(false);
  }, [currentPhase]);

  function renderReviewDetails() {
    if (currentPhase !== "review" || !reviewAsset || !reviewOpeningPosition) return null;
    return (
      <>
        <AppButton
          accessibilityState={{ expanded: areReviewDetailsExpanded }}
          onPress={() => setAreReviewDetailsExpanded((expanded) => !expanded)}
          testID="toggle-review-details"
          title={areReviewDetailsExpanded ? "Hide holding details" : "Holding details & edits"}
          variant="ghost"
        />
        {areReviewDetailsExpanded ? (
          <View style={styles.reviewSections}>
            <PremiumCard testID="review-identity">
              <ReviewSectionHeader onEdit={() => moveToPhase("asset")} testID="review-edit-asset" title="Asset" />
              <ReviewDetailRow label="Name" value={reviewAsset.name} />
              <ReviewDetailRow label="Symbol" value={reviewAsset.symbol} />
              {reviewAsset.ticker !== reviewAsset.symbol ? (
                <ReviewDetailRow label="Ticker" value={reviewAsset.ticker} />
              ) : null}
              {reviewAsset.exchange ? <ReviewDetailRow label="Exchange" value={reviewAsset.exchange} /> : null}
              <ReviewDetailRow label="Currency" value={reviewAsset.currency} />
              {reviewAsset.quoteSourceId && reviewAsset.quoteSourceId !== reviewAsset.ticker && reviewAsset.quoteSourceId !== reviewAsset.symbol ? (
                <ReviewDetailRow label="Price lookup symbol" value={reviewAsset.quoteSourceId} />
              ) : null}
            </PremiumCard>
            {!quickSetup ? (
              <PremiumCard testID="review-classification">
                <ReviewSectionHeader onEdit={() => moveToPhase("class")} testID="review-edit-classification" title="Classification" />
                <ReviewDetailRow label="Asset class" value={assetClassLabel(reviewAsset.assetClass)} />
                <ReviewDetailRow label="Instrument" value={instrumentTypeLabel(reviewAsset.instrumentType ?? instrumentType)} />
                {reviewAsset.assetClass === "stock" ? <ReviewDetailRow label="Sector" value={sectorTypeLabel(reviewAsset.sectorType ?? "other")} /> : null}
              </PremiumCard>
            ) : null}
            {reviewOpeningPosition.date || (!quickSetup && (reviewOpeningPosition.notes || reviewOpeningPosition.conviction || reviewOpeningPosition.intendedHoldDays)) ? (
              <PremiumCard testID="review-optional-details">
                <ReviewSectionHeader onEdit={() => {
                  setArePositionOptionsExpanded(true);
                  moveToPhase("position");
                }} testID="review-edit-options" title="Optional details" />
                {reviewOpeningPosition.date ? <ReviewDetailRow label="First purchase date" value={reviewOpeningPosition.date.slice(0, 10)} /> : null}
                {!quickSetup && reviewOpeningPosition.notes ? <ReviewDetailRow label="Note" value={reviewOpeningPosition.notes} /> : null}
                {!quickSetup && reviewOpeningPosition.conviction ? <ReviewDetailRow label="Conviction" value={`${reviewOpeningPosition.conviction} of 5`} /> : null}
                {!quickSetup && reviewOpeningPosition.intendedHoldDays ? <ReviewDetailRow label="Planned holding period" value={`${reviewOpeningPosition.intendedHoldDays} days`} /> : null}
              </PremiumCard>
            ) : null}
          </View>
        ) : null}
      </>
    );
  }

  function goBack() {
    if (isSaving) return;
    if (!savedAssetId && currentPhase !== "asset") {
      const index = displayPhases.findIndex((phase) => phase.key === currentPhase);
      moveToPhase(displayPhases[index - 1].key);
    } else {
      requestExit();
    }
  }

  useEffect(() => {
    if (!hardwareBackEnabled || !onCancel) {
      return undefined;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (quickSetup) requestExit();
        else goBack();

        return true;
      },
    );

    return () => subscription.remove();
  }, [hardwareBackEnabled, onCancel, quickSetup, requestExit, goBack]);

  function renderStepper() {
    const currentIndex = getPhaseIndex(currentPhase);

    return (
      <View style={styles.stepper}>
        {displayPhases.map((phase, index) => {
          const isActive = phase.key === currentPhase;
          const displayIndex = displayPhases.findIndex(
            (item) => item.key === currentPhase,
          );
          const isComplete = index < displayIndex;
          const isDisabled = Boolean(savedAssetId) || index > displayIndex;

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
                style={styles.stepLabel}
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
    <KeyboardAvoidingView behavior="height" style={styles.flex}>
    <ScreenContainer scroll scrollRef={scrollRef} testID="add-holding-screen">
      <ScreenHeader
        leading={
          onCancel ? (
            <IconButton
              accessibilityLabel={
                quickSetup ? "Exit portfolio setup" : "Back"
              }
              icon="arrow-back"
              onPress={quickSetup ? requestExit : goBack}
              testID="add-holding-exit"
            />
          ) : null
        }
        title={quickSetup ? "Set up portfolio" : "Add Holding"}
        subtitle={
          quickSetup
            ? `${quickSetupSavedCount} ${quickSetupSavedCount === 1 ? "holding" : "holdings"} saved locally`
            : "Opening position • local only"
        }
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
        {quickSetupDuplicate.kind !== "new" ? (
          <AppText
            color={
              quickSetupDuplicate.kind === "blocked" ? "secondary" : "primary"
            }
            selectable
            testID={`quick-setup-duplicate-${quickSetupDuplicate.kind}`}
            variant="caption"
          >
            {quickSetupDuplicate.message}
          </AppText>
        ) : null}
        {instrumentType === "ppf" ? (
          <PremiumCard elevated testID="ppf-dedicated-flow-notice">
            <AppText weight="bold">PPF uses a dedicated account ledger</AppText>
            <AppText color="secondary" variant="caption">
              PPF has no units, average cost, or market price. Set it up with a confirmed balance instead.
            </AppText>
            {onAddPpfAccount ? (
              <AppButton
                onPress={() =>
                  onAddPpfAccount({
                    assetId: selectedAssetId || undefined,
                    name: assetName || undefined,
                  })
                }
                testID="open-ppf-account-flow"
                title="Add PPF account"
                variant="secondary"
              />
            ) : null}
          </PremiumCard>
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
        {quickSetup &&
        onAddPpfAccount &&
        !hasSelectedAssetSummary &&
        !isManualEntryExpanded &&
        lookupQuery.trim().length === 0 ? (
          <AppButton
            onPress={() => onAddPpfAccount()}
            testID="quick-setup-add-ppf"
            title="Add a PPF account"
            variant="secondary"
          />
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
            const choiceLabel = currentClass === "stock"
              ? "Stocks"
              : currentClass === "etf"
                ? "ETFs"
                : assetClassLabel(currentClass);

            return (
              <Pressable
                accessibilityLabel={choiceLabel}
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
                  {choiceLabel}
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
        <View style={styles.secondaryPositionFields}>
          <View>
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
          <View>
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
        {!quickSetup ? (
          <AppButton
            accessibilityState={{ expanded: showPositionOptions }}
            onPress={() => setArePositionOptionsExpanded((expanded) => !expanded)}
            testID="toggle-position-options"
            title={showPositionOptions ? "Hide optional details" : "Add notes or a holding plan"}
            variant="ghost"
          />
        ) : null}
        {!quickSetup && showPositionOptions ? <View style={styles.convictionGroup}>
          <ContextualNudge kind="metadata" store={store} hasConviction={Boolean(conviction)} hasPlan={Boolean(intendedHoldDays.trim())} />
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
        </View> : null}
        {!quickSetup && showPositionOptions ? (
          <FormTextField
            error={errors.intendedHoldDays}
            keyboardType="number-pad"
            label="Planned holding period (days)"
            onChangeText={(value) => {
              setIntendedHoldDays(value);
              resetReview();
            }}
            placeholder="Optional"
            testID="intended-hold-days-input"
            value={intendedHoldDays}
          />
        ) : null}
        {!quickSetup && showPositionOptions ? <FormTextField
          label="Note"
          multiline
          onChangeText={(value) => {
            setNotes(value);
            resetReview();
          }}
          placeholder="Optional note"
          testID="notes-input"
          value={notes}
        /> : null}
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
        <PremiumCard testID="derived-preview-card">
          <SectionHeader title="Review holding" />
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
          <AppText color="secondary" testID="review-quote-provenance" variant="caption">
            {reviewQuoteSourceLabel}
          </AppText>
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
                  color={isMinimalMode ? "secondary" : undefined}
                  style={
                    isMinimalMode
                      ? undefined
                      : previewHolding.unrealisedPnL >= 0
                        ? styles.positiveText
                        : styles.negativeText
                  }
                  testID="derived-preview-pnl"
                  weight={isMinimalMode ? "medium" : "bold"}
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
                  color={isMinimalMode ? "secondary" : undefined}
                  style={
                    isMinimalMode
                      ? undefined
                      : previewHolding.unrealisedPnLPct >= 0
                        ? styles.positiveText
                        : styles.negativeText
                  }
                  testID="derived-preview-pnl-percent"
                  weight={isMinimalMode ? "medium" : "bold"}
                >
                  {formatPercentage(previewHolding.unrealisedPnLPct)}
                </AppText>
              )}
            </View>
          </View>
          <View testID="review-position">
            <ReviewSectionHeader
              onEdit={() => moveToPhase("position")}
              testID="review-edit-position"
              title="Position"
            />
            <ReviewDetailRow label="Quantity" value={reviewOpeningPosition.quantity.toString()} />
            <ReviewDetailRow label="Average cost" value={formatINR(reviewOpeningPosition.averageCostPrice)} />
            <ReviewDetailRow label="Current price" value={
              reviewOpeningPosition.manualValuation
                ? formatINR(reviewOpeningPosition.manualValuation.price)
                : candidateProviderQuote && preservesProviderQuote
                  ? formatINR(candidateProviderQuote.price)
                  : "Valuation pending"
            } />
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

      {savedAssetId && !quickSetup ? (
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
                setArePositionOptionsExpanded(false);
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
          (hasSelectedAssetSummary || isManualEntryExpanded) &&
          instrumentType !== "ppf" ? (
            <AppButton
              disabled={quickSetupDuplicate.kind === "blocked"}
              onPress={continueFromAsset}
              testID="continue-class-button"
              title={quickSetup ? "Continue to position" : "Continue to confirm details"}
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
              onPress={goBack}
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
              onPress={goBack}
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
            {quickSetup ? (
              <>
                <AppButton
                  accessibilityState={{ busy: isSaving, disabled: isSaving }}
                  disabled={!reviewOpeningPosition || isSaving}
                  onPress={async () => {
                    const result = await handleConfirm();
                    if (result) {
                      onQuickSetupItemSaved?.(result, "addNext");
                      setIsManualEntryExpanded(false);
                      setArePositionOptionsExpanded(false);
                      startAnotherHolding();
                    }
                  }}
                  testID="quick-setup-save-add-next"
                  title={isSaving ? "Saving..." : "Save & add next"}
                />
                <AppButton
                  accessibilityState={{ busy: isSaving, disabled: isSaving }}
                  disabled={!reviewOpeningPosition || isSaving}
                  onPress={async () => {
                    const result = await handleConfirm();
                    if (result) {
                      onQuickSetupItemSaved?.(result, "finish");
                    }
                  }}
                  testID="quick-setup-save-finish"
                  title="Save & finish"
                  variant="secondary"
                />
              </>
            ) : (
              <AppButton
                accessibilityState={{ busy: isSaving, disabled: isSaving }}
                disabled={!reviewOpeningPosition || isSaving}
                onPress={handleConfirm}
                testID="save-holding-button"
                title={isSaving ? "Saving..." : "Save Holding"}
              />
            )}
            <AppButton
              disabled={isSaving}
              onPress={goBack}
              testID="back-button"
              title="Back"
              variant="secondary"
            />
          </>
        ) : null}
      </View>

      {renderReviewDetails()}

      <Modal
        testID="holding-exit-confirmation"
        animationType="fade"
        onRequestClose={() => setIsExitConfirmationVisible(false)}
        transparent
        visible={isExitConfirmationVisible}
      >
        <View style={styles.exitBackdrop}>
          <Pressable
            accessibilityLabel={quickSetup ? "Keep editing portfolio setup" : "Keep editing holding"}
            accessibilityRole="button"
            onPress={() => setIsExitConfirmationVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={styles.exitSheet}>
            <SectionHeader title={quickSetup ? "Leave portfolio setup?" : "Discard unfinished holding?"} />
            <AppText color="secondary">
              {quickSetup
                ? "Confirmed holdings are already saved. Unfinished details on this screen will be discarded."
                : "This holding has not been saved. Leaving will discard your unfinished details."}
            </AppText>
            <AppButton
              onPress={() => setIsExitConfirmationVisible(false)}
              testID={quickSetup ? "quick-setup-keep-editing" : "holding-keep-editing"}
              title="Keep editing"
            />
            <AppButton
              onPress={() => {
                setIsExitConfirmationVisible(false);
                onCancel?.();
              }}
              testID={quickSetup ? "quick-setup-confirm-exit" : "holding-discard-exit"}
              title={quickSetup ? "Leave setup" : "Discard and leave"}
              variant="secondary"
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
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
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  convictionChip: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: interaction.minimumTouchTarget,
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
  exitBackdrop: {
    backgroundColor: "rgba(0,0,0,0.72)",
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.md,
  },
  exitSheet: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.sheet,
    gap: spacing.md,
    padding: spacing.md,
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
    gap: spacing.xs,
    paddingVertical: spacing.sm,
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
  secondaryPositionFields: {
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
    minHeight: interaction.minimumTouchTarget,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  stepLabel: {
    flexShrink: 1,
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
    paddingBottom: spacing.sm,
  },
  summaryCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
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
