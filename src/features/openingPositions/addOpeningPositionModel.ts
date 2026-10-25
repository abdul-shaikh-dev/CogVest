import type { StoreApi } from "zustand/vanilla";

import { findCanonicalAsset } from "@/src/domain/assets";
import { calculateHolding } from "@/src/domain/calculations";
import { projectDemergers } from "@/src/domain/demergers";
import type { AssetLookupResult } from "@/src/services/assetLookup";
import type { PortfolioStoreState } from "@/src/store";
import type {
  Asset,
  AssetClass,
  InstrumentType,
  OpeningPosition,
  Quote,
  SectorType,
} from "@/src/types";
import { createId } from "@/src/utils";

import {
  validateOpeningPositionForm,
  type OpeningPositionFormValues,
  type ValidOpeningPositionForm,
} from "./openingPositionForm";
import type {
  FieldErrors,
  QuickSetupDuplicateState,
} from "./useAddOpeningPosition";

/** The seeded review used by visual QA. */
export function createVisualQaReviewAsset(): Asset {
  return {
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
  };
}

export function createVisualQaReviewPosition(): OpeningPosition {
  return {
    assetId: "visual-qa-review-asset",
    averageCostPrice: 1450,
    conviction: 4,
    currentPrice: 1678.25,
    date: "2024-04-15T00:00:00.000Z",
    id: "visual-qa-review-opening",
    notes: "Visual QA derived preview",
    quantity: 25,
  };
}

export function getAssetPhaseErrors({
  assetName,
  symbol,
  ticker,
}: Pick<OpeningPositionFormValues, "assetName" | "symbol" | "ticker">) {
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
  return phaseErrors;
}

/** Only the class fields are checked; position fields get placeholders. */
export function getClassPhaseErrors(fields: OpeningPositionFormValues, now: Date) {
  const { assetClass, assetName, averageCostPrice, conviction, currentPrice, date, dateUnknown, instrumentType, intendedHoldDays, notes, quoteSourceId, quantity, sectorType, symbol, ticker } = fields;
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
  return phaseErrors;
}

export function getPositionPhaseErrors(fields: OpeningPositionFormValues, now: Date) {
  const { assetClass, assetName, averageCostPrice, conviction, currentPrice, date, dateUnknown, instrumentType, intendedHoldDays, notes, quoteSourceId, quantity, sectorType, symbol, ticker } = fields;
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
  return phaseErrors;
}

export function buildLookupAsset(result: AssetLookupResult): Asset {
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

/**
 * The asset to save from the reviewed fields, reusing a saved asset's id when
 * it is the same instrument.
 */
export function createReviewedAsset({
  assetClass,
  assetName,
  assets,
  instrumentType,
  quoteSourceId,
  sectorType,
  selectedAsset,
  selectedAssetId,
  selectedLookupResult,
  symbol,
  ticker,
}: {
  assetClass: AssetClass;
  assetName: string;
  assets: Asset[];
  instrumentType: InstrumentType;
  quoteSourceId: string;
  sectorType: SectorType;
  selectedAsset: Asset | undefined;
  selectedAssetId: string;
  selectedLookupResult: AssetLookupResult | undefined;
  symbol: string;
  ticker: string;
}): Asset {
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
  const canonicalAsset = findCanonicalAsset(assets, candidate);

  return canonicalAsset
    ? {
        ...candidate,
        id: canonicalAsset.id,
      }
    : candidate;
}

/**
 * The opening position to review. A current price that matches the provider
 * quote is not stored as a manual valuation.
 */
export function buildReviewOpeningPosition({
  asset,
  commandId,
  now,
  quickSetupDuplicate,
  selectedAsset,
  selectedLookupQuote,
  snapshot,
  value,
}: {
  asset: Asset;
  commandId: string;
  now: Date;
  quickSetupDuplicate: QuickSetupDuplicateState;
  selectedAsset: Asset | undefined;
  selectedLookupQuote: Quote | undefined;
  snapshot: PortfolioStoreState;
  value: ValidOpeningPositionForm;
}): OpeningPosition {
  const providerQuote =
    selectedLookupQuote ??
    (selectedAsset ? snapshot.quoteCache[selectedAsset.id] : undefined);
  const usesProviderQuote =
    value.currentPrice !== undefined &&
    providerQuote !== undefined &&
    providerQuote.currency === asset.currency &&
    providerQuote.price === value.currentPrice;


  return {
    assetId: asset.id,
    averageCostPrice: value.averageCostPrice,
    conviction: value.conviction,
    intendedHoldDays: value.intendedHoldDays,
    date: value.date,
    id: commandId,
    ...(quickSetupDuplicate.kind === "update"
      ? {
          measuredAsOf: snapshot.openingPositions.find(
            (position) => position.id === commandId,
          )?.measuredAsOf,
        }
      : {}),
    ...(value.currentPrice === undefined || usesProviderQuote
      ? {}
      : {
          manualValuation: {
            asOf: now.toISOString(),
            currency: asset.currency,
            price: value.currentPrice,
            provenance: "user" as const,
            source: "manual" as const,
          },
        }),
    notes: value.notes,
    quantity: value.quantity,
  };
}

export function buildPreviewHolding({
  reviewAsset,
  reviewOpeningPosition,
  selectedLookupQuote,
  snapshot,
}: {
  reviewAsset: Asset | undefined;
  reviewOpeningPosition: OpeningPosition | undefined;
  selectedLookupQuote: Quote | undefined;
  snapshot: PortfolioStoreState;
}) {
  return reviewAsset && reviewOpeningPosition
    ? calculateHolding({
        asset: reviewAsset,
        demergerAdjustments: projectDemergers({
          assets: snapshot.assets,
          openingPositions: snapshot.openingPositions,
          trades: snapshot.trades,
        }).filter((adjustment) => adjustment.assetId === reviewAsset.id),
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
}

/**
 * Saves the reviewed opening position. Quick setup updates an existing
 * aggregate position in place; otherwise a new one is recorded.
 */
export function commitOpeningPosition({
  commandId,
  quickSetupDuplicate,
  quote,
  reviewAsset,
  reviewOpeningPosition,
  store,
}: {
  commandId: string;
  quickSetupDuplicate: QuickSetupDuplicateState;
  quote: Quote | undefined;
  reviewAsset: Asset;
  reviewOpeningPosition: OpeningPosition;
  store: StoreApi<PortfolioStoreState>;
}) {
  return quickSetupDuplicate.kind === "update"
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
        commandId: commandId,
        openingPosition: reviewOpeningPosition,
        quote,
      });
}

