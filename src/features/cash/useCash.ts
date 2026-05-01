import { useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

import { calculateCashBalance } from "@/src/domain/calculations";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import type { CashEntry, CashEntryType } from "@/src/types";
import { createId } from "@/src/utils";

type UseCashInput = {
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
  };
}
