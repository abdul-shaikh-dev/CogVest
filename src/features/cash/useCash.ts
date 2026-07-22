import { useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

import {
  calculateCashBalance,
  calculateCashMonthlyMetrics,
  type CashMonthlyMetrics,
} from "@/src/domain/calculations";
import { isEffectiveCalendarDate } from "@/src/domain/dates";
import { formatCompactINR } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import type {
  CashEntry,
  CashEntryPurpose,
  CashEntryType,
} from "@/src/types";
import { createId } from "@/src/utils";

type UseCashInput = {
  now?: Date;
  store?: StoreApi<PortfolioStoreState>;
};

type AddCashEntryInput = {
  amount: number;
  date: string;
  label: string;
  notes?: string;
  purpose: CashEntryPurpose;
  type: CashEntryType;
};

export type ManualCashEntryMode = "addition" | "withdrawal";

export type UseCashResult = {
  addEntry: (entry: AddCashEntryInput) => CashEntry;
  balance: number;
  entries: CashEntry[];
  manualEntryModes: ManualCashEntryMode[];
  maskWealthValues: boolean;
  monthlyMetrics: CashMonthlyMetrics;
  monthlyMovementSummary: string;
};

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

function sortCashEntries(entries: CashEntry[]) {
  return [...entries].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
  );
}

export function useCash({
  now = new Date(),
  store = getPortfolioStore(),
}: UseCashInput = {}): UseCashResult {
  const snapshot = usePortfolioSnapshot(store);
  const monthlyMetrics = calculateCashMonthlyMetrics({
    cashEntries: snapshot.cashEntries,
    now,
    openingPositions: snapshot.openingPositions,
    trades: snapshot.trades,
  });

  function addEntry(input: AddCashEntryInput) {
    const entry: CashEntry = {
      ...input,
      id: createId("cash"),
      notes: input.notes?.trim() || undefined,
    };

    store.getState().addCashEntry(entry);

    return entry;
  }

  return {
    addEntry,
    balance: calculateCashBalance(snapshot.cashEntries, now),
    entries: sortCashEntries(
      snapshot.cashEntries.filter((entry) =>
        isEffectiveCalendarDate(entry.date, now),
      ),
    ),
    manualEntryModes: ["addition", "withdrawal"],
    maskWealthValues: snapshot.preferences.maskWealthValues,
    monthlyMetrics,
    monthlyMovementSummary:
      monthlyMetrics.invested > 0
        ? `${formatCompactINR(monthlyMetrics.invested)} moved into investments this month`
        : "No investment cash movement this month",
  };
}
