import * as Haptics from "expo-haptics";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { StoreApi } from "zustand/vanilla";

import {
  createCanonicalAssetMatcher,
  findCanonicalAsset,
  getDefaultAssetMetadata,
} from "@/src/domain/assets";
import { calculateHolding } from "@/src/domain/calculations";
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
import { matchesDiscoveryFilter, searchSavedAssets, type DiscoveryFilter } from "./assetDiscovery";
import { readRecentAssetSearches, saveRecentAssetSearch, clearRecentAssetSearches } from "./recentAssetSearches";

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
  const [discoveryFilter, setDiscoveryFilter] = useState<DiscoveryFilter>("all");
  const [visibleResultCount, setVisibleResultCount] = useState(20);
  const [visibleSavedCount, setVisibleSavedCount] = useState(6);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { return readRecentAssetSearches(recentSearchStorage); } catch { return []; }
  });
  const [recentSearchStatus, setRecentSearchStatus] = useState("");
  const [lookupResults, setLookupResults] = useState<AssetLookupResult[]>([]);
  const [lookupResultQuery, setLookupResultQuery] = useState("");
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
  const matchingExistingAssets = useMemo(() => searchSavedAssets(snapshot.assets, lookupQuery), [lookupQuery, snapshot.assets]);
  const savedAssetMatcher = useMemo(() => createCanonicalAssetMatcher(snapshot.assets), [snapshot.assets]);
  const filteredSavedAssets = useMemo(
    () => matchingExistingAssets.filter((asset) => matchesDiscoveryFilter(asset, discoveryFilter)),
    [discoveryFilter, matchingExistingAssets],
  );
  const filteredLookupResults = useMemo(
    () =>
      lookupResultQuery === lookupQuery.trim()
        ? lookupResults
            .slice(0, 100)
            .filter(
              (asset) =>
                !savedAssetMatcher.find(asset) &&
                matchesDiscoveryFilter(asset, discoveryFilter),
            )
        : [],
    [discoveryFilter, lookupQuery, lookupResultQuery, lookupResults, savedAssetMatcher],
  );
  const visibleLookupResults = useMemo(
    () => filteredLookupResults.slice(0, visibleResultCount),
    [filteredLookupResults, visibleResultCount],
  );
  const visibleSavedAssets = useMemo(
    () => filteredSavedAssets.slice(0, visibleSavedCount),
    [filteredSavedAssets, visibleSavedCount],
  );
  useEffect(() => {
    setVisibleResultCount(20);
    setVisibleSavedCount(lookupQuery.trim() ? 20 : 6);
  }, [lookupQuery, discoveryFilter]);
  useEffect(() => { setLookupResults([]); }, [lookupQuery]);

  function loadMoreLookupResults() {
    setVisibleResultCount((count) => Math.min(count + 20, filteredLookupResults.length, 100));
  }

  function rememberSearch() {
    try { setRecentSearches(saveRecentAssetSearch(lookupQuery, recentSearchStorage)); } catch {
      setRecentSearchStatus("Recent search could not be saved on this device.");
    }
  }

  function clearSearchHistory() {
    try {
      clearRecentAssetSearches(recentSearchStorage);
      setRecentSearches([]);
      setRecentSearchStatus("");
    } catch { setRecentSearchStatus("Could not clear recent searches. Try again."); }
  }

  const previewHolding =
    reviewAsset && reviewOpeningPosition
      ? calculateHolding({
          asset: reviewAsset,
          currentPrice:
            reviewOpeningPosition.manualValuation?.price ??
            selectedLookupQuote?.price ??
            null,
          openingPositions: [reviewOpeningPosition],
          trades: [],
          valuation: reviewOpeningPosition.manualValuation
            ? {
                asOf: reviewOpeningPosition.manualValuation.asOf,
                currency: reviewOpeningPosition.manualValuation.currency,
                price: reviewOpeningPosition.manualValuation.price,
                source: "manual",
                status: "manual",
              }
            : selectedLookupQuote
              ? {
                  asOf: selectedLookupQuote.asOf,
                  currency: selectedLookupQuote.currency,
                  price: selectedLookupQuote.price,
                  source: selectedLookupQuote.source,
                  status:
                    selectedLookupQuote.source === "manual"
                      ? "manual"
                      : "fetched",
                }
              : { status: "pending" },
        })
      : undefined;

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
      dateUnknown,
      instrumentType,
      intendedHoldDays,
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
      dateUnknown,
      instrumentType: instrumentType || "stock",
      intendedHoldDays,
      notes,
      quoteSourceId,
      quantity,
      sectorType: sectorType || "other",
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
      if (result.errors.intendedHoldDays) {
        phaseErrors.intendedHoldDays = result.errors.intendedHoldDays;
      }
    }

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
    const controller = new AbortController();

    setIsLookupSearching(true);
    setLookupStatus("Searching public asset directories...");

    const timeout = setTimeout(async () => {
      try {
        const result = await searchAssetLookupResults({ query: trimmedQuery, signal: controller.signal });

        if (isCancelled) {
          return;
        }

        const providerResults = result.results.filter((lookupResult) => !savedAssetMatcher.find(lookupResult));

        setLookupResults(providerResults);
        setLookupResultQuery(trimmedQuery);
        setLookupStatus(
          providerResults.length > 0
            ? "Select a result to autofill asset details."
            : matchingExistingAssets.length > 0
              ? "This asset is already in your saved assets."
            : "No public result found. You can enter details manually.",
        );

        if (
          result.failures.length > 0 &&
          providerResults.length === 0 &&
          matchingExistingAssets.length === 0
        ) {
          setLookupStatus("Lookup unavailable. You can enter details manually.");
        } else if (result.failures.length > 0) {
          setLookupStatus("Some sources are unavailable. Showing available matches; manual entry is also available.");
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
      controller.abort();
      clearTimeout(timeout);
    };
  }, [
    lookupQuery,
    matchingExistingAssets.length,
    searchAssetLookupResults,
    snapshot.assets,
    savedAssetMatcher,
  ]);

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
    const lookupAsset = selectedLookupResult
      ? buildLookupAsset(selectedLookupResult)
      : undefined;
    const baseAsset = lookupAsset ?? selectedAsset;
    const candidate = {
      assetClass,
      currency: baseAsset?.currency ?? "INR",
      exchange:
        baseAsset?.exchange ?? (assetClass === "crypto" ? "CRYPTO" : "NSE"),
      id: selectedAssetId || createId("asset"),
      instrumentType,
      name: assetName.trim(),
      quoteSourceId: quoteSourceId.trim() || ticker.trim(),
      sectorType,
      symbol: symbol.trim().toUpperCase(),
      ticker:
        assetClass === "crypto"
          ? ticker.trim()
          : ticker.trim().toUpperCase(),
    } satisfies Asset;
    const canonicalAsset = findCanonicalAsset(snapshot.assets, candidate);

    return canonicalAsset
      ? {
          ...candidate,
          id: canonicalAsset.id,
        }
      : candidate;
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
      dateUnknown,
      instrumentType,
      intendedHoldDays,
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
    const providerQuote =
      selectedLookupQuote ??
      (selectedAsset ? snapshot.quoteCache[selectedAsset.id] : undefined);
    const usesProviderQuote =
      result.value.currentPrice !== undefined &&
      providerQuote !== undefined &&
      providerQuote.currency === asset.currency &&
      providerQuote.price === result.value.currentPrice;

    setReviewOpeningPosition({
      assetId: asset.id,
      averageCostPrice: result.value.averageCostPrice,
      conviction: result.value.conviction,
      intendedHoldDays: result.value.intendedHoldDays,
      date: result.value.date,
      id: commandId,
      ...(quickSetupDuplicate.kind === "update"
        ? {
            measuredAsOf: snapshot.openingPositions.find(
              (position) => position.id === commandId,
            )?.measuredAsOf,
          }
        : {}),
      ...(result.value.currentPrice === undefined || usesProviderQuote
        ? {}
        : {
            manualValuation: {
              asOf: now.toISOString(),
              currency: asset.currency,
              price: result.value.currentPrice,
              provenance: "user" as const,
              source: "manual" as const,
            },
          }),
      notes: result.value.notes,
      quantity: result.value.quantity,
    });
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

      const commandResult =
        quickSetupDuplicate.kind === "update"
          ? (() => {
              const correction = store
                .getState()
                .correctOpeningPosition(reviewOpeningPosition);

              if (correction.status !== "applied") {
                throw new Error("Existing opening position could not be updated.");
              }

              if (quote) {
                store.getState().upsertQuote(quote);
              }

              return {
                asset: reviewAsset,
                openingPosition: correction.openingPosition,
                quote,
                quoteCacheStatus: quote ? ("cached" as const) : ("notRequested" as const),
                status: "applied" as const,
              };
            })()
          : store.getState().recordOpeningPosition({
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
    isLookupSearching,
    lookupQuery,
    lookupResults: visibleLookupResults,
    lookupStatus,
    matchingExistingAssets: visibleSavedAssets,
    discoveryFilter,
    setDiscoveryFilter,
    recentSearches,
    recentSearchStatus,
    clearSearchHistory,
    hasMoreLookupResults: visibleResultCount < filteredLookupResults.length,
    hasMoreSavedAssets: visibleSavedCount < filteredSavedAssets.length,
    loadMoreLookupResults,
    loadMoreSavedAssets: () => setVisibleSavedCount((count) => count + 20),
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
