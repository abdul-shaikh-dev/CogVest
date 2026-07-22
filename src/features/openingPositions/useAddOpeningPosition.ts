import * as Haptics from "expo-haptics";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { StoreApi } from "zustand/vanilla";

import { getDefaultAssetMetadata } from "@/src/domain/assets";
import { calculateHolding } from "@/src/domain/calculations";
import { formatLocalCalendarDate } from "@/src/domain/dates";
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
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
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

import { validateOpeningPositionForm } from "./openingPositionForm";

export type AddHoldingPhase = "asset" | "class" | "position" | "review";
export type FieldErrors = Partial<Record<string, string>>;

export type AddOpeningPositionControllerInput = {
  initialVisualQaState?: "review";
  now?: Date;
  onComplete?: (assetId: string) => void;
  resolveQuote?: (input: ResolveQuoteInput) => Promise<QuoteResult>;
  searchAssetLookupResults?: (input: {
    query: string;
  }) => Promise<AssetLookupSearchResult>;
  store?: StoreApi<PortfolioStoreState>;
};

export const assetClasses: AssetClass[] = ["stock", "etf", "debt", "crypto"];
export const convictionScores: ConvictionScore[] = [1, 2, 3, 4, 5];
export const phases: Array<{ key: AddHoldingPhase; label: string }> = [
  { key: "asset", label: "Asset" },
  { key: "class", label: "Metadata" },
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
  resolveQuote = defaultResolveQuote,
  searchAssetLookupResults = defaultSearchAssetLookupResults,
  store = getPortfolioStore(),
}: AddOpeningPositionControllerInput = {}) {
  const snapshot = usePortfolioSnapshot(store);
  const initialReviewAsset: Asset | undefined =
    initialVisualQaState === "review"
      ? {
          assetClass: "stock",
          currency: "INR",
          exchange: "NSE",
          id: "visual-qa-review-asset",
          instrumentType: "stock",
          name: "HDFC Bank",
          quoteSourceId: "HDFCBANK.NS",
          sectorType: "financialServices",
          symbol: "HDFCBANK",
          ticker: "HDFCBANK.NS",
        }
      : undefined;
  const initialReviewPosition: OpeningPosition | undefined =
    initialVisualQaState === "review"
      ? {
          assetId: "visual-qa-review-asset",
          averageCostPrice: 1450,
          conviction: 4,
          currentPrice: 1678.25,
          date: "2024-04-15T00:00:00.000Z",
          id: "visual-qa-review-opening",
          notes: "Visual QA derived preview",
          quantity: 25,
        }
      : undefined;
  const [currentPhase, setCurrentPhase] = useState<AddHoldingPhase>(
    initialVisualQaState === "review" ? "review" : "asset",
  );
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResults, setLookupResults] = useState<AssetLookupResult[]>([]);
  const [selectedLookupResult, setSelectedLookupResult] =
    useState<AssetLookupResult | undefined>();
  const [selectedLookupQuote, setSelectedLookupQuote] =
    useState<Quote | undefined>();
  const [isLookupSearching, setIsLookupSearching] = useState(false);
  const [lookupStatus, setLookupStatus] = useState("");
  const [quoteStatus, setQuoteStatus] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [assetClass, setAssetClass] = useState<AssetClass>(
    initialReviewAsset?.assetClass ?? "stock",
  );
  const [assetName, setAssetName] = useState(initialReviewAsset?.name ?? "");
  const [symbol, setSymbol] = useState(initialReviewAsset?.symbol ?? "");
  const [ticker, setTicker] = useState(initialReviewAsset?.ticker ?? "");
  const [instrumentType, setInstrumentType] = useState<InstrumentType>("stock");
  const [sectorType, setSectorType] = useState<SectorType>("financialServices");
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
    initialReviewPosition?.currentPrice?.toString() ?? "",
  );
  const [date, setDate] = useState(
    initialReviewPosition?.date.slice(0, 10) ?? formatLocalCalendarDate(now),
  );
  const [conviction, setConviction] = useState(
    initialReviewPosition?.conviction?.toString() ?? "",
  );
  const [notes, setNotes] = useState(initialReviewPosition?.notes ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [reviewAsset, setReviewAsset] = useState<Asset | undefined>(
    initialReviewAsset,
  );
  const [reviewOpeningPosition, setReviewOpeningPosition] =
    useState<OpeningPosition | undefined>(initialReviewPosition);
  const [successMessage, setSuccessMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const reviewCommandIdRef = useRef<string | undefined>(
    initialReviewPosition?.id,
  );

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
    reviewCommandIdRef.current = undefined;
  }

  function getPhaseIndex(phase: AddHoldingPhase) {
    return phases.findIndex((item) => item.key === phase);
  }

  function moveToPhase(phase: AddHoldingPhase) {
    setCurrentPhase(phase);
    setSuccessMessage("");
  }

  function validateAssetPhase() {
    const phaseErrors: FieldErrors = {};

    if (assetName.trim().length === 0) {
      phaseErrors.assetName = "Asset name is required.";
    }

    if (symbol.trim().length === 0) {
      phaseErrors.symbol = "Symbol is required.";
    }

    if (ticker.trim().length === 0) {
      phaseErrors.ticker = "Ticker is required.";
    }

    setErrors(phaseErrors);
    return Object.keys(phaseErrors).length === 0;
  }

  function validateClassPhase() {
    const result = validateOpeningPositionForm({
      assetClass,
      assetName: assetName || "Phase validation asset",
      averageCostPrice: averageCostPrice || "1",
      conviction,
      currentPrice: currentPrice || "1",
      date,
      instrumentType,
      notes,
      quoteSourceId,
      quantity: quantity || "1",
      sectorType,
      symbol: symbol || "PHASE",
      ticker: ticker || "PHASE.NS",
    }, now);
    const phaseErrors: FieldErrors = {};

    if (!result.isValid) {
      if (result.errors.instrumentType) {
        phaseErrors.instrumentType = result.errors.instrumentType;
      }
      if (result.errors.sectorType) {
        phaseErrors.sectorType = result.errors.sectorType;
      }
    }

    setErrors(phaseErrors);
    return Object.keys(phaseErrors).length === 0;
  }

  function validatePositionPhase() {
    const result = validateOpeningPositionForm({
      assetClass,
      assetName: assetName || "Phase validation asset",
      averageCostPrice,
      conviction,
      currentPrice,
      date,
      instrumentType: instrumentType || "stock",
      notes,
      quoteSourceId,
      quantity,
      sectorType: sectorType || "financialServices",
      symbol: symbol || "PHASE",
      ticker: ticker || "PHASE.NS",
    }, now);
    const phaseErrors: FieldErrors = {};

    if (!result.isValid) {
      if (result.errors.quantity) {
        phaseErrors.quantity = result.errors.quantity;
      }
      if (result.errors.averageCostPrice) {
        phaseErrors.averageCostPrice = result.errors.averageCostPrice;
      }
      if (result.errors.currentPrice) {
        phaseErrors.currentPrice = result.errors.currentPrice;
      }
      if (result.errors.date) {
        phaseErrors.date = result.errors.date;
      }
      if (result.errors.conviction) {
        phaseErrors.conviction = result.errors.conviction;
      }
    }

    setErrors(phaseErrors);
    return Object.keys(phaseErrors).length === 0;
  }

  function continueFromAsset() {
    if (validateAssetPhase()) {
      moveToPhase("class");
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
    if (selectedLookupResult) {
      setSelectedLookupResult(undefined);
    }
    setSelectedLookupQuote(undefined);
    setMetadataReviewMessage(defaultMetadataReviewMessage);
    setInstrumentTypeConfidence("reviewRequired");
    setSectorTypeConfidence("reviewRequired");
  }

  function clearSavedAssetSelection() {
    if (selectedAssetId) {
      setSelectedAssetId("");
      setMetadataReviewMessage(defaultMetadataReviewMessage);
      setInstrumentTypeConfidence("reviewRequired");
      setSectorTypeConfidence("reviewRequired");
    }
  }

  function changeSelectedAsset() {
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
    resetReview();
  }

  function selectAsset(asset: Asset) {
    const currencyIssue = getV1AssetCurrencyIssue(asset);

    if (currencyIssue) {
      setErrors({ assetName: currencyIssue });
      setLookupStatus(currencyIssue);
      return;
    }

    const quote = snapshot.quoteCache[asset.id];

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
    const lookupAsset = buildLookupAsset(result);
    const currencyIssue = getV1AssetCurrencyIssue(lookupAsset);

    if (currencyIssue) {
      setLookupStatus(currencyIssue);
      return;
    }

    setSelectedAssetId("");
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
    resetReview();

    const quoteResult = await resolveQuote({ asset: lookupAsset });

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
    }, now);

    if (!result.isValid) {
      setErrors(result.errors);
      return;
    }

    const assetId = selectedAsset?.id ?? createId("asset");
    const asset =
      selectedAsset ??
      (selectedLookupResult
        ? {
            ...buildLookupAsset(selectedLookupResult),
            instrumentType,
            sectorType,
          }
        : buildManualAsset(assetId));
    const currencyIssue = getV1AssetCurrencyIssue(asset);

    if (currencyIssue) {
      setErrors({ assetName: currencyIssue });
      return;
    }

    setErrors({});
    setReviewAsset(asset);
    const commandId = createId("opening");

    setReviewOpeningPosition({
      assetId: asset.id,
      averageCostPrice: result.value.averageCostPrice,
      conviction: result.value.conviction,
      currentPrice: result.value.currentPrice,
      date: result.value.date,
      id: commandId,
      notes: result.value.notes,
      quantity: result.value.quantity,
    });
    reviewCommandIdRef.current = commandId;
    setCurrentPhase("review");
  }

  async function handleConfirm() {
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
    const storedPrice = reviewOpeningPosition.currentPrice ?? 0;
    const providerQuote = selectedAsset
      ? snapshot.quoteCache[selectedAsset.id]
      : selectedLookupQuote;
    const shouldPreserveProviderQuote =
      providerQuote !== undefined &&
      providerQuote.currency === reviewAsset.currency &&
      providerQuote.price === storedPrice;

    try {
      const quote = shouldPreserveProviderQuote
        ? {
            ...providerQuote,
            assetId: reviewAsset.id,
          }
        : {
            asOf: new Date().toISOString(),
            assetId: reviewAsset.id,
            currency: "INR" as const,
            price: storedPrice,
            source: "manual" as const,
          };

      const commandResult = store.getState().recordOpeningPosition({
        asset: reviewAsset,
        commandId: reviewCommandIdRef.current,
        openingPosition: reviewOpeningPosition,
        quote,
      });

      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      } catch {
        // Saving and navigation must not depend on optional device feedback.
      }
      setErrors({});
      setSuccessMessage(
        commandResult.quoteCacheStatus === "unavailable"
          ? "Opening position saved. Live quote will refresh later."
          : "Opening position saved.",
      );
      setReviewOpeningPosition(undefined);
      onComplete?.(reviewAsset.id);
    } catch {
      setErrors({
        save: "This holding could not be saved safely. Review it and try again.",
      });
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }

  return {
    assetClass,
    assetName,
    averageCostPrice,
    changeSelectedAsset,
    clearSavedAssetSelection,
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
    handleReview,
    instrumentType,
    instrumentTypeConfidence,
    isSaving,
    isLookupSearching,
    lookupQuery,
    lookupResults,
    lookupStatus,
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
    sectorType,
    sectorTypeConfidence,
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
  };
}
