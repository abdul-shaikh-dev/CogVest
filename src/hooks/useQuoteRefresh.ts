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
import type { PortfolioStoreState } from "@/src/store";
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
    const quote = quoteCache[holding.asset.id];

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
  timedOut: QuoteRefreshTimeout[];
};

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

  async function refresh() {
    setIsRefreshing(true);

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
      store.getState().upsertQuotes(Object.values(result.quoteCache));

      setFailed(result.failed);
      setTimedOut(result.timedOut);

      return result;
    } finally {
      setIsRefreshing(false);
    }
  }

  return { failed, isRefreshing, refresh, timedOut };
}
