import { decimal, isWithinQuantum, moneyQuantum } from "@/src/domain/precision";
import { getCalendarDatePart } from "@/src/domain/dates";
import type { CashEntry } from "@/src/types";
import type { UsdmFuturesAccount } from "./usdmFutures";

export function validateFuturesCashLinks(cashEntries: CashEntry[], accounts: UsdmFuturesAccount[]): void {
  const cashById = new Map(cashEntries.map((entry) => [entry.id, entry]));
  const seenCash = new Set<string>();
  const seenEvents = new Set<string>();

  for (const account of accounts) {
    for (const event of account.events) {
      if (event.type !== "transfer" || !event.linkedCashEntryId) continue;
      if (event.transferBoundary !== "internal" || Date.parse(event.at) < Date.parse(account.openingAt)) {
        throw new Error("Linked Futures transfers must be internal and after the starting wallet.");
      }
      if (seenCash.has(event.linkedCashEntryId)) throw new Error("A Cash entry can fund only one Futures transfer.");
      seenCash.add(event.linkedCashEntryId);
      const cash = cashById.get(event.linkedCashEntryId);
      if (!cash || cash.linkedFutures?.accountId !== account.id || cash.linkedFutures.eventId !== event.id ||
          cash.linkedTradeId || cash.purpose !== "futuresTransfer" ||
          !event.cashDate || getCalendarDatePart(event.cashDate) !== event.cashDate ||
          cash.date !== event.cashDate ||
          decimal(cash.amount).decimalPlaces() > 2 ||
          cash.type !== (decimal(event.amountUsdt).isPositive() ? "withdrawal" : "addition")) {
        throw new Error("Futures transfer and Cash movement are not linked consistently.");
      }
      const rate = account.eventRates?.find((item) => item.eventId === event.id);
      const fee = decimal(event.conversionFeeInr ?? "0");
      if (!rate || fee.isNegative() || fee.decimalPlaces() > 2 ||
          !isWithinQuantum(cash.amount,
            decimal(event.amountUsdt).abs().times(rate.inrPerUsdt)
              .plus(decimal(event.amountUsdt).isPositive() ? fee : fee.negated()), moneyQuantum)) {
        throw new Error("Linked Cash amount must reconcile to USDT, dated INR rate and conversion fee.");
      }
    }
  }

  for (const cash of cashEntries) {
    if (!cash.linkedFutures && cash.purpose !== "futuresTransfer") continue;
    if (!cash.linkedFutures || cash.purpose !== "futuresTransfer") {
      throw new Error("Futures Cash movement must have a matching transfer.");
    }
    const key = `${cash.linkedFutures.accountId}\u0000${cash.linkedFutures.eventId}`;
    if (seenEvents.has(key)) throw new Error("A Futures transfer can have only one Cash movement.");
    seenEvents.add(key);
    const account = accounts.find((item) => item.id === cash.linkedFutures?.accountId);
    if (!account?.events.some((event) => event.type === "transfer" &&
      event.id === cash.linkedFutures?.eventId && event.linkedCashEntryId === cash.id)) {
      throw new Error("Futures Cash movement has no matching wallet transfer.");
    }
  }
}
