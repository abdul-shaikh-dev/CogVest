import { useState } from "react";
import type { StoreApi } from "zustand/vanilla";

import { calculateHoldings } from "@/src/domain/calculations";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { getLinkedLegacyPpfAssetIds } from "@/src/domain/ppf";
import {
  refreshQuotes as defaultRefreshQuotes,
  type QuoteRefreshFailure,
  type QuoteRefreshResult,
  type QuoteRefreshTimeout,
  type RefreshQuotesInput,
} from "@/src/services/quotes";
import { describeSaveFailure, type PortfolioStoreState } from "@/src/store";
import type { Holding } from "@/src/types";

export type RefreshQuotes = (
  input: RefreshQuotesInput,
) => Promise<QuoteRefreshResult>;

export type HoldingWithQuoteMetadata = Holding & {
  quoteSource?: string;
};

/** Adds the cached quote's day change, date and source to each holding. */
export function withQuoteMetadata(
  holdings: Holding[],
  quoteCache: PortfolioStoreState["quoteCache"],
): HoldingWithQuoteMetadata[] {
  return holdings.map((holding) => {
    const cachedQuote = quoteCache[holding.asset.id];
    const { valuation } = holding;
    // Describe the price actually used: a newer manual price wins over the
    // cached quote (#717), so the quote's date and source must not label it.
    const quote = cachedQuote && valuation.status !== "pending" &&
      valuation.source === cachedQuote.source && valuation.asOf === cachedQuote.asOf
      ? cachedQuote
      : undefined;

    return {
      ...holding,
      dayChangePct: quote?.dayChangePct,
      lastUpdated:
        quote?.asOf ??
        (holding.valuation.status === "manual"
          ? holding.valuation.asOf ?? undefined
          : undefined),
      quoteSource:
        quote?.source ??
        (holding.valuation.status === "manual" ? "manual" : undefined),
    };
  });
}

type UseQuoteRefreshInput = {
  now: Date;
  refreshQuotes?: RefreshQuotes;
  store: StoreApi<PortfolioStoreState>;
};

export type QuoteRefreshState = {
  failed: QuoteRefreshFailure[];
  isRefreshing: boolean;
  refresh: () => Promise<QuoteRefreshResult>;
  /** Why the last refresh saved nothing, when it failed outright (#717). */
  refreshError?: string;
  timedOut: QuoteRefreshTimeout[];
};

export const quoteSaveFailureMessage =
  "Prices were fetched but not saved. Existing prices remain in use. Try again.";
const quoteRefreshFailureMessage =
  "Prices could not be refreshed. Existing prices remain in use. Try again.";

/**
 * Refreshes quotes for the assets still held, then saves them in one write.
 * Shared by Dashboard and Holdings so both refresh the same set (#666).
 */
export function useQuoteRefresh({
  now,
  refreshQuotes = defaultRefreshQuotes,
  store,
}: UseQuoteRefreshInput): QuoteRefreshState {
  const [failed, setFailed] = useState<QuoteRefreshFailure[]>([]);
  const [timedOut, setTimedOut] = useState<QuoteRefreshTimeout[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string>();

  async function refresh(): Promise<QuoteRefreshResult> {
    setIsRefreshing(true);
    setRefreshError(undefined);

    try {
      const currentState = store.getState();
      const linkedLegacyAssetIds = getLinkedLegacyPpfAssetIds(
        currentState.ppfAccounts,
        formatLocalCalendarDate(now),
      );
      const heldAssetIds = new Set(
        calculateHoldings({
          assets: currentState.assets,
          openingPositions: currentState.openingPositions,
          quoteCache: currentState.quoteCache,
          trades: currentState.trades,
          now,
        })
          .filter((holding) => !linkedLegacyAssetIds.has(holding.asset.id))
          .map((holding) => holding.asset.id),
      );
      const result = await refreshQuotes({
        assets: currentState.assets.filter((asset) =>
          heldAssetIds.has(asset.id),
        ),
        cachedQuotes: currentState.quoteCache,
      });

      // A restore during the request replaced the records these quotes were for.
      if (store.getState().restoreEpoch !== currentState.restoreEpoch) return result;
      // Save only quotes this request fetched, and only for assets whose record
      // and cached quote are unchanged since it started (#717). An asset
      // correction or another refresh in the meantime wins.
      const latest = store.getState();
      const fetched = result.updated.flatMap((assetId) => {
        const quote = result.quoteCache[assetId];
        const unchanged =
          latest.assets.find((asset) => asset.id === assetId) ===
            currentState.assets.find((asset) => asset.id === assetId) &&
          latest.quoteCache[assetId] === currentState.quoteCache[assetId];
        return quote && unchanged ? [quote] : [];
      });
      try {
        store.getState().upsertQuotes(fetched);
      } catch (error) {
        setRefreshError(describeSaveFailure(error, quoteSaveFailureMessage));
      }

      setFailed(result.failed);
      setTimedOut(result.timedOut);

      return result;
    } catch (error) {
      setRefreshError(describeSaveFailure(error, quoteRefreshFailureMessage));
      return { failed: [], quoteCache: {}, timedOut: [], updated: [] };
    } finally {
      setIsRefreshing(false);
    }
  }

  return { failed, isRefreshing, refresh, refreshError, timedOut };
}
