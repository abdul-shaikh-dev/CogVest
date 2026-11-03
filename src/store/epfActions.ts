import { planEpfCommand, previewEpfAccountDeletion } from "@/src/domain/epf/persistence";
import { validateBackupPayload } from "@/src/domain/portfolioBackup";
import { casFolioSaltStorageKey } from "@/src/services/storage/backupKeys";
import { refreshFuturesCashSnapshotHistory } from "@/src/domain/calculations";

import type { StoreContext } from "./storeContext";
import type { PortfolioStoreState } from "./storeTypes";
import { persistPortfolioTransition, selectRawSnapshot } from "./persistence";

type EpfActions = Pick<PortfolioStoreState, "previewEpfAccountDeletion" | "applyEpfCommand">;

export function createEpfActions(context: StoreContext): EpfActions {
  const { assertBackupReady, get, now, revision, set, storage } = context;
  return {
    previewEpfAccountDeletion: (accountId) => previewEpfAccountDeletion(get().epf, accountId),
    applyEpfCommand: (command, expectedRevision) => {
      const state = get();
      assertBackupReady(state);
      const plan = planEpfCommand(state.epf, state.cashEntries, command, now().toISOString());
      if (plan.status === "alreadyApplied") return plan.status;
      if (revision(state) !== expectedRevision) throw new Error("Your portfolio changed. Review the EPF change again.");
      const affectedCashDates = [...state.cashEntries, ...plan.cashEntries]
        .filter((entry) => entry.linkedEpf).map((entry) => entry.date.slice(0, 7)).sort();
      const monthlySnapshots = affectedCashDates.length && JSON.stringify(plan.cashEntries) !== JSON.stringify(state.cashEntries)
        ? refreshFuturesCashSnapshotHistory({ ...state, cashEntries: plan.cashEntries,
          earliestAffectedMonth: affectedCashDates[0] }) : state.monthlySnapshots;
      const transition = { epf: plan.epf, cashEntries: plan.cashEntries, monthlySnapshots };
      // Enforce backup graph and collection limits before committing.
      validateBackupPayload({ portfolio: { ...selectRawSnapshot(state), ...transition },
        quoteCache: state.quoteCache, historicalQuoteCache: state.historicalQuoteCache,
        casFolioSalt: storage.getRawItem(casFolioSaltStorageKey) });
      persistPortfolioTransition(storage, state, transition);
      set(transition);
      return plan.status;
    },
  };
}
