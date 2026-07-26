import { useState } from "react";

import type { QuoteCache } from "@/src/types";

import { refreshQuotes } from "./quoteResolver";
import type {
  QuoteRefreshFailure,
  QuoteRefreshTimeout,
  RefreshQuotesInput,
} from "./types";

type UseQuoteRefreshInput = RefreshQuotesInput;

export function useQuoteRefresh(input: UseQuoteRefreshInput) {
  const [quoteCache, setQuoteCache] = useState<QuoteCache>({});
  const [failed, setFailed] = useState<QuoteRefreshFailure[]>([]);
  const [timedOut, setTimedOut] = useState<QuoteRefreshTimeout[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refresh() {
    setIsRefreshing(true);

    try {
      const result = await refreshQuotes(input);

      setQuoteCache(result.quoteCache);
      setFailed(result.failed);
      setTimedOut(result.timedOut);

      return result;
    } finally {
      setIsRefreshing(false);
    }
  }

  return {
    failed,
    isRefreshing,
    quoteCache,
    refresh,
    timedOut,
  };
}
