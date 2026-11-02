import { type UsdmFuturesAccount, validateUsdmFuturesAccount } from "@/src/domain/usdmFutures";
import { validateFuturesCashLinks } from "@/src/domain/futuresCashFunding";
import { refreshFuturesCashSnapshotHistory } from "@/src/domain/calculations";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { decimal } from "@/src/domain/precision";
import type { CashEntry } from "@/src/types";

import { parsePersistedPortfolio } from "./persistedPortfolioSchema";
import type { StoreContext } from "./storeContext";
import type { PortfolioStoreState } from "./storeTypes";
import { persistPortfolioTransition, selectRawSnapshot } from "./persistence";
import { hasNonnegativeCashTimeline } from "./tradeRules";

type FuturesActions = Pick<PortfolioStoreState,
  | "saveFuturesAccount"
  | "saveFuturesCashTransfer"
  | "deleteFuturesCashTransfer"
  | "deleteFuturesAccount">;

export function createFuturesActions({ get, now, set, storage }: StoreContext): FuturesActions {
  return {
    saveFuturesAccount: (account) => {
      const state = get();
      validateUsdmFuturesAccount(account);
      if (Date.parse(account.openingAt) > now().getTime() ||
          account.events.some((event) => Date.parse(event.at) > now().getTime()) ||
          (account.valuation && Date.parse(account.valuation.asOf) > now().getTime())) {
        throw new Error("Futures records cannot be dated in the future.");
      }
      const futuresAccounts = [
        ...state.futuresAccounts.filter((current) => current.id !== account.id),
        account,
      ];
      if (!parsePersistedPortfolio(JSON.stringify({
        ...selectRawSnapshot(state), futuresAccounts,
      })).success) {
        throw new Error("Futures account records are invalid.");
      }
      persistPortfolioTransition(storage, state, { futuresAccounts });
      set({ futuresAccounts });
    },
    saveFuturesCashTransfer: (input) => {
      const state = get();
      const account = state.futuresAccounts.find((item) => item.id === input.accountId);
      if (!account) throw new Error("Create the Futures wallet before linking Cash.");
      if (!Number.isFinite(Date.parse(input.at)) || Date.parse(input.at) > now().getTime() ||
          Date.parse(input.at) < Date.parse(account.openingAt)) {
        throw new Error("Funding date must be valid, after the starting wallet and not in the future.");
      }
      if (!Number.isFinite(input.cashAmountInr) || input.cashAmountInr <= 0 ||
          input.cashAmountInr > 1_000_000_000_000_000 || decimal(input.cashAmountInr).decimalPlaces() > 2) {
        throw new Error("Enter a positive INR Cash amount in paise.");
      }
      const existingCash = state.cashEntries.find((item) => item.id === input.cashEntryId);
      const existingEvent = account.events.find((item) => item.id === input.eventId);
      if (Boolean(existingCash) !== Boolean(existingEvent) ||
          (existingCash && (existingCash.linkedFutures?.accountId !== account.id ||
            existingCash.linkedFutures.eventId !== input.eventId ||
            existingEvent?.type !== "transfer" || existingEvent.linkedCashEntryId !== input.cashEntryId))) {
        throw new Error("Funding IDs already belong to another record.");
      }
      const amount = decimal(input.amountUsdt);
      if (amount.isZero()) throw new Error("Enter the nonzero USDT movement.");
      const cashEntry: CashEntry = {
        id: input.cashEntryId, amount: input.cashAmountInr, date: formatLocalCalendarDate(new Date(input.at)),
        label: amount.isPositive() ? "Futures wallet funding" : "Futures wallet withdrawal",
        notes: input.notes?.trim() || undefined, purpose: "futuresTransfer",
        type: amount.isPositive() ? "withdrawal" : "addition",
        linkedFutures: { accountId: account.id, eventId: input.eventId },
      };
      const event = {
        type: "transfer" as const, id: input.eventId, at: input.at,
        amountUsdt: input.amountUsdt, transferBoundary: "internal" as const,
        linkedCashEntryId: input.cashEntryId, cashDate: cashEntry.date,
        conversionFeeInr: input.conversionFeeInr,
      };
      const nextAccount: UsdmFuturesAccount = {
        ...account, events: [...account.events.filter((item) => item.id !== input.eventId), event],
        eventRates: [...(account.eventRates ?? []).filter((item) => item.eventId !== input.eventId), {
          eventId: input.eventId, inrPerUsdt: input.inrPerUsdt,
          observedAt: input.rateObservedAt, source: input.rateSource.trim(),
        }], valuation: undefined,
      };
      validateUsdmFuturesAccount(nextAccount);
      const cashEntries = [...state.cashEntries.filter((item) => item.id !== input.cashEntryId), cashEntry];
      if (!hasNonnegativeCashTimeline(cashEntries)) throw new Error("This funding would make recorded Cash negative on its date.");
      const futuresAccounts = state.futuresAccounts.map((item) => item.id === account.id ? nextAccount : item);
      validateFuturesCashLinks(cashEntries, futuresAccounts);
      if (!parsePersistedPortfolio(JSON.stringify({ ...selectRawSnapshot(state), cashEntries, futuresAccounts })).success) {
        throw new Error("Linked Futures funding cannot be safely persisted.");
      }
      const monthlySnapshots = refreshFuturesCashSnapshotHistory({
        ...state, cashEntries,
        earliestAffectedMonth: [cashEntry.date, existingCash?.date].filter((date): date is string => Boolean(date)).sort()[0].slice(0, 7),
      });
      persistPortfolioTransition(storage, state, { cashEntries, futuresAccounts, monthlySnapshots });
      set({ cashEntries, futuresAccounts, monthlySnapshots });
    },
    deleteFuturesCashTransfer: (accountId, eventId) => {
      const state = get();
      const account = state.futuresAccounts.find((item) => item.id === accountId);
      const event = account?.events.find((item) => item.id === eventId);
      if (!account || !event || event.type !== "transfer" || !event.linkedCashEntryId) {
        throw new Error("Linked Futures funding was not found.");
      }
      const removedCash = state.cashEntries.find((item) => item.id === event.linkedCashEntryId)!;
      const cashEntries = state.cashEntries.filter((item) => item.id !== event.linkedCashEntryId);
      if (!hasNonnegativeCashTimeline(cashEntries)) throw new Error("Removing this transfer would make recorded Cash negative.");
      const nextAccount: UsdmFuturesAccount = {
        ...account, events: account.events.filter((item) => item.id !== eventId),
        eventRates: account.eventRates?.filter((item) => item.eventId !== eventId), valuation: undefined,
      };
      validateUsdmFuturesAccount(nextAccount);
      const futuresAccounts = state.futuresAccounts.map((item) => item.id === accountId ? nextAccount : item);
      validateFuturesCashLinks(cashEntries, futuresAccounts);
      const monthlySnapshots = refreshFuturesCashSnapshotHistory({
        ...state, cashEntries, earliestAffectedMonth: removedCash.date.slice(0, 7),
      });
      persistPortfolioTransition(storage, state, { cashEntries, futuresAccounts, monthlySnapshots });
      set({ cashEntries, futuresAccounts, monthlySnapshots });
    },
    deleteFuturesAccount: (accountId) => {
      const state = get();
      if (!state.futuresAccounts.some((account) => account.id === accountId)) return;
      if (state.cashEntries.some((entry) => entry.linkedFutures?.accountId === accountId)) {
        throw new Error("Remove linked Cash movements in Futures before deleting this wallet.");
      }
      const futuresAccounts = state.futuresAccounts.filter((account) => account.id !== accountId);
      persistPortfolioTransition(storage, state, { futuresAccounts });
      set({ futuresAccounts });
    },
  };
}
