import type { StoreApi } from "zustand/vanilla";
import { getBehaviorInsightDetails } from "@/src/domain/calculations/behaviorInsightDetails";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { usePortfolioFields } from "@/src/hooks";

export function useBehaviorInsights(
  store: StoreApi<PortfolioStoreState> = getPortfolioStore(),
  now = new Date(),
) {
  const state = usePortfolioFields(store, ["assets", "openingPositions", "preferences", "trades"]);
  return {
    details: getBehaviorInsightDetails({
      ...state,
      asOf: formatLocalCalendarDate(now),
    }),
    masked: state.preferences.maskWealthValues,
    minimal: state.preferences.displayMode === "minimal",
  };
}
