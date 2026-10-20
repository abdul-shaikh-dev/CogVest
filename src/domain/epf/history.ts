import { decimal, normalizeMoney } from "@/src/domain/precision";
import { calculateEpfLedger } from "./calculations";
import { epfDateSchema } from "./model";
import type { EpfEvent } from "./model";
import type { EpfState } from "./persistence";

/**
 * confirmed: every account has evidence and confirmed-complete history at month end.
 * lastRecorded: every account has a checkpoint, but some value is carried forward.
 * partial: some account has no checkpoint yet; the EPF total is unavailable.
 */
export type EpfMonthStatus = "confirmed" | "lastRecorded" | "partial";

export type EpfMonthFlows = {
  /** Employee and employer EPF contributions, net of provider reversals. Capital, not return. */
  contributions: number;
  /** Official credited interest, net of reversals. Return, not capital. */
  interest: number;
  /** Withdrawals out of tracked EPF, net of reversals. */
  withdrawals: number;
  /** Transfers in from untracked EPF accounts. Origin history is unknown. */
  externalTransfersIn: number;
  /** A reconciliation replaced a balance; its difference is neither deposit nor gain. */
  reconciled: boolean;
};

export type EpfMonthValue = {
  month: string;
  monthEnd: string;
  status: EpfMonthStatus;
  /** Null unless every account is covered. Includes in-transit transfers once. */
  value: number | null;
  coveredValue: number;
  coveredAccountCount: number;
  accountCount: number;
  inTransit: number;
  flows: EpfMonthFlows;
  coverageReasons: string[];
};

export type EpfMonthlyHistory =
  | { ok: true; months: EpfMonthValue[] }
  | { ok: false; errors: string[] };

function monthEndOf(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}

function nextMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthNumber === 12 ? `${year + 1}-01` : `${year}-${String(monthNumber + 1).padStart(2, "0")}`;
}

function flowsForMonth(events: readonly EpfEvent[], month: string): EpfMonthFlows {
  const byId = new Map(events.map((event) => [event.id, event]));
  let contributions = decimal(0);
  let interest = decimal(0);
  let withdrawals = decimal(0);
  let externalTransfersIn = decimal(0);
  let reconciled = false;
  for (const event of events) {
    // Tracked EPF-to-EPF transfers are internal and never appear as a flow.
    if (event.type === "transfer" || event.effectiveDate.slice(0, 7) !== month) continue;
    if (event.type === "contribution") contributions = contributions.plus(event.amount);
    else if (event.type === "interest") interest = interest.plus(event.amount.total);
    else if (event.type === "withdrawal") {
      withdrawals = withdrawals.plus(event.amount.total);
      if (event.settlement) interest = interest.plus(event.settlement.interest.total);
    } else if (event.type === "externalTransferIn") externalTransfersIn = externalTransfersIn.plus(event.amount.total);
    else if (event.type === "reconciliation") reconciled = true;
    else {
      // A reversal offsets its original in the reversal's own effective month.
      const original = byId.get(event.reversesId);
      if (original?.type === "contribution") contributions = contributions.minus(original.amount);
      else if (original?.type === "interest") interest = interest.minus(original.amount.total);
      else if (original?.type === "withdrawal") {
        withdrawals = withdrawals.minus(original.amount.total);
        if (original.settlement) interest = interest.minus(original.settlement.interest.total);
      }
    }
  }
  return {
    contributions: normalizeMoney(contributions),
    interest: normalizeMoney(interest),
    withdrawals: normalizeMoney(withdrawals),
    externalTransfersIn: normalizeMoney(externalTransfersIn),
    reconciled,
  };
}

/**
 * Derives completed month-end EPF values from current evidence. Nothing is
 * stored, so corrections and deletions restate only this view. Months before
 * the earliest checkpoint are not emitted; no earlier history is inferred.
 */
export function buildEpfMonthlyHistory(epf: EpfState, today: string): EpfMonthlyHistory {
  if (!epfDateSchema.safeParse(today).success) return { ok: false, errors: ["Use a valid calendar date."] };
  if (epf.accounts.length === 0) return { ok: true, months: [] };
  const [year, monthNumber] = today.split("-").map(Number);
  const lastCompletedMonth = monthNumber === 1 ? `${year - 1}-12` : `${year}-${String(monthNumber - 1).padStart(2, "0")}`;
  const firstMonth = epf.accounts.map((account) => account.checkpoint.date.slice(0, 7)).sort()[0];
  const ledger = { accounts: epf.accounts, events: epf.events };
  const months: EpfMonthValue[] = [];
  for (let month = firstMonth; month <= lastCompletedMonth; month = nextMonth(month)) {
    const monthEnd = monthEndOf(month);
    const result = calculateEpfLedger(ledger, monthEnd, today);
    if (!result.ok) return result;
    const covered = result.accounts.length;
    const status: EpfMonthStatus = result.total === null ? "partial"
      : result.accounts.every((account) => account.historyComplete) ? "confirmed" : "lastRecorded";
    months.push({
      month,
      monthEnd,
      status,
      value: result.total,
      coveredValue: result.coveredTotal,
      coveredAccountCount: covered,
      accountCount: epf.accounts.length,
      inTransit: result.inTransit,
      flows: flowsForMonth(epf.events, month),
      coverageReasons: result.coverageReasons,
    });
  }
  return { ok: true, months };
}
