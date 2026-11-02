import { cashEntriesWithPpfLeg, isCashFundedPpfEntry } from "@/src/domain/ppfCashLinks";
import { planPpfCsvImport } from "@/src/domain/ppfCsvImport";
import { validatePpfAccount, validatePpfLedgerEntryForAccount } from "@/src/domain/ppf";

import type { StoreContext } from "./storeContext";
import type { PortfolioStoreState } from "./storeTypes";
import { persistPortfolioTransition } from "./persistence";
import {
  isValidPpfLegacyLink,
  isValidPpfTimeline,
  rebuildPortfolioSnapshots,
} from "./recordValidation";
import { hasNonnegativeCashTimeline } from "./tradeRules";

type PpfActions = Pick<PortfolioStoreState,
  | "importPpfCsv"
  | "addPpfAccount"
  | "addPpfLedgerEntry"
  | "correctPpfAccount"
  | "correctPpfLedgerEntry"
  | "deletePpfAccount"
  | "deletePpfLedgerEntry">;

export function createPpfActions({ get, now, set, storage }: StoreContext): PpfActions {
  return {
    importPpfCsv: ({ input, expectedState, confirmReplacement, confirmDuplicateRows }) => {
      const state = get();
      const currentDate = now();
      const plan = planPpfCsvImport(input, state.ppfAccounts, state.ppfLedgerEntries, currentDate);
      if (plan.errors.length || !plan.account) return { status: "rejected", reason: "Correct the import errors before saving." };
      if (plan.alreadyApplied) return { status: "alreadyApplied" };
      if (expectedState !== plan.expectedState) return { status: "rejected", reason: "This account changed. Generate a fresh preview before saving." };
      if (plan.requiresReplacement && confirmReplacement !== true) return { status: "rejected", reason: "Confirm replacement of this account's checkpoint and history." };
      if (plan.duplicateRows > 0 && confirmDuplicateRows !== true) return { status: "rejected", reason: "Confirm that the repeated rows represent separate transactions." };
      if (state.ppfLedgerEntries.some((entry) => entry.accountId === input.accountId && isCashFundedPpfEntry(entry))) {
        return { status: "rejected", reason: "Some entries on this account are paid from or into Cash. Delete them before replacing its history." };
      }
      const previous = state.ppfAccounts.find((account) => account.id === input.accountId)!;
      const ppfAccounts = state.ppfAccounts.map((account) => account.id === input.accountId ? plan.account! : account);
      const ppfLedgerEntries = [...state.ppfLedgerEntries.filter((entry) => entry.accountId !== input.accountId), ...plan.entries];
      const { monthlySnapshots } = rebuildPortfolioSnapshots({
        earliestAffectedMonth: [previous.balanceAsOf, plan.account.balanceAsOf].sort()[0].slice(0, 7),
        now: currentDate, state, ppfAccounts, ppfLedgerEntries,
      });
      persistPortfolioTransition(storage, state, { ppfAccounts, ppfLedgerEntries, monthlySnapshots });
      set({ ppfAccounts, ppfLedgerEntries, monthlySnapshots });
      return { status: "applied" };
    },
    addPpfAccount: (account) => {
      const state = get();
      const currentDate = now();
      const existing = state.ppfAccounts.find((item) => item.id === account.id);
      if (existing) return { account: existing, status: "alreadyApplied" };
      if (
        !isValidPpfTimeline(account, [], currentDate) ||
        !isValidPpfLegacyLink(account, state)
      ) {
        return { reason: "invalidAccount", status: "rejected" };
      }

      const ppfAccounts = [...state.ppfAccounts, account];
      const { monthlySnapshots } = rebuildPortfolioSnapshots({
        earliestAffectedMonth: account.balanceAsOf.slice(0, 7),
        now: currentDate,
        ppfAccounts,
        state,
      });
      persistPortfolioTransition(storage, state, { monthlySnapshots, ppfAccounts });
      set({ monthlySnapshots, ppfAccounts });
      return { account, status: "applied" };
    },
    addPpfLedgerEntry: (entry) => {
      const state = get();
      const currentDate = now();
      const existing = state.ppfLedgerEntries.find((item) => item.id === entry.id);
      if (existing) return { entry: existing, status: "alreadyApplied" };

      const account = state.ppfAccounts.find((item) => item.id === entry.accountId);
      if (!account) return { reason: "accountNotFound", status: "rejected" };

      const accountEntries = [
        ...state.ppfLedgerEntries.filter((item) => item.accountId === account.id),
        entry,
      ];
      if (!isValidPpfTimeline(account, accountEntries, currentDate)) {
        return {
          reason: validatePpfLedgerEntryForAccount(account, entry, currentDate).isValid
            ? "invalidTimeline"
            : "invalidEntry",
          status: "rejected",
        };
      }

      // A deposit paid from Cash owns its Cash withdrawal (D11).
      const cashEntries = cashEntriesWithPpfLeg(state.cashEntries, null, entry, account.nickname);
      if (isCashFundedPpfEntry(entry) && !hasNonnegativeCashTimeline(cashEntries)) {
        return { reason: "insufficientCash", status: "rejected" };
      }
      const ppfLedgerEntries = [...state.ppfLedgerEntries, entry];
      const { monthlySnapshots } = rebuildPortfolioSnapshots({
        cashEntries,
        earliestAffectedMonth: entry.date.slice(0, 7),
        now: currentDate,
        ppfLedgerEntries,
        state,
      });
      persistPortfolioTransition(storage, state, {
        cashEntries,
        monthlySnapshots,
        ppfLedgerEntries,
      });
      set({ cashEntries, monthlySnapshots, ppfLedgerEntries });
      return { entry, status: "applied" };
    },
    correctPpfAccount: (account) => {
      const state = get();
      const currentDate = now();
      const existing = state.ppfAccounts.find((item) => item.id === account.id);
      if (!existing) {
        return { reason: "notFound", status: "rejected" };
      }
      const entries = state.ppfLedgerEntries.filter(
        (entry) => entry.accountId === account.id,
      );
      if (
        !validatePpfAccount(account, currentDate).isValid ||
        !isValidPpfLegacyLink(account, state)
      ) {
        return { reason: "invalidAccount", status: "rejected" };
      }
      if (!isValidPpfTimeline(account, entries, currentDate)) {
        return { reason: "invalidTimeline", status: "rejected" };
      }

      const ppfAccounts = state.ppfAccounts.map((item) =>
        item.id === account.id ? account : item,
      );
      const { monthlySnapshots } = rebuildPortfolioSnapshots({
        earliestAffectedMonth: [existing.balanceAsOf, account.balanceAsOf]
          .sort()[0]
          .slice(0, 7),
        now: currentDate,
        ppfAccounts,
        state,
      });
      persistPortfolioTransition(storage, state, { monthlySnapshots, ppfAccounts });
      set({ monthlySnapshots, ppfAccounts });
      return { account, status: "applied" };
    },
    correctPpfLedgerEntry: (entry) => {
      const state = get();
      const currentDate = now();
      const existing = state.ppfLedgerEntries.find((item) => item.id === entry.id);
      if (!existing) return { reason: "notFound", status: "rejected" };
      if (existing.accountId !== entry.accountId) {
        return { reason: "accountMismatch", status: "rejected" };
      }
      const account = state.ppfAccounts.find((item) => item.id === entry.accountId);
      if (!account) return { reason: "accountNotFound", status: "rejected" };

      const candidateEntries = state.ppfLedgerEntries
        .filter((item) => item.accountId === account.id)
        .map((item) => (item.id === entry.id ? entry : item));
      if (!validatePpfLedgerEntryForAccount(account, entry, currentDate).isValid) {
        return { reason: "invalidEntry", status: "rejected" };
      }
      if (!isValidPpfTimeline(account, candidateEntries, currentDate)) {
        return { reason: "invalidTimeline", status: "rejected" };
      }

      const cashEntries = cashEntriesWithPpfLeg(state.cashEntries, existing.id, entry, account.nickname);
      if ((isCashFundedPpfEntry(existing) || isCashFundedPpfEntry(entry)) && !hasNonnegativeCashTimeline(cashEntries)) {
        return { reason: "insufficientCash", status: "rejected" };
      }
      const ppfLedgerEntries = state.ppfLedgerEntries.map((item) =>
        item.id === entry.id ? entry : item,
      );
      const { monthlySnapshots } = rebuildPortfolioSnapshots({
        cashEntries,
        earliestAffectedMonth: [existing.date, entry.date]
          .sort()[0]
          .slice(0, 7),
        now: currentDate,
        ppfLedgerEntries,
        state,
      });
      persistPortfolioTransition(storage, state, {
        cashEntries,
        monthlySnapshots,
        ppfLedgerEntries,
      });
      set({ cashEntries, monthlySnapshots, ppfLedgerEntries });
      return { entry, status: "applied" };
    },
    deletePpfAccount: (accountId) => {
      const state = get();
      const currentDate = now();
      const account = state.ppfAccounts.find((item) => item.id === accountId);
      if (!account) return { reason: "notFound", status: "rejected" };

      const deletedEntries = state.ppfLedgerEntries.filter(
        (entry) => entry.accountId === accountId,
      ).length;
      const ppfAccounts = state.ppfAccounts.filter((item) => item.id !== accountId);
      const ppfLedgerEntries = state.ppfLedgerEntries.filter(
        (entry) => entry.accountId !== accountId,
      );
      // The account's Cash legs go with it; removing a withdrawal into Cash must not overdraw later spending.
      const cashEntries = state.cashEntries.filter((cash) => cash.linkedPpf?.accountId !== accountId);
      if (cashEntries.length !== state.cashEntries.length && !hasNonnegativeCashTimeline(cashEntries)) {
        return { reason: "insufficientCash", status: "rejected" };
      }
      const earliestDate = [
        account.balanceAsOf,
        ...state.ppfLedgerEntries
          .filter((entry) => entry.accountId === accountId)
          .map((entry) => entry.date),
      ].sort()[0];
      const { monthlySnapshots } = rebuildPortfolioSnapshots({
        cashEntries,
        earliestAffectedMonth: earliestDate.slice(0, 7),
        now: currentDate,
        ppfAccounts,
        ppfLedgerEntries,
        state,
      });
      persistPortfolioTransition(storage, state, {
        cashEntries,
        monthlySnapshots,
        ppfAccounts,
        ppfLedgerEntries,
      });
      set({ cashEntries, monthlySnapshots, ppfAccounts, ppfLedgerEntries });
      return { account, deletedEntries, status: "applied" };
    },
    deletePpfLedgerEntry: (entryId) => {
      const state = get();
      const currentDate = now();
      const entry = state.ppfLedgerEntries.find((item) => item.id === entryId);
      if (!entry) return { reason: "notFound", status: "rejected" };
      const account = state.ppfAccounts.find((item) => item.id === entry.accountId);
      if (!account) return { reason: "accountNotFound", status: "rejected" };

      const candidateEntries = state.ppfLedgerEntries.filter(
        (item) => item.accountId === account.id && item.id !== entry.id,
      );
      if (!isValidPpfTimeline(account, candidateEntries, currentDate)) {
        return { reason: "invalidTimeline", status: "rejected" };
      }

      const cashEntries = cashEntriesWithPpfLeg(state.cashEntries, entry.id, null, account.nickname);
      if (isCashFundedPpfEntry(entry) && !hasNonnegativeCashTimeline(cashEntries)) {
        return { reason: "insufficientCash", status: "rejected" };
      }
      const ppfLedgerEntries = state.ppfLedgerEntries.filter(
        (item) => item.id !== entry.id,
      );
      const { monthlySnapshots } = rebuildPortfolioSnapshots({
        cashEntries,
        earliestAffectedMonth: entry.date.slice(0, 7),
        now: currentDate,
        ppfLedgerEntries,
        state,
      });
      persistPortfolioTransition(storage, state, {
        cashEntries,
        monthlySnapshots,
        ppfLedgerEntries,
      });
      set({ cashEntries, monthlySnapshots, ppfLedgerEntries });
      return { entry, status: "applied" };
    },
  };
}
