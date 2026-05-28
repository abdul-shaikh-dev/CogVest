import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

import { getDefaultAssetMetadata } from "@/src/domain/assets";
import { calculateHolding } from "@/src/domain/calculations";
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
  SectorType,
} from "@/src/types";
import { createId } from "@/src/utils";

import { validateOpeningPositionForm } from "./openingPositionForm";

export type AddHoldingPhase = "asset" | "class" | "position" | "review";
export type FieldErrors = Partial<Record<string, string>>;

export type AddOpeningPositionControllerInput = {
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
  { key: "class", label: "Class" },
  { key: "position", label: "Position" },
  { key: "review", label: "Review" },
];

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useAddOpeningPosition({
  resolveQuote = defaultResolveQuote,
  searchAssetLookupResults = defaultSearchAssetLookupResults,
  store = getPortfolioStore(),
}: AddOpeningPositionControllerInput = {}) {
  const snapshot = usePortfolioSnapshot(store);
  const [currentPhase, setCurrentPhase] = useState<AddHoldingPhase>("asset");
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
    });
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
    });
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
    setLookupQuery("");
    setLookupResults([]);
    setLookupStatus("");
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
    setCurrentPhase("review");
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

  return {
    assetClass,
    assetName,
    averageCostPrice,
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
