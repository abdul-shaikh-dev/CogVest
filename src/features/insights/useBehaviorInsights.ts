import { useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";
import { getBehaviorInsightDetails } from "@/src/domain/calculations/behaviorInsightDetails";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";

export function useBehaviorInsights(
  store: StoreApi<PortfolioStoreState> = getPortfolioStore(),
  now = new Date(),
) {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState,
  );
  return {
    details: getBehaviorInsightDetails({
      ...state,
      asOf: formatLocalCalendarDate(now),
    }),
    masked: state.preferences.maskWealthValues,
    minimal: state.preferences.displayMode === "minimal",
  };
}
