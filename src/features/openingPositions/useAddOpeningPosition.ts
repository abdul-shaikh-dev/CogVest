import * as Haptics from "expo-haptics";
import {
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { StoreApi } from "zustand/vanilla";

import {
  findCanonicalAsset,
  getDefaultAssetMetadata,
} from "@/src/domain/assets";
import {
  getV1AssetCurrencyIssue,
  getV1QuoteCurrencyIssue,
} from "@/src/domain/portfolioCurrency";
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
import {
  getPortfolioStore,
  type OpeningPositionCommandResult,
  type PortfolioStoreState,
} from "@/src/store";
import type {
  Asset,
  AssetClass,
  ConvictionScore,
  InstrumentType,
  OpeningPosition,
  Quote,
  SectorType,
} from "@/src/types";
import { createId } from "@/src/utils";
import type { JsonStorage } from "@/src/services/storage";

import { validateOpeningPositionForm } from "./openingPositionForm";
import {
  buildLookupAsset,
  buildPreviewHolding,
  buildReviewOpeningPosition,
  commitOpeningPosition,
  createReviewedAsset,
  createVisualQaReviewAsset,
  createVisualQaReviewPosition,
  getAssetPhaseErrors,
  getClassPhaseErrors,
  getPositionPhaseErrors,
} from "./addOpeningPositionModel";
import { useAssetDiscovery } from "./useAssetDiscovery";

export type AddHoldingPhase = "asset" | "class" | "position" | "review";
export type FieldErrors = Partial<Record<string, string>>;

export type AddOpeningPositionControllerInput = {
  initialVisualQaState?: "review";
  now?: Date;
  onComplete?: (assetId: string) => void;
  quickSetup?: boolean;
  recentSearchStorage?: JsonStorage;
  resolveQuote?: (input: ResolveQuoteInput) => Promise<QuoteResult>;
  searchAssetLookupResults?: (input: {
    query: string;
    signal?: AbortSignal;
  }) => Promise<AssetLookupSearchResult>;
  store?: StoreApi<PortfolioStoreState>;
};

export type QuickSetupDuplicateState =
  | { kind: "blocked"; message: string }
  | { kind: "new" }
  | { kind: "update"; message: string; openingPositionId: string };

export const assetClasses: AssetClass[] = ["stock", "etf", "debt", "crypto"];
export const convictionScores: ConvictionScore[] = [1, 2, 3, 4, 5];
export const phases: Array<{ key: AddHoldingPhase; label: string }> = [
  { key: "asset", label: "Asset" },
  { key: "class", label: "Confirm details" },
  { key: "position", label: "Position" },
  { key: "review", label: "Review" },
];

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useAddOpeningPosition({
  initialVisualQaState,
  now = new Date(),
  onComplete,
  quickSetup = false,
  recentSearchStorage,
  resolveQuote = defaultResolveQuote,
  searchAssetLookupResults = defaultSearchAssetLookupResults,
  store = getPortfolioStore(),
}: AddOpeningPositionControllerInput = {}) {
  const snapshot = usePortfolioSnapshot(store);
  const restoreEpochRef = useRef(snapshot.restoreEpoch);
  const initialReviewAsset: Asset | undefined =
    initialVisualQaState === "review" ? createVisualQaReviewAsset() : undefined;
  const initialReviewPosition: OpeningPosition | undefined =
    initialVisualQaState === "review" ? createVisualQaReviewPosition() : undefined;
  const [currentPhase, setCurrentPhase] = useState<AddHoldingPhase>(
    initialVisualQaState === "review" ? "review" : "asset",
  );
  const discovery = useAssetDiscovery({
    assets: snapshot.assets,
    recentSearchStorage,
    searchAssetLookupResults,
  });
  const { rememberSearch, setLookupQuery, setLookupResults, setLookupStatus } = discovery;
  const [selectedLookupResult, setSelectedLookupResult] =
    useState<AssetLookupResult | undefined>();
  const [selectedLookupQuote, setSelectedLookupQuote] =
    useState<Quote | undefined>();
  const [quoteStatus, setQuoteStatus] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [assetClass, setAssetClass] = useState<AssetClass>(
    initialReviewAsset?.assetClass ?? "stock",
  );
  const [assetName, setAssetName] = useState(initialReviewAsset?.name ?? "");
  const [symbol, setSymbol] = useState(initialReviewAsset?.symbol ?? "");
  const [ticker, setTicker] = useState(initialReviewAsset?.ticker ?? "");
  const [instrumentType, setInstrumentType] = useState<InstrumentType>("stock");
  const [sectorType, setSectorType] = useState<SectorType>("other");
  const defaultMetadataReviewMessage = "Manual details. Review before saving.";
  const [metadataReviewMessage, setMetadataReviewMessage] = useState(
    defaultMetadataReviewMessage,
  );
  const [instrumentTypeConfidence, setInstrumentTypeConfidence] =
    useState<AssetLookupResult["instrumentTypeConfidence"]>("reviewRequired");
  const [sectorTypeConfidence, setSectorTypeConfidence] =
    useState<AssetLookupResult["sectorTypeConfidence"]>("reviewRequired");
  const [quoteSourceId, setQuoteSourceId] = useState(
    initialReviewAsset?.quoteSourceId ?? "",
  );
  const [quantity, setQuantity] = useState(
    initialReviewPosition?.quantity.toString() ?? "",
  );
  const [averageCostPrice, setAverageCostPrice] = useState(
    initialReviewPosition?.averageCostPrice.toString() ?? "",
  );
  const [currentPrice, setCurrentPrice] = useState(
    (
      initialReviewPosition?.manualValuation?.price ??
      initialReviewPosition?.currentPrice
    )?.toString() ?? "",
  );
  const [date, setDate] = useState(
    initialReviewPosition?.date?.slice(0, 10) ?? "",
  );
  const [dateUnknown, setDateUnknown] = useState(
    initialReviewPosition?.date === null,
  );
  const [conviction, setConviction] = useState(
    initialReviewPosition?.conviction?.toString() ?? "",
  );
  const [intendedHoldDays, setIntendedHoldDays] = useState(
    initialReviewPosition?.intendedHoldDays?.toString() ?? "",
  );
  const [notes, setNotes] = useState(initialReviewPosition?.notes ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [reviewAsset, setReviewAsset] = useState<Asset | undefined>(
    initialReviewAsset,
  );
  const [reviewOpeningPosition, setReviewOpeningPosition] =
    useState<OpeningPosition | undefined>(initialReviewPosition);
  const [successMessage, setSuccessMessage] = useState("");
  const [savedAssetId, setSavedAssetId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [quickSetupDuplicate, setQuickSetupDuplicate] =
    useState<QuickSetupDuplicateState>({ kind: "new" });
  const isSavingRef = useRef(false);
  const quoteRequestIdRef = useRef(0);
  const reviewCommandIdRef = useRef<string | undefined>(
    initialReviewPosition?.id,
  );

  const selectedAsset = useMemo(
    () => snapshot.assets.find((asset) => asset.id === selectedAssetId),
    [selectedAssetId, snapshot.assets],
  );

  const previewHolding = buildPreviewHolding({
    reviewAsset,
    reviewOpeningPosition,
    selectedLookupQuote,
    snapshot,
  });

  function resetReview() {
    setReviewAsset(undefined);
    setReviewOpeningPosition(undefined);
    setSuccessMessage("");
    reviewCommandIdRef.current = undefined;
  }

  function resetPositionFields() {
    setQuantity("");
    setAverageCostPrice("");
    setCurrentPrice("");
    setDate("");
    setDateUnknown(false);
    setConviction("");
    setIntendedHoldDays("");
    setNotes("");
  }

  function resetQuickSetupDuplicate() {
    setQuickSetupDuplicate({ kind: "new" });
  }

  function invalidateQuoteRequest() {
    quoteRequestIdRef.current += 1;
  }

  function invalidateSelectedQuote() {
    invalidateQuoteRequest();
    setSelectedLookupQuote(undefined);
    setCurrentPrice("");
    setQuoteStatus("Asset identity changed. Enter current price manually.");
  }

  function getPhaseIndex(phase: AddHoldingPhase) {
    return phases.findIndex((item) => item.key === phase);
  }

  function moveToPhase(phase: AddHoldingPhase) {
    setCurrentPhase(phase);
    setSuccessMessage("");
  }

  const formFields = {
    assetClass,
    assetName,
    averageCostPrice,
    conviction,
    currentPrice,
    date,
    dateUnknown,
    instrumentType,
    intendedHoldDays,
    notes,
    quoteSourceId,
    quantity,
    sectorType,
    symbol,
    ticker,
  };

  function validateAssetPhase() {
    const phaseErrors = getAssetPhaseErrors({ assetName, symbol, ticker });

    setErrors(phaseErrors);
    return Object.keys(phaseErrors).length === 0;
  }

  function validateClassPhase() {
    const phaseErrors = getClassPhaseErrors(formFields, now);

    setErrors(phaseErrors);
    return Object.keys(phaseErrors).length === 0;
  }

  function validatePositionPhase() {
    const phaseErrors = getPositionPhaseErrors(formFields, now);

    setErrors(phaseErrors);
    return Object.keys(phaseErrors).length === 0;
  }

  function continueFromAsset() {
    if (quickSetupDuplicate.kind === "blocked") {
      setErrors({ assetName: quickSetupDuplicate.message });
      return;
    }

    if (quickSetup && quickSetupDuplicate.kind === "new") {
      const candidate = buildReviewedAsset();
      const canonicalAsset = findCanonicalAsset(snapshot.assets, candidate);

      if (canonicalAsset) {
        selectAsset(canonicalAsset);
        return;
      }
    }

    if (validateAssetPhase() && (!quickSetup || validateClassPhase())) {
      moveToPhase(quickSetup ? "position" : "class");
    }
  }

  function continueFromClass() {
    if (validateClassPhase()) {
      moveToPhase("position");
    }
  }

  function continueFromPosition() {
    if (validatePositionPhase()) {
      handleReview();
    }
  }


  function changeSelectedAsset() {
    invalidateQuoteRequest();
    setSelectedAssetId("");
    setSelectedLookupResult(undefined);
    setSelectedLookupQuote(undefined);
    setMetadataReviewMessage(defaultMetadataReviewMessage);
    setInstrumentTypeConfidence("reviewRequired");
    setSectorTypeConfidence("reviewRequired");
    setLookupQuery("");
    setLookupResults([]);
    setLookupStatus("");
    setQuoteStatus("");
    setAssetName("");
    setSymbol("");
    setTicker("");
    setQuoteSourceId("");
    setAssetClass("stock");
    setInstrumentType("stock");
    setSectorType("other");
    setErrors({});
    resetPositionFields();
    resetReview();
    resetQuickSetupDuplicate();
  }

  function selectAsset(asset: Asset) {
    rememberSearch();
    const currencyIssue = getV1AssetCurrencyIssue(asset);

    if (currencyIssue) {
      setErrors({ assetName: currencyIssue });
      setLookupStatus(currencyIssue);
      return;
    }

    const quote = snapshot.quoteCache[asset.id];
    const openingPositions = snapshot.openingPositions.filter(
      (position) => position.assetId === asset.id,
    );
    const trades = snapshot.trades.filter((trade) => trade.assetId === asset.id);

    invalidateQuoteRequest();
    resetPositionFields();
    resetQuickSetupDuplicate();
    setSelectedAssetId(asset.id);
    setSelectedLookupResult(undefined);
    setSelectedLookupQuote(undefined);
    setAssetClass(asset.assetClass);
    setAssetName(asset.name);
    setInstrumentType(asset.instrumentType ?? getDefaultAssetMetadata(asset.assetClass).instrumentType);
    setInstrumentTypeConfidence("provider");
    setMetadataReviewMessage("Saved asset details. Confirm before continuing.");
    setQuoteSourceId(asset.quoteSourceId ?? asset.ticker);
    setSectorType(asset.sectorType ?? getDefaultAssetMetadata(asset.assetClass).sectorType);
    setSectorTypeConfidence("provider");
    setSymbol(asset.symbol);
    setTicker(asset.ticker);
    setCurrentPrice(quote?.price.toString() ?? "");
    setQuoteStatus(
      quote
        ? "Saved current price loaded."
        : "No saved current price. Enter it manually.",
    );
    setErrors({});
    resetReview();

    if (quickSetup && openingPositions.length === 1 && trades.length === 0) {
      const existing = openingPositions[0];
      setQuantity(existing.quantity.toString());
      setAverageCostPrice(existing.averageCostPrice.toString());
      setCurrentPrice(
        existing.manualValuation?.price.toString() ?? quote?.price.toString() ?? "",
      );
      setDate(existing.date?.slice(0, 10) ?? "");
      setDateUnknown(existing.date === null);
      setConviction(existing.conviction?.toString() ?? "");
      setIntendedHoldDays(existing.intendedHoldDays?.toString() ?? "");
      setNotes(existing.notes ?? "");
      setQuickSetupDuplicate({
        kind: "update",
        message: "This aggregate opening position will be updated, not duplicated.",
        openingPositionId: existing.id,
      });
    } else if (quickSetup && (openingPositions.length > 0 || trades.length > 0)) {
      setQuickSetupDuplicate({
        kind: "blocked",
        message:
          "This asset has detailed history. Add or correct it from Holdings to avoid overwriting records.",
      });
    }
  }


  async function selectLookupResult(result: AssetLookupResult) {
    rememberSearch();
    const lookupAsset = buildLookupAsset(result);
    const currencyIssue = getV1AssetCurrencyIssue(lookupAsset);

    if (currencyIssue) {
      setLookupStatus(currencyIssue);
      return;
    }

    const canonicalAsset = findCanonicalAsset(snapshot.assets, lookupAsset);

    if (quickSetup && canonicalAsset) {
      selectAsset(canonicalAsset);
      setLookupStatus("This saved asset was loaded for a safe duplicate check.");
      return;
    }
    const quoteRequestId = quoteRequestIdRef.current + 1;

    quoteRequestIdRef.current = quoteRequestId;
    resetPositionFields();
    resetQuickSetupDuplicate();
    setSelectedAssetId(canonicalAsset?.id ?? "");
    setSelectedLookupResult(result);
    setSelectedLookupQuote(undefined);
    setAssetClass(result.assetClass);
    setAssetName(result.name);
    setInstrumentType(result.instrumentType);
    setInstrumentTypeConfidence(result.instrumentTypeConfidence);
    setMetadataReviewMessage(result.metadataReviewMessage);
    setQuoteSourceId(result.quoteSourceId);
    setSectorType(result.sectorType);
    setSectorTypeConfidence(result.sectorTypeConfidence);
    setSymbol(result.symbol);
    setTicker(result.ticker);
    setLookupQuery("");
    setLookupResults([]);
    setLookupStatus("");
    setQuoteStatus("Fetching live current price...");
    setErrors({});
    resetReview();

    let quoteResult: QuoteResult;
    try {
      quoteResult = await resolveQuote({ asset: lookupAsset });
    } catch {
      if (quoteRequestId === quoteRequestIdRef.current) {
        setCurrentPrice("");
        setSelectedLookupQuote(undefined);
        setQuoteStatus("Live price unavailable. Enter current price manually.");
      }
      return;
    }

    if (quoteRequestId !== quoteRequestIdRef.current) {
      return;
    }

    if (quoteResult.ok) {
      const quoteCurrencyIssue = getV1QuoteCurrencyIssue(
        lookupAsset,
        quoteResult.quote,
      );

      if (quoteCurrencyIssue) {
        setCurrentPrice("");
        setQuoteStatus(quoteCurrencyIssue);
        return;
      }

      setSelectedLookupQuote(quoteResult.quote);
      setCurrentPrice(quoteResult.quote.price.toString());
      setQuoteStatus(`Live price autofilled from ${result.sourceLabel}.`);
      return;
    }

    setCurrentPrice("");
    setSelectedLookupQuote(undefined);
    setQuoteStatus("Live price unavailable. Enter current price manually.");
  }

  function updateAssetClass(nextAssetClass: AssetClass) {
    const defaults = getDefaultAssetMetadata(nextAssetClass);
    const identityClass =
      selectedLookupResult?.assetClass ?? selectedAsset?.assetClass;

    invalidateSelectedQuote();
    if (identityClass && identityClass !== nextAssetClass) {
      setSelectedAssetId("");
      setSelectedLookupResult(undefined);
      setMetadataReviewMessage(defaultMetadataReviewMessage);
      setInstrumentTypeConfidence("reviewRequired");
      setSectorTypeConfidence("reviewRequired");
      setQuoteSourceId("");
      setTicker("");
    }
    setAssetClass(nextAssetClass);
    setInstrumentType(defaults.instrumentType);
    setSectorType(defaults.sectorType);
    resetReview();
  }

  function updateQuoteSourceId(value: string) {
    invalidateSelectedQuote();
    setQuoteSourceId(value);
    resetReview();
  }

  function updateTicker(value: string) {
    invalidateSelectedQuote();
    setTicker(value);
    resetReview();
  }

  function buildReviewedAsset(): Asset {
    return createReviewedAsset({
      assetClass,
      assetName,
      assets: snapshot.assets,
      instrumentType,
      quoteSourceId,
      sectorType,
      selectedAsset,
      selectedAssetId,
      selectedLookupResult,
      symbol,
      ticker,
    });
  }

  function handleReview() {
    resetReview();
    const result = validateOpeningPositionForm(formFields, now);

    if (!result.isValid) {
      setErrors(result.errors);
      return;
    }

    const asset = buildReviewedAsset();
    const currencyIssue = getV1AssetCurrencyIssue(asset);

    if (currencyIssue) {
      setErrors({ assetName: currencyIssue });
      return;
    }

    setErrors({});
    setReviewAsset(asset);
    const commandId =
      quickSetupDuplicate.kind === "update"
        ? quickSetupDuplicate.openingPositionId
        : createId("opening");
    setReviewOpeningPosition(buildReviewOpeningPosition({
      asset,
      commandId,
      now,
      quickSetupDuplicate,
      selectedAsset,
      selectedLookupQuote,
      snapshot,
      value: result.value,
    }));
    reviewCommandIdRef.current = commandId;
    setCurrentPhase("review");
  }

  async function handleConfirm(): Promise<OpeningPositionCommandResult | undefined> {
    if (store.getState().restoreEpoch !== restoreEpochRef.current) return;
    if (
      !reviewAsset ||
      !reviewOpeningPosition ||
      !reviewCommandIdRef.current ||
      isSavingRef.current
    ) {
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    const providerQuote =
      selectedLookupQuote ??
      (selectedAsset ? snapshot.quoteCache[selectedAsset.id] : undefined);
    const shouldPreserveProviderQuote =
      reviewOpeningPosition.manualValuation === undefined &&
      providerQuote !== undefined &&
      providerQuote.currency === reviewAsset.currency &&
      providerQuote.price === Number(currentPrice);

    try {
      const quote = shouldPreserveProviderQuote
        ? {
            ...providerQuote,
            assetId: reviewAsset.id,
          }
        : undefined;

      const commandResult = commitOpeningPosition({
        commandId: reviewCommandIdRef.current,
        quickSetupDuplicate,
        quote,
        reviewAsset,
        reviewOpeningPosition,
        store,
      });

      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      } catch {
        // Saving and navigation must not depend on optional device feedback.
      }
      if (store.getState().restoreEpoch !== restoreEpochRef.current) return;
      setErrors({});
      setSuccessMessage(
        commandResult.quoteCacheStatus === "unavailable"
          ? "Opening position saved. Live quote will refresh later."
          : "Opening position saved.",
      );
      setSavedAssetId(commandResult.asset.id);
      return commandResult;
    } catch {
      setErrors({
        save: "This holding could not be saved safely. Review it and try again.",
      });
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }

    return undefined;
  }

  function viewSavedHolding() {
    if (savedAssetId) {
      onComplete?.(savedAssetId);
    }
  }

  function startAnotherHolding() {
    invalidateQuoteRequest();
    setSavedAssetId("");
    setSelectedAssetId("");
    setSelectedLookupResult(undefined);
    setSelectedLookupQuote(undefined);
    setLookupQuery("");
    setLookupResults([]);
    setLookupStatus("");
    setQuoteStatus("");
    setAssetClass("stock");
    setAssetName("");
    setSymbol("");
    setTicker("");
    setInstrumentType("stock");
    setSectorType("other");
    setQuoteSourceId("");
    setMetadataReviewMessage(defaultMetadataReviewMessage);
    setInstrumentTypeConfidence("reviewRequired");
    setSectorTypeConfidence("reviewRequired");
    setErrors({});
    resetPositionFields();
    resetReview();
    resetQuickSetupDuplicate();
    setCurrentPhase("asset");
  }

  return {
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
    handleReview,
    instrumentType,
    intendedHoldDays,
    instrumentTypeConfidence,
    isSaving,
    isLookupSearching: discovery.isLookupSearching,
    canRetryLookup: discovery.canRetryLookup,
    lookupQuery: discovery.lookupQuery,
    lookupResults: discovery.lookupResults,
    lookupStatus: discovery.lookupStatus,
    retryLookup: discovery.retryLookup,
    matchingExistingAssets: discovery.matchingExistingAssets,
    discoveryFilter: discovery.discoveryFilter,
    setDiscoveryFilter: discovery.setDiscoveryFilter,
    recentSearches: discovery.recentSearches,
    recentSearchStatus: discovery.recentSearchStatus,
    clearSearchHistory: discovery.clearSearchHistory,
    hasMoreLookupResults: discovery.hasMoreLookupResults,
    hasMoreSavedAssets: discovery.hasMoreSavedAssets,
    loadMoreLookupResults: discovery.loadMoreLookupResults,
    loadMoreSavedAssets: discovery.loadMoreSavedAssets,
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
    setQuoteSourceId,
    setQuoteStatus,
    setSectorType,
    setSymbol,
    setTicker,
    snapshot,
    startAnotherHolding,
    successMessage,
    symbol,
    ticker,
    updateAssetClass,
    updateQuoteSourceId,
    updateTicker,
    viewSavedHolding,
  };
}

export type AddOpeningPositionController = ReturnType<typeof useAddOpeningPosition>;
