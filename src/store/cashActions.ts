import { normalizeCashEntry as normalizeCashRecord } from "@/src/domain/financialRecords";

import type { StoreContext } from "./storeContext";
import type { PortfolioStoreState } from "./storeTypes";
import { persistPortfolioTransition } from "./persistence";
import { isLinkedCashEntry, isValidManualCashEntry } from "./recordValidation";

type CashActions = Pick<PortfolioStoreState,
  | "addCashEntry"
  | "correctManualCashEntry"
  | "deleteManualCashEntry"
  | "removeCashEntry"
  | "updateCashEntry">;

export function createCashActions({ get, now, set, storage }: StoreContext): CashActions {
  return {
    addCashEntry: (cashEntry) => {
      const state = get();

      if (state.cashEntries.some((entry) => entry.id === cashEntry.id)) {
        return;
      }

      const normalizedCashEntry = normalizeCashRecord(cashEntry);
      if (
        !Number.isFinite(normalizedCashEntry.amount) ||
        normalizedCashEntry.amount <= 0
      ) {
        throw new Error("Cash entry amount is below supported precision.");
      }
      const cashEntries = [...state.cashEntries, normalizedCashEntry];

      persistPortfolioTransition(storage, state, { cashEntries });
      set({ cashEntries });
    },
    correctManualCashEntry: (cashEntry) => {
      const state = get();
      const existingEntry = state.cashEntries.find(
        (entry) => entry.id === cashEntry.id,
      );

      if (!existingEntry) {
        return { reason: "notFound", status: "rejected" };
      }

      if (isLinkedCashEntry(existingEntry) || isLinkedCashEntry(cashEntry)) {
        return { reason: "linkedEntry", status: "rejected" };
      }

      if (!isValidManualCashEntry(cashEntry, now())) {
        return { reason: "invalidEntry", status: "rejected" };
      }
      const normalizedEntry = normalizeCashRecord(cashEntry);
      if (!isValidManualCashEntry(normalizedEntry, now())) {
        return { reason: "invalidEntry", status: "rejected" };
      }

      const cashEntries = state.cashEntries.map((entry) =>
        entry.id === normalizedEntry.id ? normalizedEntry : entry,
      );

      persistPortfolioTransition(storage, state, { cashEntries });
      set({ cashEntries });

      return { entry: normalizedEntry, status: "applied" };
    },
    deleteManualCashEntry: (cashEntryId) => {
      const state = get();
      const existingEntry = state.cashEntries.find(
        (entry) => entry.id === cashEntryId,
      );

      if (!existingEntry) {
        return { reason: "notFound", status: "rejected" };
      }

      if (isLinkedCashEntry(existingEntry)) {
        return { reason: "linkedEntry", status: "rejected" };
      }

      const cashEntries = state.cashEntries.filter(
        (entry) => entry.id !== cashEntryId,
      );

      persistPortfolioTransition(storage, state, { cashEntries });
      set({ cashEntries });

      return { entry: existingEntry, status: "applied" };
    },
    removeCashEntry: (cashEntryId) => {
      const state = get();
      const existingEntry = state.cashEntries.find(
        (cashEntry) => cashEntry.id === cashEntryId,
      );

      if (existingEntry && isLinkedCashEntry(existingEntry)) {
        throw new Error(
          "Linked cash entries must be changed with their investment transaction.",
        );
      }

      const cashEntries = state.cashEntries.filter(
        (cashEntry) => cashEntry.id !== cashEntryId,
      );

      persistPortfolioTransition(storage, state, { cashEntries });
      set({ cashEntries });
    },
    updateCashEntry: (cashEntry) => {
      const state = get();
      const normalizedEntry = normalizeCashRecord(cashEntry);
      if (
        !Number.isFinite(normalizedEntry.amount) ||
        normalizedEntry.amount <= 0
      ) {
        throw new Error("Cash entry amount is below supported precision.");
      }
      const existingEntry = state.cashEntries.find(
        (currentEntry) => currentEntry.id === cashEntry.id,
      );

      if (
        (existingEntry && isLinkedCashEntry(existingEntry)) ||
        isLinkedCashEntry(normalizedEntry)
      ) {
        throw new Error(
          "Linked cash entries must be changed with their investment transaction.",
        );
      }

      const cashEntries = state.cashEntries.map((currentEntry) =>
        currentEntry.id === normalizedEntry.id ? normalizedEntry : currentEntry,
      );

      persistPortfolioTransition(storage, state, { cashEntries });
      set({ cashEntries });
    },
  };
}
