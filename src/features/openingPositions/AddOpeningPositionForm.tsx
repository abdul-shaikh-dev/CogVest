import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  useWindowDimensions,
  View,
  type ScrollView,
} from "react-native";

import {
  AppButton,
  AppText,
  getAdaptiveLayoutMode,
  IconButton,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import type { Asset } from "@/src/types";
import type { OpeningPositionCommandResult } from "@/src/store";
import type { AssetLookupResult } from "@/src/services/assetLookup";

import { AddHoldingAssetPhase } from "./AddHoldingAssetPhase";
import { AddHoldingClassPhase } from "./AddHoldingClassPhase";
import { AddHoldingPositionPhase } from "./AddHoldingPositionPhase";
import { AddHoldingReview, AddHoldingReviewDetails } from "./AddHoldingReview";
import { AddHoldingStepper } from "./AddHoldingStepper";
import { useStyles } from "./addHoldingStyles";
import { getReviewQuoteSourceLabel } from "./addHoldingViewModel";
import { HoldingExitConfirmation } from "./HoldingExitConfirmation";
import {
  phases,
  type AddOpeningPositionControllerInput,
  useAddOpeningPosition,
} from "./useAddOpeningPosition";

type AddOpeningPositionFormProps = AddOpeningPositionControllerInput & {
  onDiscoveryAction?: (kind: "query" | "filter" | "saved-page" | "provider-page") => void;
  onDiscoverySettled?: (kind: "saved" | "provider") => void;
  hardwareBackEnabled?: boolean;
  onAddPpfAccount?: (legacy?: { assetId?: string; name?: string }) => void;
  onCancel?: () => void;
  onQuickSetupItemSaved?: (
    result: OpeningPositionCommandResult,
    action: "addNext" | "finish",
  ) => void;
  quickSetupSavedCount?: number;
};

export function AddOpeningPositionForm({
  hardwareBackEnabled = true,
  initialVisualQaState,
  now,
  onAddPpfAccount,
  onCancel,
  onComplete,
  onDiscoveryAction,
  onDiscoverySettled,
  onQuickSetupItemSaved,
  quickSetup = false,
  quickSetupSavedCount = 0,
  recentSearchStorage,
  resolveQuote,
  searchAssetLookupResults,
  store,
}: AddOpeningPositionFormProps) {
  const styles = useStyles();
  const { width, fontScale } = useWindowDimensions();
  const stackIdentifiers = width < 360 || getAdaptiveLayoutMode(fontScale) !== "standard";
  const holding = useAddOpeningPosition({
    initialVisualQaState,
    now,
    onComplete,
    quickSetup,
    recentSearchStorage,
    resolveQuote,
    searchAssetLookupResults,
    store,
  });
  const {
    assetName,
    averageCostPrice,
    continueFromAsset,
    continueFromClass,
    continueFromPosition,
    conviction,
    currentPhase,
    currentPrice,
    date,
    dateUnknown,
    errors,
    handleConfirm,
    instrumentType,
    isSaving,
    intendedHoldDays,
    lookupQuery,
    lookupResults,
    matchingExistingAssets,
    moveToPhase,
    notes,
    previewHolding,
    quantity,
    quickSetupDuplicate,
    reviewAsset,
    reviewOpeningPosition,
    savedAssetId,
    selectAsset,
    selectLookupResult,
    selectedAssetId,
    selectedLookupResult,
    selectedLookupQuote,
    snapshot,
    startAnotherHolding,
    successMessage,
    symbol,
    ticker,
    viewSavedHolding,
  } = holding;
  const isMinimalMode = snapshot.preferences.displayMode === "minimal";
  const [isManualEntryExpanded, setIsManualEntryExpanded] = useState(false);
  const [areRecentSearchesExpanded, setAreRecentSearchesExpanded] =
    useState(false);
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
  const lookupSelectionRef = useRef(selectLookupResult);
  lookupSelectionRef.current = selectLookupResult;
  const selectDiscoveryResult = useCallback((result: AssetLookupResult) => {
    setIsManualEntryExpanded(false);
    void lookupSelectionRef.current(result);
  }, []);
  const savedSelectionRef = useRef(selectAsset);
  savedSelectionRef.current = selectAsset;
  const selectSavedResult = useCallback((asset: Asset) => {
    setIsManualEntryExpanded(false);
    savedSelectionRef.current(asset);
  }, []);
  const savedResultsSettled = useCallback(() => onDiscoverySettled?.("saved"), [onDiscoverySettled]);
  const providerResultsSettled = useCallback(() => onDiscoverySettled?.("provider"), [onDiscoverySettled]);
  useLayoutEffect(() => {
    if (matchingExistingAssets.length === 0) savedResultsSettled();
    if (lookupResults.length === 0) providerResultsSettled();
  }, [lookupResults, matchingExistingAssets, providerResultsSettled, savedResultsSettled]);
  const selectedSavedQuote = selectedAssetId
    ? snapshot.quoteCache[selectedAssetId]
    : undefined;
  const candidateProviderQuote = selectedLookupQuote ?? selectedSavedQuote;
  const currentPriceNumber = Number(currentPrice);
  const preservesProviderQuote =
    candidateProviderQuote !== undefined &&
    Number.isFinite(currentPriceNumber) &&
    candidateProviderQuote.price === currentPriceNumber;
  const reviewQuoteSourceLabel = getReviewQuoteSourceLabel({
    currentPrice,
    preservesProviderQuote,
    selectedLookupQuote,
    selectedLookupResult,
    selectedSavedQuote,
  });
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
            ? `${quickSetupSavedCount} ${quickSetupSavedCount === 1 ? "holding" : "holdings"} saved`
            : "Record an existing investment"
        }
      />
      <AddHoldingStepper
        currentPhase={currentPhase}
        displayPhases={displayPhases}
        moveToPhase={moveToPhase}
        savedAssetId={savedAssetId}
      />

      {currentPhase === "asset" ? (
      <AddHoldingAssetPhase
        areRecentSearchesExpanded={areRecentSearchesExpanded}
        hasSelectedAssetSummary={hasSelectedAssetSummary}
        holding={holding}
        isManualEntryExpanded={isManualEntryExpanded}
        onAddPpfAccount={onAddPpfAccount}
        onDiscoveryAction={onDiscoveryAction}
        providerResultsSettled={providerResultsSettled}
        quickSetup={quickSetup}
        savedResultsSettled={savedResultsSettled}
        selectDiscoveryResult={selectDiscoveryResult}
        selectedAssetSourceLabel={selectedAssetSourceLabel}
        selectSavedResult={selectSavedResult}
        setAreRecentSearchesExpanded={setAreRecentSearchesExpanded}
        setIsManualEntryExpanded={setIsManualEntryExpanded}
        stackIdentifiers={stackIdentifiers}
      />
      ) : null}

      {currentPhase === "class" ? (
      <AddHoldingClassPhase holding={holding} />
      ) : null}

      {currentPhase === "position" ? (
      <AddHoldingPositionPhase
        holding={holding}
        now={now}
        quickSetup={quickSetup}
        setArePositionOptionsExpanded={setArePositionOptionsExpanded}
        showPositionOptions={showPositionOptions}
        store={store}
      />
      ) : null}

      {currentPhase === "review" &&
      previewHolding &&
      reviewAsset &&
      reviewOpeningPosition ? (
        <AddHoldingReview
          candidateProviderQuote={candidateProviderQuote}
          holding={holding}
          isMinimalMode={isMinimalMode}
          preservesProviderQuote={preservesProviderQuote}
          previewHolding={previewHolding}
          reviewAsset={reviewAsset}
          reviewOpeningPosition={reviewOpeningPosition}
          reviewQuoteSourceLabel={reviewQuoteSourceLabel}
        />
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

      <AddHoldingReviewDetails
        areReviewDetailsExpanded={areReviewDetailsExpanded}
        holding={holding}
        quickSetup={quickSetup}
        setArePositionOptionsExpanded={setArePositionOptionsExpanded}
        setAreReviewDetailsExpanded={setAreReviewDetailsExpanded}
      />

      <HoldingExitConfirmation
        isExitConfirmationVisible={isExitConfirmationVisible}
        onCancel={onCancel}
        quickSetup={quickSetup}
        setIsExitConfirmationVisible={setIsExitConfirmationVisible}
      />
    </ScreenContainer>
    </KeyboardAvoidingView>
  );
}
