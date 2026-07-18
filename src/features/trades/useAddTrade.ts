import * as Haptics from "expo-haptics";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

import {
  getDefaultAssetMetadata,
  isInstrumentType,
  isSectorType,
} from "@/src/domain/assets";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import type {
  Asset,
  ConvictionScore,
  InstrumentType,
  SectorType,
  Trade,
  TradeType,
} from "@/src/types";
import { createId } from "@/src/utils";

import { validateTradeForm } from "./tradeForm";

type FieldErrors = Partial<Record<string, string>>;

const manualAssetId = "__manual_asset__";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useAddTrade({
  store = getPortfolioStore(),
}: {
  store?: StoreApi<PortfolioStoreState>;
} = {}) {
  const snapshot = usePortfolioSnapshot(store);
  const [type, setType] = useState<TradeType>("buy");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [assetName, setAssetName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [ticker, setTicker] = useState("");
  const [instrumentType, setInstrumentType] = useState<InstrumentType>("stock");
  const [sectorType, setSectorType] = useState<SectorType>("financialServices");
  const [quoteSourceId, setQuoteSourceId] = useState("");
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
    setInstrumentType(
      asset.instrumentType ?? getDefaultAssetMetadata(asset.assetClass).instrumentType,
    );
    setQuoteSourceId(asset.quoteSourceId ?? asset.ticker);
    setSectorType(
      asset.sectorType ?? getDefaultAssetMetadata(asset.assetClass).sectorType,
    );
    setSymbol(asset.symbol);
    setTicker(asset.ticker);
    if (quote) {
      setPricePerUnit(quote.price.toString());
    }
    resetReview();
  }

  function clearSelectedAsset() {
    setSelectedAssetId("");
    resetReview();
  }

  function buildManualAsset(): Asset {
    const trimmedTicker = ticker.trim();

    return {
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: createId("asset"),
      instrumentType,
      name: assetName.trim(),
      quoteSourceId: quoteSourceId.trim() || trimmedTicker,
      sectorType,
      symbol: symbol.trim().toUpperCase(),
      ticker: trimmedTicker.toUpperCase(),
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

    if (isManualAsset && !isInstrumentType(instrumentType)) {
      nextErrors.instrumentType = "Instrument type is not supported.";
    }

    if (isManualAsset && !isSectorType(sectorType)) {
      nextErrors.sectorType = "Sector type is not supported.";
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
      snapshot.openingPositions,
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

    const commandResult =
      reviewTrade.type === "buy"
        ? store.getState().recordFundedBuy({
            asset: selectedAsset ? undefined : reviewAsset,
            cashLabel: `${reviewAsset.name} purchase`,
            cashNotes: reviewTrade.notes,
            trade: reviewTrade,
          })
        : store.getState().recordSaleWithProceeds({
            cashLabel: `${reviewAsset.name} sale proceeds`,
            cashNotes: reviewTrade.notes,
            trade: reviewTrade,
          });

    if (!commandResult.isValid) {
      setErrors({
        cash:
          commandResult.reason === "insufficientCash"
            ? `Not enough deployable cash. Available ₹${(
                commandResult.availableCash ?? 0
              ).toFixed(2)}; required ₹${(
                commandResult.requiredCash ?? reviewTrade.totalValue
              ).toFixed(2)}.`
            : "This trade could not be saved safely. Review it and try again.",
      });
      return;
    }

    store.getState().upsertQuote({
      asOf: new Date().toISOString(),
      assetId: reviewAsset.id,
      currency: "INR",
      price: reviewTrade.pricePerUnit,
      source: "manual",
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setErrors({});
    setSuccessMessage("Holding saved.");
    setReviewTrade(undefined);
  }

  return {
    assetName,
    clearSelectedAsset,
    conviction,
    date,
    errors,
    fees,
    handleConfirm,
    handleReview,
    instrumentType,
    pricePerUnit,
    quantity,
    quoteSourceId,
    reviewAsset,
    reviewTrade,
    sectorType,
    selectAsset,
    selectedAssetId,
    setAssetName,
    setConviction,
    setDate,
    setFees,
    setInstrumentType,
    setNotes,
    setPricePerUnit,
    setQuantity,
    setQuoteSourceId,
    setSectorType,
    setSymbol,
    setTicker,
    snapshot,
    successMessage,
    symbol,
    ticker,
    type,
    updateType,
    notes,
  };
}
