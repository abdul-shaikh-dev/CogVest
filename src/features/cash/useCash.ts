import { useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

import {
  calculateCashBalance,
  calculateCashMonthlyMetrics,
  type CashMonthlyMetrics,
} from "@/src/domain/calculations";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import type { CashEntry, CashEntryType } from "@/src/types";
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
  type: CashEntryType;
};

export type UseCashResult = {
  addEntry: (entry: AddCashEntryInput) => CashEntry;
  balance: number;
  entries: CashEntry[];
  maskWealthValues: boolean;
  monthlyMetrics: CashMonthlyMetrics;
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
    balance: calculateCashBalance(snapshot.cashEntries),
    entries: sortCashEntries(snapshot.cashEntries),
    maskWealthValues: snapshot.preferences.maskWealthValues,
    monthlyMetrics: calculateCashMonthlyMetrics({
      cashEntries: snapshot.cashEntries,
      now,
      openingPositions: snapshot.openingPositions,
      trades: snapshot.trades,
    }),
  };
}
