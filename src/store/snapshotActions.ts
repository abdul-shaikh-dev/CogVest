import { assertValidMonthlySnapshot } from "@/src/domain/monthlySnapshotValidation";
import { normalizeMonthlySnapshot as normalizeSnapshotRecord } from "@/src/domain/financialRecords";

import type { MonthlySnapshot } from "@/src/types";

import type { StoreContext } from "./storeContext";
import type { PortfolioStoreState } from "./storeTypes";
import { persistPortfolioTransition } from "./persistence";

type SnapshotActions = Pick<PortfolioStoreState,
  | "addMonthlySnapshot"
  | "removeMonthlySnapshot"
  | "replaceMonthlySnapshots"
  | "updateMonthlySnapshot">;

export function createSnapshotActions({ get, set, storage }: StoreContext): SnapshotActions {
  return {
    addMonthlySnapshot: (monthlySnapshot) => {
      const state = get();
      const normalizedSnapshot = normalizeSnapshotRecord(monthlySnapshot);

      if (
        state.monthlySnapshots.some(
          (snapshot) => snapshot.id === monthlySnapshot.id,
        )
      ) {
        return;
      }
      assertValidMonthlySnapshot(monthlySnapshot);

      if (state.monthlySnapshots.some((snapshot) => snapshot.month === monthlySnapshot.month)) {
        throw new Error("This month already has a snapshot. Correct the existing snapshot instead.");
      }

      const monthlySnapshots = [
        ...state.monthlySnapshots,
        normalizedSnapshot,
      ];

      persistPortfolioTransition(storage, state, { monthlySnapshots });
      set({ monthlySnapshots });
    },
    removeMonthlySnapshot: (monthlySnapshotId) => {
      const state = get();
      const monthlySnapshots = state.monthlySnapshots.filter(
        (monthlySnapshot) => monthlySnapshot.id !== monthlySnapshotId,
      );
      if (monthlySnapshots.length === state.monthlySnapshots.length) return;
      persistPortfolioTransition(storage, state, { monthlySnapshots });
      set({ monthlySnapshots });
    },
    replaceMonthlySnapshots: (replacements) => {
      if (replacements.length === 0) return;
      const state = get();
      const byId = new Map<string, MonthlySnapshot>();
      for (const replacement of replacements) {
        assertValidMonthlySnapshot(replacement);
        const existing = state.monthlySnapshots.find((item) => item.id === replacement.id);
        if (!existing) throw new Error("A month changed while it was being reviewed. Review the months again.");
        if (existing.month !== replacement.month) throw new Error("A replacement must keep its month.");
        if (byId.has(replacement.id)) throw new Error("A month can only be replaced once at a time.");
        byId.set(replacement.id, normalizeSnapshotRecord(replacement));
      }
      const monthlySnapshots = state.monthlySnapshots.map((item) => byId.get(item.id) ?? item);
      persistPortfolioTransition(storage, state, { monthlySnapshots });
      set({ monthlySnapshots });
    },
    updateMonthlySnapshot: (monthlySnapshot) => {
      const state = get();
      assertValidMonthlySnapshot(monthlySnapshot);
      const existing = state.monthlySnapshots.find((item) => item.id === monthlySnapshot.id);
      if (!existing) return;
      if (state.monthlySnapshots.some((item) => item.id !== monthlySnapshot.id && item.month === monthlySnapshot.month)) {
        throw new Error("This month already has a snapshot. Correct the existing snapshot instead.");
      }
      const normalizedSnapshot = normalizeSnapshotRecord(
        existing.month === monthlySnapshot.month
          ? monthlySnapshot
          : {
              ...monthlySnapshot,
              performanceBasis: {
                reason: "manual-snapshot",
                status: "unavailable",
                warnings: ["Monthly performance is unavailable after changing the snapshot month. Review that month's contribution evidence."],
              },
              generated: monthlySnapshot.generated
                ? { ...monthlySnapshot.generated, source: "manual" }
                : undefined,
            },
      );
      const monthlySnapshots = state.monthlySnapshots.map((currentSnapshot) =>
        currentSnapshot.id === normalizedSnapshot.id
          ? normalizedSnapshot
          : currentSnapshot,
      );
      persistPortfolioTransition(storage, state, { monthlySnapshots });
      set({ monthlySnapshots });
    },
  };
}
