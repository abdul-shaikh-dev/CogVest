import {
  findCanonicalAsset,
  hasCanonicalAssetConflict,
  normalizeAssetMetadata,
} from "@/src/domain/assets";
import { normalizeOpeningPosition, normalizeQuote } from "@/src/domain/financialRecords";
import { getV1AssetCurrencyIssue, getV1QuoteCurrencyIssue } from "@/src/domain/portfolioCurrency";

import type { StoreContext } from "./storeContext";
import type { OpeningPositionCommandResult, PortfolioStoreState } from "./storeTypes";
import { persistAssetGraphTransition, selectRawSnapshot } from "./persistence";
import {
  hasSupportedOpeningPositionPrecision,
  isValidOpeningPosition,
  openingPositionMonth,
  prepareOpeningPositionForWrite,
  rebuildPortfolioSnapshots,
} from "./recordValidation";

type BatchActions = Pick<PortfolioStoreState, "recordOpeningPositionBatch">;

export function createOpeningPositionBatchActions(context: StoreContext): BatchActions {
  const { get, now, set, storage } = context;
  return {
    recordOpeningPositionBatch: (input) => {
      const state = get();
      const currentDate = now();

      if (input.commandId.trim().length === 0 || input.items.length === 0) {
        throw new Error("Opening position batch command is required.");
      }

      const itemIds = input.items.map((item) => item.openingPosition.id);
      if (
        new Set(itemIds).size !== itemIds.length ||
        input.items.some(
          (item) =>
            item.commandId.trim().length === 0 ||
            item.commandId !== item.openingPosition.id,
        )
      ) {
        throw new Error("Opening position batch item IDs must be unique.");
      }

      const appliedItems = input.items.map((item) => {
        const existing = state.openingPositions.find(
          (position) => position.id === item.openingPosition.id,
        );
        if (!existing) return false;
        if (item.existingPosition === "add") return true;

        const canonicalAsset =
          findCanonicalAsset(state.assets, normalizeAssetMetadata(item.asset)) ??
          normalizeAssetMetadata(item.asset);
        const desired = normalizeOpeningPosition(
          prepareOpeningPositionForWrite(
            { ...item.openingPosition, assetId: canonicalAsset.id },
            currentDate,
            existing,
          ),
        );
        return JSON.stringify(existing) === JSON.stringify(desired);
      });
      const alreadyApplied = appliedItems.every(Boolean);
      if (alreadyApplied) {
        return {
          added: 0,
          items: input.items.map((item) => {
            const openingPosition = state.openingPositions.find(
              (position) => position.id === item.openingPosition.id,
            )!;
            const asset = state.assets.find(
              (candidate) => candidate.id === openingPosition.assetId,
            ) ?? item.asset;
            const quote = state.quoteCache[asset.id];
            return {
              asset,
              openingPosition,
              quote,
              quoteCacheStatus: quote ? "cached" : "notRequested",
              status: "alreadyApplied",
            };
          }),
          status: "alreadyApplied",
          updated: 0,
        };
      }

      if (appliedItems.some(Boolean)) {
        throw new Error("Opening position batch is only partially applied.");
      }

      let assets = [...state.assets];
      let openingPositions = [...state.openingPositions];
      let quoteCache = { ...state.quoteCache };
      const affectedPositionMonths: string[] = [];
      const seenAssetIds = new Set<string>();
      const results: OpeningPositionCommandResult[] = [];
      let added = 0;
      let updated = 0;

      for (const item of input.items) {
        const normalizedCandidate = normalizeAssetMetadata(item.asset);
        const canonicalMatch = findCanonicalAsset(assets, normalizedCandidate);
        const canonicalAsset = canonicalMatch ?? normalizedCandidate;

        if (
          canonicalAsset.instrumentType === "ppf" ||
          canonicalAsset.assetClass === "cash"
        ) {
          throw new Error("Account-balance instruments cannot be imported as holdings.");
        }
        if (hasCanonicalAssetConflict(assets, canonicalAsset)) {
          throw new Error("Asset identity already exists.");
        }
        if (seenAssetIds.has(canonicalAsset.id)) {
          throw new Error("Opening position batch contains the same asset twice.");
        }
        seenAssetIds.add(canonicalAsset.id);

        const currencyIssue = getV1AssetCurrencyIssue(canonicalAsset);
        if (currencyIssue) throw new Error(currencyIssue);

        const preparedPosition = prepareOpeningPositionForWrite(
          {
            ...item.openingPosition,
            assetId: canonicalAsset.id,
          },
          currentDate,
          item.existingPosition === "replace"
            ? openingPositions.find(
                (position) => position.id === item.openingPosition.id,
              )
            : undefined,
        );
        const openingPosition = normalizeOpeningPosition(preparedPosition);
        if (
          !isValidOpeningPosition(
            openingPosition,
            currentDate,
            canonicalAsset.currency,
          ) ||
          !hasSupportedOpeningPositionPrecision(openingPosition)
        ) {
          throw new Error("Opening position contains invalid financial values.");
        }

        const quote = item.quote
          ? {
              ...normalizeQuote(item.quote),
              assetId: canonicalAsset.id,
            }
          : undefined;
        if (
          quote &&
          (quote.price <= 0 || getV1QuoteCurrencyIssue(canonicalAsset, quote))
        ) {
          throw new Error("Opening position quote contains invalid financial values.");
        }

        const existingForAsset = openingPositions.filter(
          (position) => position.assetId === canonicalAsset.id,
        );
        const hasTransactions = state.trades.some(
          (trade) => trade.assetId === canonicalAsset.id,
        );

        if (item.existingPosition === "replace") {
          if (
            existingForAsset.length !== 1 ||
            existingForAsset[0].id !== openingPosition.id ||
            hasTransactions
          ) {
            throw new Error("Existing holding cannot be replaced safely.");
          }
          const previousMonth = openingPositionMonth(existingForAsset[0]);
          if (previousMonth) affectedPositionMonths.push(previousMonth);
          openingPositions = openingPositions.map((position) =>
            position.id === openingPosition.id ? openingPosition : position,
          );
          updated += 1;
        } else {
          if (existingForAsset.length > 0 || hasTransactions) {
            throw new Error("Existing holding requires an explicit safe update.");
          }
          openingPositions.push(openingPosition);
          added += 1;
        }
        const nextMonth = openingPositionMonth(openingPosition);
        if (nextMonth) affectedPositionMonths.push(nextMonth);

        if (!canonicalMatch) assets.push(canonicalAsset);
        if (quote) quoteCache[canonicalAsset.id] = quote;
        results.push({
          asset: canonicalAsset,
          openingPosition,
          quote,
          quoteCacheStatus: quote ? "cached" : "notRequested",
          status: "applied",
        });
      }

      const earliestAffectedMonth = affectedPositionMonths.sort()[0];
      const monthlySnapshots = earliestAffectedMonth
        ? rebuildPortfolioSnapshots({
            assets,
            earliestAffectedMonth,
            now: currentDate,
            openingPositions,
            state: { ...state, quoteCache },
          }).monthlySnapshots
        : state.monthlySnapshots;
      const portfolio = {
        ...selectRawSnapshot(state),
        assets,
        monthlySnapshots,
        openingPositions,
      };
      persistAssetGraphTransition({
        historicalQuoteCache: state.historicalQuoteCache,
        portfolio,
        quoteCache,
        storage,
      });
      set({ assets, monthlySnapshots, openingPositions, quoteCache });

      return { added, items: results, status: "applied", updated };
    },
  };
}
