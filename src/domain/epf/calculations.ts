import { decimal } from "@/src/domain/precision";

import { epfDateSchema, epfLedgerSchema } from "./model";
import type { EpfAccount, EpfBalance, EpfEvent, EpfLedger } from "./model";

export type EpfAccountValue = {
  accountId: string;
  balance: EpfBalance;
  capital: number | null;
  lastEvidenceDate: string;
  historyComplete: boolean;
};
export type EpfResult =
  | { ok: false; errors: string[] }
  | { ok: true; accounts: EpfAccountValue[]; total: number | null; coveredTotal: number; capital: number | null;
      inTransit: number; coverageReasons: string[] };

const add = (a: number, b: number) => decimal(a).plus(b).toNumber();
const subtract = (a: number, b: number) => decimal(a).minus(b).toNumber();
const sum = (values: number[]) => values.reduce(add, 0);

function shift(balance: EpfBalance, amount: EpfBalance, sign: 1 | -1): EpfBalance {
  const operation = sign === 1 ? add : subtract;
  const result = {
    total: operation(balance.total, amount.total),
    components: balance.components && amount.components ? {
      employee: operation(balance.components.employee, amount.components.employee),
      employer: operation(balance.components.employer, amount.components.employer),
    } : null,
  };
  if (result.total < 0 || (result.components &&
    (result.components.employee < 0 || result.components.employer < 0))) {
    throw new Error("An event would make an EPF balance negative.");
  }
  if (!Number.isSafeInteger(decimal(result.total).times(100).toNumber())) {
    throw new Error("EPF value exceeds supported precision.");
  }
  return result;
}

function shiftCapital(value: number | null, amount: number | null, sign: 1 | -1) {
  if (value === null || amount === null) return null;
  const result = sign === 1 ? add(value, amount) : subtract(value, amount);
  if (result < 0 || !Number.isSafeInteger(decimal(result).times(100).toNumber())) {
    throw new Error("Capital allocation is invalid; supply evidence or mark it unknown.");
  }
  return result;
}

function references(event: EpfEvent) {
  return event.type === "transfer" ? [event.sourceId, event.destinationId] : [event.accountId];
}

function validate(ledger: EpfLedger, today: string) {
  const errors: string[] = [];
  const accounts = new Map<string, EpfAccount>();
  const eventIds = new Set<string>();
  const reversedIds = new Set<string>();
  for (const account of ledger.accounts) {
    if (accounts.has(account.id)) errors.push("Duplicate EPF account ID.");
    accounts.set(account.id, account);
    if (account.checkpoint.date > today ||
      (account.historyCompleteThrough && account.historyCompleteThrough > today)) {
      errors.push("Confirmed dates cannot be in the future.");
    }
  }
  for (const event of ledger.events) {
    if (eventIds.has(event.id)) errors.push("Duplicate EPF event ID.");
    eventIds.add(event.id);
    if (event.effectiveDate > today || event.postedDate > today) {
      errors.push("Event dates cannot be in the future.");
    }
    for (const accountId of references(event)) {
      const account = accounts.get(accountId);
      if (!account) errors.push("An event references a missing EPF account.");
      else if (event.effectiveDate <= account.checkpoint.date) {
        errors.push("Events must follow both account checkpoints; reconcile checkpoint overlap explicitly.");
      }
    }
    if (event.type === "contribution" && event.party === "employer" && event.voluntary) {
      errors.push("Voluntary PF is an employee contribution.");
    }
    if (event.type === "reversal") {
      const original = ledger.events.find((item) => item.id === event.reversesId);
      if (!original || !(original.type === "contribution" || original.type === "interest" ||
        original.type === "withdrawal") || original.accountId !== event.accountId ||
        original.effectiveDate > event.effectiveDate) {
        errors.push("Reversal needs an earlier contribution, interest credit or withdrawal in this account.");
      }
      if (reversedIds.has(event.reversesId)) errors.push("An event cannot be reversed twice.");
      reversedIds.add(event.reversesId);
    }
    if (event.type === "transfer") {
      if (event.sourceId === event.destinationId) errors.push("Transfer accounts must differ.");
      if ((event.status === "completed") !== (event.creditDate !== null)) {
        errors.push("Only a completed transfer has a confirmed credit date.");
      }
      if (event.creditDate && (event.creditDate < event.effectiveDate || event.creditDate > today)) {
        errors.push("Transfer credit must follow its debit and cannot be in the future.");
      }
    }
    const amount = event.type === "contribution" ? event.amount
      : event.type === "reconciliation" || event.type === "reversal" ? null : event.amount.total;
    if (amount !== null && amount <= 0) errors.push("Event amounts must be positive.");
  }
  return errors;
}

/** Dates of confirmed evidence are explicit; no use of device time or invented rates. */
export function calculateEpfLedger(input: unknown, asOf: string, today: string): EpfResult {
  const parsed = epfLedgerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((issue) => issue.message) };
  if (!epfDateSchema.safeParse(asOf).success || !epfDateSchema.safeParse(today).success || asOf > today) {
    return { ok: false, errors: ["Use valid non-future valuation dates."] };
  }
  const ledger = parsed.data;
  const errors = validate(ledger, today);
  if (errors.length) return { ok: false, errors };
  const states = new Map<string, EpfAccountValue>();
  const reasons = new Set<string>();
  for (const account of ledger.accounts) {
    if (account.checkpoint.date > asOf) {
      reasons.add(`${account.id}:beforeCheckpoint`);
      continue;
    }
    const historyComplete = account.checkpoint.date === asOf ||
      (account.historyCompleteThrough !== null && account.historyCompleteThrough >= asOf);
    if (!historyComplete) reasons.add(`${account.id}:incompleteHistory`);
    states.set(account.id, {
      accountId: account.id, balance: account.checkpoint.balance, capital: account.checkpoint.capital,
      lastEvidenceDate: account.checkpoint.date, historyComplete,
    });
  }
  const steps = ledger.events.flatMap((event) => {
    const debit = { date: event.effectiveDate, event, credit: false };
    return event.type === "transfer" && event.creditDate
      ? [debit, { date: event.creditDate, event, credit: true }] : [debit];
  }).sort((a, b) => a.date.localeCompare(b.date) ||
    Date.parse(a.event.recordedAt) - Date.parse(b.event.recordedAt) || a.event.id.localeCompare(b.event.id) ||
    Number(a.credit) - Number(b.credit));
  const transit = new Map<string, { value: number; capital: number | null }>();
  const applied = new Set<string>();
  try {
    for (const step of steps) {
      if (step.date > asOf) continue;
      const event = step.event;
      if (event.type === "transfer") {
        if (event.status === "requested") continue;
        const state = states.get(step.credit ? event.destinationId : event.sourceId)!;
        const sign = step.credit ? 1 : -1;
        const transferCapital = step.credit ? transit.get(event.id)!.capital
          : state.capital === null ? null : event.capital;
        state.balance = shift(state.balance, event.amount, sign);
        state.capital = shiftCapital(state.capital, transferCapital, sign);
        state.lastEvidenceDate = step.date;
        if (step.credit) transit.delete(event.id);
        else transit.set(event.id, { value: event.amount.total, capital: transferCapital });
        continue;
      }
      const state = states.get(event.accountId)!;
      state.lastEvidenceDate = event.effectiveDate;
      if (event.type === "reversal") {
        const original = ledger.events.find((item) => item.id === event.reversesId)!;
        if (!applied.has(original.id)) throw new Error("A reversal must be ordered after its original event.");
        if (original.type === "contribution") {
          state.balance = shift(state.balance, { total: original.amount, components: {
            employee: original.party === "employee" ? original.amount : 0,
            employer: original.party === "employer" ? original.amount : 0,
          } }, -1);
          state.capital = shiftCapital(state.capital, original.amount, -1);
        } else if (original.type === "withdrawal" || original.type === "interest") {
          state.balance = shift(state.balance, original.amount, original.type === "withdrawal" ? 1 : -1);
          if (original.type === "withdrawal") state.capital = shiftCapital(state.capital, original.capitalReduction, 1);
        }
        reasons.add(`${event.id}:reversalFlowReview`);
      } else if (event.type === "reconciliation") {
        state.balance = event.balance;
        state.capital = event.capital;
        reasons.add(`${event.id}:reconciliationNotReturn`);
      } else if (event.type === "contribution") {
        state.balance = shift(state.balance, {
          total: event.amount, components: {
            employee: event.party === "employee" ? event.amount : 0,
            employer: event.party === "employer" ? event.amount : 0,
          },
        }, 1);
        state.capital = shiftCapital(state.capital, event.amount, 1);
      } else {
        state.balance = shift(state.balance, event.amount, event.type === "withdrawal" ? -1 : 1);
        if (event.type === "withdrawal") {
          state.capital = shiftCapital(state.capital, event.capitalReduction, -1);
          if (event.destination === "unknown") reasons.add(`${event.id}:unknownWithdrawalDestination`);
        } else if (event.type === "externalTransferIn") {
          state.capital = shiftCapital(state.capital, event.capital, 1);
          reasons.add(`${event.id}:untrackedTransferOrigin`);
        }
      }
      applied.add(event.id);
    }
    const accounts = [...states.values()];
    for (const state of accounts) {
      if (state.capital === null) reasons.add(`${state.accountId}:unknownCapital`);
      if (state.balance.components === null) reasons.add(`${state.accountId}:unknownComponents`);
    }
    if (transit.size) reasons.add("transferInTransit");
    const inTransit = sum([...transit.values()].map((item) => item.value));
    const total = add(sum(accounts.map((account) => account.balance.total)), inTransit);
    const capitals = [...accounts.map((account) => account.capital), ...[...transit.values()].map((item) => item.capital)];
    const capital = capitals.every((value): value is number => value !== null) ? sum(capitals) : null;
    if (![total, capital ?? 0].every((value) => Number.isSafeInteger(decimal(value).times(100).toNumber()))) {
      throw new Error("EPF aggregate exceeds supported precision.");
    }
    const allAccountsCovered = accounts.length === ledger.accounts.length;
    return { ok: true, accounts, total: allAccountsCovered ? total : null, coveredTotal: total,
      capital: allAccountsCovered ? capital : null, inTransit, coverageReasons: [...reasons] };
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : "Invalid EPF ledger."] };
  }
}

/** Full replay makes corrections/deletions atomic, including both transfer legs. */
export function changeEpfEvent(ledger: EpfLedger,
  change: { type: "put"; event: EpfEvent } | { type: "remove"; id: string }, today: string,
) {
  const parsed = epfLedgerSchema.safeParse(ledger);
  if (!parsed.success) return { ok: false as const, errors: ["Invalid original EPF ledger."] };
  if (new Set(ledger.events.map((event) => event.id)).size !== ledger.events.length) {
    return { ok: false as const, errors: ["Resolve duplicate EPF event IDs before editing."] };
  }
  const id = change.type === "put" ? change.event.id : change.id;
  const events = ledger.events.filter((event) => event.id !== id);
  if (change.type === "put") events.push(change.event);
  const candidate = { ...ledger, events };
  const result = calculateEpfLedger(candidate, today, today);
  return result.ok ? { ok: true as const, ledger: candidate, result } : result;
}
