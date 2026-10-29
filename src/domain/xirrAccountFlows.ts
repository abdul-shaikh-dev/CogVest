import { getCalendarDatePart } from "./dates";
import { calculateEpfLedger } from "./epf/calculations";
import type { EpfEvent, EpfLedger } from "./epf/model";
import { calculatePpfConfirmedBalance } from "./ppf/calculations";
import { decimal } from "./precision";
import { calculateUsdmPortfolioContribution, type UsdmFuturesAccount } from "./usdmFutures";
import type { CashEntry, PpfAccount, PpfLedgerEntry } from "@/src/types";

/**
 * Investments XIRR flows for PPF, EPF and Futures accounts (D8 in
 * docs/design/xirr-evidence-contract.md). Money entering an account is
 * negative and money leaving it is positive, wherever it came from or went;
 * interest, funding and trading results are return, not flows. Each account's
 * starting balance is an opening flow that must sit on the period start.
 */
export type AccountXirrReason =
  | "ppf-reconciliation" | "epf-ledger-invalid" | "epf-history-incomplete" | "epf-reconciliation"
  | "futures-not-valued" | "futures-stale-valuation" | "futures-rates-missing"
  | "account-history-after-start";
export type AccountXirrLimitation = "ppf-interest-accrual" | "epf-summarised-year";

export type AccountFlow = { date: string; amountInr: string; id: string; opening?: boolean };
export type AccountXirrOutcome = {
  flows: AccountFlow[];
  terminals: Array<{ amountInr: string; valueAsOf: string; id: string }>;
  reasons: Array<{ assetId: string; reason: AccountXirrReason; recordId?: string }>;
  limitations: Array<{ assetId: string; limitation: AccountXirrLimitation; recordId?: string }>;
};

const MAX_VALUATION_AGE_DAYS = 7;

function emptyOutcome(): AccountXirrOutcome {
  return { flows: [], terminals: [], reasons: [], limitations: [] };
}

function ageInDays(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** PPF: deposits in, withdrawals out, confirmed balance at the end. */
export function ppfXirrFlows(accounts: readonly PpfAccount[], entries: readonly PpfLedgerEntry[], endDate: string): AccountXirrOutcome {
  const outcome = emptyOutcome();
  for (const account of accounts) {
    const ref = `ppf:${account.id}`;
    if (account.balanceAsOf > endDate) continue;
    if (account.confirmedBalance > 0) {
      outcome.flows.push({ date: account.balanceAsOf, amountInr: decimal(account.confirmedBalance).negated().toString(), id: ref, opening: true });
    }
    for (const entry of entries) {
      if (entry.accountId !== account.id || entry.date <= account.balanceAsOf || entry.date > endDate) continue;
      if (entry.type === "contribution") outcome.flows.push({ date: entry.date, amountInr: decimal(entry.amount).negated().toString(), id: entry.id });
      else if (entry.type === "withdrawal") outcome.flows.push({ date: entry.date, amountInr: decimal(entry.amount).toString(), id: entry.id });
      // A reconciliation resets the balance without saying what moved, so the flows can't be trusted.
      else if (entry.type === "reconciliation") outcome.reasons.push({ assetId: ref, reason: "ppf-reconciliation", recordId: entry.id });
    }
    const balance = calculatePpfConfirmedBalance(account, entries, endDate).confirmedBalance;
    if (balance > 0) {
      outcome.terminals.push({ amountInr: decimal(balance).toString(), valueAsOf: endDate, id: ref });
      // Interest is credited once a year, so the confirmed balance leaves out this year's accrual.
      outcome.limitations.push({ assetId: ref, limitation: "ppf-interest-accrual" });
    }
  }
  return outcome;
}

function epfEventFlows(event: EpfEvent, events: readonly EpfEvent[]): Array<{ amount: string }> {
  switch (event.type) {
    case "contribution":
      return [{ amount: decimal(event.amount).negated().toString() }];
    case "yearSummary":
      return [{ amount: decimal(event.contributions.employee).plus(event.contributions.employer).negated().toString() }];
    case "withdrawal":
      return [{ amount: decimal(event.amount.total).toString() }];
    case "externalTransferIn":
      return [{ amount: decimal(event.amount.total).negated().toString() }];
    case "reversal": {
      const original = events.find((item) => item.id === event.reversesId);
      // Undo the original's flow on the reversal date; interest reversals move no money.
      if (original?.type === "contribution") return [{ amount: decimal(original.amount).toString() }];
      if (original?.type === "withdrawal") return [{ amount: decimal(original.amount.total).negated().toString() }];
      return [];
    }
    default:
      return [];
  }
}

/** EPF: contributions in (employee and employer), withdrawals out, combined balance at the end. */
export function epfXirrFlows(epf: Pick<EpfLedger, "accounts" | "events">, endDate: string, today: string): AccountXirrOutcome {
  const outcome = emptyOutcome();
  if (!epf.accounts.length) return outcome;
  const ledger = calculateEpfLedger({ accounts: epf.accounts, events: epf.events }, endDate, today);
  if (!ledger.ok || ledger.total === null) {
    outcome.reasons.push({ assetId: "epf", reason: "epf-ledger-invalid" });
    return outcome;
  }
  for (const account of ledger.accounts) {
    if (!account.historyComplete) outcome.reasons.push({ assetId: `epf:${account.accountId}`, reason: "epf-history-incomplete" });
  }
  for (const account of epf.accounts) {
    if (account.checkpoint.balance.total > 0) {
      outcome.flows.push({ date: account.checkpoint.date, amountInr: decimal(account.checkpoint.balance.total).negated().toString(),
        id: `epf:${account.id}`, opening: true });
    }
  }
  for (const event of epf.events) {
    if (event.effectiveDate > endDate) continue;
    if (event.type === "reconciliation") {
      outcome.reasons.push({ assetId: `epf:${event.accountId}`, reason: "epf-reconciliation", recordId: event.id });
      continue;
    }
    if (event.type === "yearSummary") {
      outcome.limitations.push({ assetId: `epf:${event.accountId}`, limitation: "epf-summarised-year", recordId: event.id });
    }
    for (const flow of epfEventFlows(event, epf.events)) {
      if (!decimal(flow.amount).isZero()) outcome.flows.push({ date: event.effectiveDate, amountInr: flow.amount, id: event.id });
    }
  }
  if (ledger.total > 0) outcome.terminals.push({ amountInr: decimal(ledger.total).toString(), valueAsOf: endDate, id: "epf" });
  return outcome;
}

/**
 * Futures: the starting wallet at its recorded rate, transfers at their Cash
 * amount or event-date rate, and reconciled net equity at the end. Notional
 * exposure and margin are never flows.
 */
export function futuresXirrFlows(accounts: readonly UsdmFuturesAccount[], cashEntries: readonly CashEntry[],
  endDate: string, valuationTime: string): AccountXirrOutcome {
  const outcome = emptyOutcome();
  for (const account of accounts) {
    const ref = `futures:${account.id}`;
    const valuation = calculateUsdmPortfolioContribution(account, valuationTime, [...cashEntries]);
    const valuedOn = account.valuation ? account.valuation.asOf.slice(0, 10) : null;
    if (valuation.status !== "ready" || valuation.equityInr === null || !valuedOn) {
      outcome.reasons.push({ assetId: ref, reason: "futures-not-valued" });
      continue;
    }
    if (valuedOn > endDate || ageInDays(valuedOn, endDate) > MAX_VALUATION_AGE_DAYS) {
      outcome.reasons.push({ assetId: ref, reason: "futures-stale-valuation" });
      continue;
    }
    const opening = decimal(account.openingWalletUsdt);
    if (!opening.isZero()) {
      outcome.flows.push({ date: account.openingAt.slice(0, 10),
        amountInr: opening.times(account.openingRate!.inrPerUsdt).negated().toDecimalPlaces(2).toString(), id: ref, opening: true });
    }
    for (const event of account.events) {
      if (event.type !== "transfer" || Date.parse(event.at) < Date.parse(account.openingAt)) continue;
      if (event.transferBoundary === "internal") {
        const cash = cashEntries.find((entry) => entry.id === event.linkedCashEntryId);
        if (!cash) continue;
        // Cash paid into the wallet is money entering; Cash received back is money leaving.
        const amount = decimal(cash.amount);
        outcome.flows.push({ date: getCalendarDatePart(cash.date)!, amountInr: (cash.type === "withdrawal" ? amount.negated() : amount).toString(), id: event.id });
      } else {
        const rate = account.eventRates?.find((item) => item.eventId === event.id);
        if (!rate) {
          outcome.reasons.push({ assetId: ref, reason: "futures-rates-missing", recordId: event.id });
          continue;
        }
        const amount = decimal(event.amountUsdt).times(rate.inrPerUsdt).toDecimalPlaces(2);
        if (!amount.isZero()) outcome.flows.push({ date: event.at.slice(0, 10), amountInr: amount.negated().toString(), id: event.id });
      }
    }
    // Negative equity is a liability: a negative terminal flow, never dropped.
    const equity = decimal(valuation.equityInr);
    if (!equity.isZero()) outcome.terminals.push({ amountInr: equity.toString(), valueAsOf: valuedOn, id: ref });
  }
  return outcome;
}
