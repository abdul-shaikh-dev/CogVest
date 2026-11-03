import {
  findCanonicalAsset,
  hasCanonicalAssetConflict,
  normalizeAssetMetadata,
} from "@/src/domain/assets";
import { normalizeOpeningPosition, normalizeQuote } from "@/src/domain/financialRecords";
import { getV1AssetCurrencyIssue, getV1QuoteCurrencyIssue } from "@/src/domain/portfolioCurrency";
import type { Quote } from "@/src/types";

import type { StoreContext } from "./storeContext";
import type { PortfolioStoreState } from "./storeTypes";
import {
  persistAssetGraphTransition,
  persistPortfolioTransition,
  persistQuoteCache,
  selectRawSnapshot,
  withoutAssetQuotes,
} from "./persistence";
import {
  assetRecordMonth,
  isValidOpeningPosition,
  openingPositionMonth,
  prepareOpeningPositionForWrite,
  quoteIdentityChanged,
  rebuildPortfolioSnapshots,
} from "./recordValidation";

type OpeningPositionActions = Pick<PortfolioStoreState,
  | "addOpeningPosition"
  | "correctOpeningPosition"
  | "deleteOpeningPosition"
  | "removeOpeningPosition"
  | "updateOpeningPosition"
  | "recordOpeningPosition">;

export function createOpeningPositionActions(context: StoreContext): OpeningPositionActions {
  const { get, now, set, storage } = context;
  return {
    addOpeningPosition: (openingPosition) => {
      const state = get();

      if (
        state.openingPositions.some(
          (position) => position.id === openingPosition.id,
        )
      ) {
        return;
      }

      const currentDate = now();
      const assetCurrency = state.assets.find(
        (asset) => asset.id === openingPosition.assetId,
      )?.currency;
      const preparedPosition = prepareOpeningPositionForWrite(
        openingPosition,
        currentDate,
      );
      if (!isValidOpeningPosition(preparedPosition, currentDate, assetCurrency)) {
        throw new Error("Opening position contains invalid financial values.");
      }
      const normalizedPosition = normalizeOpeningPosition(preparedPosition);
      if (!isValidOpeningPosition(normalizedPosition, currentDate, assetCurrency)) {
        throw new Error("Opening position contains invalid financial values.");
      }
      const openingPositions = [...state.openingPositions, normalizedPosition];

      persistPortfolioTransition(storage, state, { openingPositions });
      set({ openingPositions });
    },
    correctOpeningPosition: (openingPosition) => {
      const state = get();
      const existingPosition = state.openingPositions.find(
        (position) => position.id === openingPosition.id,
      );

      if (!existingPosition) {
        return { reason: "notFound", status: "rejected" };
      }

      if (existingPosition.assetId !== openingPosition.assetId) {
        return { reason: "assetMismatch", status: "rejected" };
      }

      const currentDate = now();
      const assetCurrency = state.assets.find(
        (asset) => asset.id === openingPosition.assetId,
      )?.currency;

      const preparedPosition = prepareOpeningPositionForWrite(
        openingPosition,
        currentDate,
        existingPosition,
      );
      if (!isValidOpeningPosition(preparedPosition, currentDate, assetCurrency)) {
        return { reason: "invalidEntry", status: "rejected" };
      }
      const normalizedPosition = normalizeOpeningPosition(preparedPosition);
      if (!isValidOpeningPosition(normalizedPosition, currentDate, assetCurrency)) {
        return { reason: "invalidEntry", status: "rejected" };
      }

      const earliestAffectedMonth = [
        openingPositionMonth(existingPosition),
        openingPositionMonth(normalizedPosition),
      ]
        .filter((month): month is string => Boolean(month))
        .sort()[0];

      if (!earliestAffectedMonth) {
        return { reason: "invalidEntry", status: "rejected" };
      }

      const openingPositions = state.openingPositions.map((position) =>
        position.id === normalizedPosition.id ? normalizedPosition : position,
      );
      const history = rebuildPortfolioSnapshots({
        earliestAffectedMonth,
        now: currentDate,
        openingPositions,
        state,
      });

      persistPortfolioTransition(storage, state, {
        monthlySnapshots: history.monthlySnapshots,
        openingPositions,
      });
      set({
        monthlySnapshots: history.monthlySnapshots,
        openingPositions,
      });

      return {
        openingPosition: normalizedPosition,
        pendingMonths: history.pendingMonths,
        provisionalMonths: history.provisionalMonths,
        refreshedMonths: history.refreshedMonths,
        status: "applied",
      };
    },
    deleteOpeningPosition: (openingPositionId) => {
      const state = get();
      const existingPosition = state.openingPositions.find(
        (position) => position.id === openingPositionId,
      );

      if (!existingPosition) {
        return { reason: "notFound", status: "rejected" };
      }

      const earliestAffectedMonth = openingPositionMonth(existingPosition);

      if (!earliestAffectedMonth) {
        return { reason: "notFound", status: "rejected" };
      }

      const openingPositions = state.openingPositions.filter(
        (position) => position.id !== openingPositionId,
      );
      const history = rebuildPortfolioSnapshots({
        earliestAffectedMonth,
        now: now(),
        openingPositions,
        state,
      });

      persistPortfolioTransition(storage, state, {
        monthlySnapshots: history.monthlySnapshots,
        openingPositions,
      });
      set({
        monthlySnapshots: history.monthlySnapshots,
        openingPositions,
      });

      return {
        openingPosition: existingPosition,
        pendingMonths: history.pendingMonths,
        provisionalMonths: history.provisionalMonths,
        refreshedMonths: history.refreshedMonths,
        status: "applied",
      };
    },
    removeOpeningPosition: (openingPositionId) => {
      get().deleteOpeningPosition(openingPositionId);
    },
    updateOpeningPosition: (openingPosition) => {
      get().correctOpeningPosition(openingPosition);
    },
    recordOpeningPosition: (input) => {
      const state = get();
      const currentDate = now();

      if (
        input.commandId.trim().length === 0 ||
        input.commandId !== input.openingPosition.id
      ) {
        throw new Error("Opening position command ID is required.");
      }

      const existingPosition = state.openingPositions.find(
        (position) => position.id === input.openingPosition.id,
      );

      if (existingPosition) {
        const existingAsset = state.assets.find(
          (asset) => asset.id === existingPosition.assetId,
        );

        return {
          asset: existingAsset ?? input.asset,
          openingPosition: existingPosition,
          quote: state.quoteCache[existingPosition.assetId] ?? input.quote,
          quoteCacheStatus: state.quoteCache[existingPosition.assetId]
            ? "cached"
            : input.quote
              ? "unavailable"
              : "notRequested",
          status: "alreadyApplied",
        };
      }

      if (
        input.quote &&
        (!Number.isFinite(input.quote.price) ||
          (input.quote.dayChangeAbs !== undefined &&
            !Number.isFinite(input.quote.dayChangeAbs)) ||
          (input.quote.dayChangePct !== undefined &&
            !Number.isFinite(input.quote.dayChangePct)))
      ) {
        throw new Error("Opening position quote contains invalid financial values.");
      }

      const preparedInputPosition = prepareOpeningPositionForWrite(
        input.openingPosition,
        currentDate,
      );
      if (
        !isValidOpeningPosition(
          preparedInputPosition,
          currentDate,
          input.asset.currency,
        )
      ) {
        throw new Error("Opening position contains invalid financial values.");
      }
      const normalizedInputPosition = normalizeOpeningPosition(
        preparedInputPosition,
      );
      const normalizedInputQuote = input.quote
        ? normalizeQuote(input.quote)
        : undefined;

      if (
        !isValidOpeningPosition(
          normalizedInputPosition,
          currentDate,
          input.asset.currency,
        )
      ) {
        throw new Error("Opening position is below supported precision.");
      }
      if (normalizedInputQuote && normalizedInputQuote.price <= 0) {
        throw new Error("Opening position quote is below supported precision.");
      }

      if (normalizedInputPosition.assetId !== input.asset.id) {
        throw new Error("Opening position must reference the command asset.");
      }

      if (
        normalizedInputQuote &&
        normalizedInputQuote.assetId !== input.asset.id
      ) {
        throw new Error("Opening position quote must reference the command asset.");
      }

      const normalizedCandidate = normalizeAssetMetadata(input.asset);
      const canonicalMatch = findCanonicalAsset(
        state.assets,
        normalizedCandidate,
      );
      const canonicalAsset = canonicalMatch
        ? { ...normalizedCandidate, id: canonicalMatch.id }
        : normalizedCandidate;

      if (hasCanonicalAssetConflict(state.assets, canonicalAsset)) {
        throw new Error("Asset identity already exists.");
      }

      const openingPosition = {
        ...normalizedInputPosition,
        assetId: canonicalAsset.id,
      };
      const quote = normalizedInputQuote
        ? { ...normalizedInputQuote, assetId: canonicalAsset.id }
        : undefined;
      const currencyIssue = getV1AssetCurrencyIssue(canonicalAsset);
      const quoteCurrencyIssue = quote
        ? getV1QuoteCurrencyIssue(canonicalAsset, quote)
        : undefined;

      if (currencyIssue || quoteCurrencyIssue) {
        throw new Error(currencyIssue ?? quoteCurrencyIssue);
      }

      const assets = canonicalMatch
        ? state.assets.map((asset) =>
            asset.id === canonicalAsset.id ? canonicalAsset : asset,
          )
        : [...state.assets, canonicalAsset];
      const openingPositions = [
        ...state.openingPositions,
        openingPosition,
      ];
      const invalidatesQuotes =
        canonicalMatch !== undefined &&
        quoteIdentityChanged(canonicalMatch, canonicalAsset);
      const baseQuoteCache = invalidatesQuotes
        ? withoutAssetQuotes(state.quoteCache, canonicalAsset.id)
        : state.quoteCache;
      const historicalQuoteCache = invalidatesQuotes
        ? withoutAssetQuotes(
            state.historicalQuoteCache,
            canonicalAsset.id,
          )
        : state.historicalQuoteCache;

      if (invalidatesQuotes) {
        const earliestAffectedMonth = assetRecordMonth(
          state,
          canonicalAsset.id,
        );
        const history = earliestAffectedMonth
          ? rebuildPortfolioSnapshots({
              assets,
              earliestAffectedMonth,
              now: now(),
              state: {
                ...state,
                historicalQuoteCache,
                openingPositions,
                quoteCache: baseQuoteCache,
              },
            })
          : {
              monthlySnapshots: state.monthlySnapshots,
            };
        const portfolio = {
          ...selectRawSnapshot(state),
          assets,
          monthlySnapshots: history.monthlySnapshots,
          openingPositions,
        };

        persistAssetGraphTransition({
          historicalQuoteCache,
          portfolio,
          quoteCache: baseQuoteCache,
          storage,
        });
        set({
          assets,
          historicalQuoteCache,
          monthlySnapshots: history.monthlySnapshots,
          openingPositions,
          quoteCache: baseQuoteCache,
        });
      } else {
        persistPortfolioTransition(storage, state, {
          assets,
          openingPositions,
        });
        set({ assets, openingPositions });
      }

      let cachedQuote: Quote | undefined;

      if (quote) {
        const quoteCache = {
          ...baseQuoteCache,
          [canonicalAsset.id]: quote,
        };

        try {
          persistQuoteCache(storage, quoteCache);
          set({ quoteCache });
          cachedQuote = quote;
        } catch {
          // Current price is durable on the opening position; quote cache can refresh later.
        }
      }

      return {
        asset: canonicalAsset,
        openingPosition,
        quote: cachedQuote,
        quoteCacheStatus: quote
          ? cachedQuote
            ? "cached"
            : "unavailable"
          : "notRequested",
        status: "applied",
      };
    },
  };
}
