import { useEffect, useRef } from "react";
import type { StoreApi } from "zustand/vanilla";

import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { resolveHistoricalPrice } from "@/src/services/quotes";

import { ensureMonthEndSnapshotForStore } from "./useProgress";

// Runs once at app start. It deliberately skips useProgress: building the
// Progress view at the root replayed the portfolio on launch and on every
// store change (#138).
export function useMonthEndSnapshotAutomation({
  enabled = true,
  historicalPriceFetcher = resolveHistoricalPrice,
  now,
  store = getPortfolioStore(),
}: {
  enabled?: boolean;
  historicalPriceFetcher?: typeof resolveHistoricalPrice;
  now?: Date;
  store?: StoreApi<PortfolioStoreState>;
} = {}) {
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!enabled || hasRunRef.current) {
      return;
    }

    hasRunRef.current = true;
    void ensureMonthEndSnapshotForStore({
      historicalPriceFetcher,
      now,
      retryProvisional: false,
      store,
    });
  }, [enabled, historicalPriceFetcher, now, store]);
}
