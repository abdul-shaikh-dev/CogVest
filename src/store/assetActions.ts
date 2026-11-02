import { validateEpfLegacyLinks } from "@/src/domain/epf/legacyLinks";
import { distributionGraphProblems } from "@/src/domain/distributions";
import { normalizeAssetMetadata } from "@/src/domain/assets";
import { getV1AssetCurrencyIssue } from "@/src/domain/portfolioCurrency";

import type { StoreContext } from "./storeContext";
import type { PortfolioStoreState } from "./storeTypes";
import {
  persistAssetGraphTransition,
  persistPortfolioTransition,
  selectRawSnapshot,
  withoutAssetQuotes,
} from "./persistence";
import {
  assetRecordMonth,
  hasDuplicateAssetIdentity,
  hasValidAssetIdentity,
  quoteIdentityChanged,
  rebuildPortfolioSnapshots,
  validAssetClasses,
} from "./recordValidation";
import { hasNonnegativeCashTimeline } from "./tradeRules";

type AssetActions = Pick<PortfolioStoreState,
  | "addAsset"
  | "correctAsset"
  | "deleteAsset"
  | "removeAsset"
  | "updateAsset">;

export function createAssetActions({ get, now, set, storage }: StoreContext): AssetActions {
  return {
    addAsset: (asset) => {
      const state = get();

      if (state.assets.some((currentAsset) => currentAsset.id === asset.id)) {
        return;
      }

      const currencyIssue = getV1AssetCurrencyIssue(asset);

      if (currencyIssue) {
        throw new Error(currencyIssue);
      }

      const normalizedAsset = normalizeAssetMetadata(asset);

      if (hasDuplicateAssetIdentity(state.assets, normalizedAsset)) {
        throw new Error("Asset identity already exists.");
      }

      const assets = [...state.assets, normalizedAsset];

      persistPortfolioTransition(storage, state, { assets });
      set({ assets });
    },
    correctAsset: (input) => {
      const state = get();
      const existingAsset = state.assets.find((asset) => asset.id === input.id);

      if (!existingAsset) return { reason: "notFound", status: "rejected" };
      if (
        typeof input.name !== "string" ||
        typeof input.symbol !== "string" ||
        typeof input.ticker !== "string" ||
        (input.quoteSourceId !== undefined &&
          typeof input.quoteSourceId !== "string") ||
        !validAssetClasses.includes(input.assetClass)
      ) {
        return { reason: "invalidAsset", status: "rejected" };
      }

      const asset = normalizeAssetMetadata({ ...input, ...(existingAsset.stockSplits ? { stockSplits: existingAsset.stockSplits } : {}), ...(existingAsset.demerger ? { demerger: existingAsset.demerger } : {}) });
      if ((existingAsset.demerger || state.assets.some((item) => item.demerger?.childAssetId === existingAsset.id)) &&
          (asset.isin !== existingAsset.isin || asset.currency !== existingAsset.currency || asset.assetClass !== existingAsset.assetClass)) return { reason: "invalidAsset", status: "rejected" };
      try {
        validateEpfLegacyLinks(state.epf.accounts, state.assets.map((item) => (item.id === asset.id ? asset : item)));
      } catch {
        return { reason: "linkedEpf", status: "rejected" };
      }
      // Payouts are INR and need a non-Cash asset; a correction must not strand them.
      if (distributionGraphProblems({ ...selectRawSnapshot(state), assets: state.assets.map((item) => (item.id === asset.id ? asset : item)) }).length > 0) {
        return { reason: "linkedPayout", status: "rejected" };
      }
      if (!hasValidAssetIdentity(asset)) {
        return { reason: "invalidAsset", status: "rejected" };
      }
      if (hasDuplicateAssetIdentity(state.assets, asset)) {
        return { reason: "duplicateIdentity", status: "rejected" };
      }

      const assets = state.assets.map((currentAsset) =>
        currentAsset.id === asset.id ? asset : currentAsset,
      );
      const invalidatesQuotes = quoteIdentityChanged(existingAsset, asset);
      const quoteCache = invalidatesQuotes
        ? withoutAssetQuotes(state.quoteCache, asset.id)
        : state.quoteCache;
      const historicalQuoteCache = invalidatesQuotes
        ? withoutAssetQuotes(state.historicalQuoteCache, asset.id)
        : state.historicalQuoteCache;
      const earliestAffectedMonth = assetRecordMonth(state, asset.id);
      const history = earliestAffectedMonth
        ? rebuildPortfolioSnapshots({
            assets,
            earliestAffectedMonth,
            now: now(),
            state: {
              ...state,
              historicalQuoteCache,
              quoteCache,
            },
          })
        : {
            monthlySnapshots: state.monthlySnapshots,
            pendingMonths: [],
            provisionalMonths: [],
            refreshedMonths: [],
          };
      const portfolio = {
        ...selectRawSnapshot(state),
        assets,
        monthlySnapshots: history.monthlySnapshots,
      };

      persistAssetGraphTransition({
        historicalQuoteCache,
        portfolio,
        quoteCache,
        storage,
      });
      set({
        assets,
        historicalQuoteCache,
        monthlySnapshots: history.monthlySnapshots,
        quoteCache,
      });

      return {
        asset,
        pendingMonths: history.pendingMonths,
        provisionalMonths: history.provisionalMonths,
        quoteCacheInvalidated: invalidatesQuotes,
        refreshedMonths: history.refreshedMonths,
        status: "applied",
      };
    },
    deleteAsset: (assetId) => {
      const state = get();
      const asset = state.assets.find((item) => item.id === assetId);
      if (!asset) return { reason: "notFound", status: "rejected" };
      if (asset.demerger || state.assets.some((item) => item.demerger?.childAssetId === assetId)) return { reason: "linkedDemerger", status: "rejected" };
      if (state.epf.accounts.some((account) => account.legacyAssetId === assetId)) return { reason: "linkedEpf", status: "rejected" };
      if (state.distributions.some((item) => item.assetId === assetId)) return { reason: "linkedPayout", status: "rejected" };

      const removedTrades = state.trades.filter(
        (trade) => trade.assetId === assetId,
      );
      const removedTradeIds = new Set(removedTrades.map((trade) => trade.id));
      const linkedCashEntries = state.cashEntries.filter(
        (entry) =>
          Boolean(entry.linkedTradeId) &&
          removedTradeIds.has(entry.linkedTradeId ?? ""),
      );
      const assets = state.assets.filter((item) => item.id !== assetId);
      const openingPositions = state.openingPositions.filter(
        (position) => position.assetId !== assetId,
      );
      const trades = state.trades.filter((trade) => trade.assetId !== assetId);
      const cashEntries = state.cashEntries.filter(
        (entry) => !removedTradeIds.has(entry.linkedTradeId ?? ""),
      );
      if (!hasNonnegativeCashTimeline(cashEntries)) {
        return { reason: "insufficientCash", status: "rejected" };
      }
      const quoteCache = withoutAssetQuotes(state.quoteCache, assetId);
      const historicalQuoteCache = withoutAssetQuotes(
        state.historicalQuoteCache,
        assetId,
      );
      const earliestAffectedMonth = assetRecordMonth(state, assetId);
      const affectedAutomaticSnapshots = earliestAffectedMonth
        ? state.monthlySnapshots.filter(
            (snapshot) =>
              snapshot.month >= earliestAffectedMonth &&
              snapshot.generated?.source === "auto",
          ).length
        : 0;
      const history = earliestAffectedMonth
        ? rebuildPortfolioSnapshots({
            assets,
            cashEntries,
            earliestAffectedMonth,
            now: now(),
            openingPositions,
            state: {
              ...state,
              historicalQuoteCache,
              quoteCache,
            },
            trades,
          })
        : {
            monthlySnapshots: state.monthlySnapshots,
            pendingMonths: [],
            provisionalMonths: [],
            refreshedMonths: [],
          };
      const portfolio = {
        ...selectRawSnapshot(state),
        assets,
        cashEntries,
        monthlySnapshots: history.monthlySnapshots,
        openingPositions,
        trades,
      };

      persistAssetGraphTransition({
        historicalQuoteCache,
        portfolio,
        quoteCache,
        storage,
      });
      set({
        assets,
        cashEntries,
        historicalQuoteCache,
        monthlySnapshots: history.monthlySnapshots,
        openingPositions,
        quoteCache,
        trades,
      });

      return {
        asset,
        impact: {
          automaticSnapshots: affectedAutomaticSnapshots,
          historicalQuotes:
            Object.keys(state.historicalQuoteCache).length -
            Object.keys(historicalQuoteCache).length,
          linkedCashEntries: linkedCashEntries.length,
          openingPositions:
            state.openingPositions.length - openingPositions.length,
          quotes:
            Object.keys(state.quoteCache).length - Object.keys(quoteCache).length,
          trades: removedTrades.length,
        },
        pendingMonths: history.pendingMonths,
        provisionalMonths: history.provisionalMonths,
        refreshedMonths: history.refreshedMonths,
        status: "applied",
      };
    },
    removeAsset: (assetId) => {
      get().deleteAsset(assetId);
    },
    updateAsset: (asset) => {
      const result = get().correctAsset(asset);
      if (result.status === "rejected") {
        throw new Error(`Asset update rejected: ${result.reason}.`);
      }
    },
  };
}
