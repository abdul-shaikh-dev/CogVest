import { useMemo } from "react";
import type { StoreApi } from "zustand/vanilla";

import { formatLocalCalendarDate } from "@/src/domain/dates";
import {
  calculateSavingsGoalProgress,
  overlappingSavingsGoalIds,
  type SavingsGoalProgress,
} from "@/src/domain/savingsGoals";
import { usePortfolioFields } from "@/src/hooks";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import type { SavingsGoal } from "@/src/types";

import { buildSavingsGoalValueSources } from "./goalValueSources";

export type SavingsGoalView = {
  goal: SavingsGoal;
  overlaps: boolean;
  progress: SavingsGoalProgress;
};

/** Goals with today's progress (#767), valued as the Dashboard values the portfolio. */
export function useSavingsGoals({ now = new Date(), store = getPortfolioStore() }: {
  now?: Date;
  store?: StoreApi<PortfolioStoreState>;
} = {}) {
  const snapshot = usePortfolioFields(store, [
    "assets", "cashEntries", "epf", "futuresAccounts", "openingPositions", "ppfAccounts",
    "ppfLedgerEntries", "preferences", "quoteCache", "savingsGoals", "trades",
  ]);
  const today = formatLocalCalendarDate(now);
  const { assets, cashEntries, epf, futuresAccounts, openingPositions, ppfAccounts, ppfLedgerEntries, quoteCache, savingsGoals, trades } = snapshot;
  const goals = useMemo<SavingsGoalView[]>(() => {
    if (savingsGoals.length === 0) return [];
    const sources = buildSavingsGoalValueSources(
      { assets, cashEntries, epf, futuresAccounts, openingPositions, ppfAccounts, ppfLedgerEntries, quoteCache, trades },
      now,
    );
    const overlapping = overlappingSavingsGoalIds(savingsGoals);
    return savingsGoals.map((goal) => ({
      goal,
      overlaps: overlapping.has(goal.id),
      progress: calculateSavingsGoalProgress(goal, sources, today),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the calendar day (today), not the per-render Date.
  }, [assets, cashEntries, epf, futuresAccounts, openingPositions, ppfAccounts, ppfLedgerEntries, quoteCache, savingsGoals, trades, today]);

  return {
    displayMode: snapshot.preferences.displayMode,
    goals,
    maskWealthValues: snapshot.preferences.maskWealthValues,
  };
}
