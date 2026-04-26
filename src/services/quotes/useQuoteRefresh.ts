import { useState } from "react";

import type { QuoteCache } from "@/src/types";

import { refreshQuotes } from "./quoteResolver";
import type {
  QuoteRefreshFailure,
  RefreshQuotesInput,
} from "./types";

type UseQuoteRefreshInput = RefreshQuotesInput;

export function useQuoteRefresh(input: UseQuoteRefreshInput) {
  const [quoteCache, setQuoteCache] = useState<QuoteCache>({});
  const [failures, setFailures] = useState<QuoteRefreshFailure[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refresh() {
    setIsRefreshing(true);

    try {
      const result = await refreshQuotes(input);

      setQuoteCache(result.quoteCache);
      setFailures(result.failures);

      return result;
    } finally {
      setIsRefreshing(false);
    }
  }

  return {
    failures,
    isRefreshing,
    quoteCache,
    refresh,
  };
}
