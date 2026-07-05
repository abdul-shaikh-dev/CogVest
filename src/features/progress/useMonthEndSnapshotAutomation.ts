import { useEffect, useRef } from "react";
import type { StoreApi } from "zustand/vanilla";

import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { resolveHistoricalPrice } from "@/src/services/quotes";

import { useProgress } from "./useProgress";

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
  const progress = useProgress({ historicalPriceFetcher, now, store });
  const ensureMonthEndSnapshot = progress.ensureMonthEndSnapshot;

  useEffect(() => {
    if (!enabled || hasRunRef.current) {
      return;
    }

    hasRunRef.current = true;
    void ensureMonthEndSnapshot();
  }, [enabled, ensureMonthEndSnapshot]);

  return progress.snapshotAutomationStatus;
}
