import { decimal } from "@/src/domain/precision";

import { epfDateSchema, epfLedgerSchema, isEpfAccountMove } from "./model";
import type { EpfAccount, EpfBalance, EpfClaimTransfer, EpfEvent, EpfLedger } from "./model";
import { compareCodeUnits } from "@/src/domain/ordering";

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

/** Financial years run 1 Apr to 31 Mar; this is the calendar year they start in. */
const financialYear = (date: string) => Number(date.slice(0, 4)) - (date.slice(5, 7) < "04" ? 1 : 0);

function references(event: EpfEvent) {
  return isEpfAccountMove(event) ? [event.sourceId, event.destinationId] : [event.accountId];
}

/** Dates on which an event changes the given account's balance. */
function datesOn(event: EpfEvent, accountId: string): string[] {
  if (event.type === "claimTransfer") {
    const dates = event.sourceId === accountId
      // Credits before the claim leave the old account on their own dates.
      ? [event.effectiveDate, ...event.credits.filter((credit) => credit.date < event.effectiveDate).map((credit) => credit.date)]
      : [];
    return event.destinationId === accountId ? [...dates, ...event.credits.map((credit) => credit.date)] : dates;
  }
  if (event.type === "transfer") {
    return [
      ...(event.sourceId === accountId ? [event.effectiveDate] : []),
      ...(event.destinationId === accountId ? [event.creditDate ?? event.effectiveDate] : []),
    ];
  }
  return event.accountId === accountId ? [event.effectiveDate] : [];
}

const sameBalance = (a: EpfBalance, b: EpfBalance) => decimal(a.total).equals(b.total) &&
  (!a.components || !b.components || (decimal(a.components.employee).equals(b.components.employee) &&
    decimal(a.components.employer).equals(b.components.employer)));

function sumBalances(balances: EpfBalance[]): EpfBalance {
  return balances.reduce<EpfBalance>((total, item) => ({
    total: add(total.total, item.total),
    components: total.components && item.components ? {
      employee: add(total.components.employee, item.components.employee),
      employer: add(total.components.employer, item.components.employer),
    } : null,
  }), { total: 0, components: { employee: 0, employer: 0 } });
}

/** True when a exceeds b in total or, when both are known, in a component. */
const exceeds = (a: EpfBalance, b: EpfBalance) => decimal(a.total).greaterThan(b.total) ||
  Boolean(a.components && b.components && (decimal(a.components.employee).greaterThan(b.components.employee) ||
    decimal(a.components.employer).greaterThan(b.components.employer)));

function validateClaimTransfer(claim: EpfClaimTransfer, ledger: EpfLedger, accounts: Map<string, EpfAccount>, today: string) {
  const errors: string[] = [];
  if (claim.sourceId === claim.destinationId) errors.push("Transfer accounts must differ.");
  const dates = claim.credits.map((credit) => credit.date);
  if (dates.some((date, index) => index > 0 && date < dates[index - 1])) {
    errors.push("List the new account's credits in date order.");
  }
  if (claim.credits.some((credit) => credit.date > today || credit.postedDate > today)) {
    errors.push("Event dates cannot be in the future.");
  }
  if (claim.credits.some((credit) => credit.amount.total <= 0) || claim.payout.total <= 0) {
    errors.push("Event amounts must be positive.");
  }
  if (exceeds(claim.interest, claim.payout)) errors.push("The claim interest cannot be more than the claim.");
  const credited = sumBalances(claim.credits.map((credit) => credit.amount));
  if (claim.status === "completed" && !sameBalance(credited, claim.payout)) {
    errors.push("The new account's credits must add up to the claim, by part.");
  } else if (claim.status === "inTransit" && exceeds(credited, claim.payout)) {
    errors.push("The new account's credits cannot add up to more than the claim.");
  }
  for (const [accountId, label] of [[claim.sourceId, "old"], [claim.destinationId, "new"]] as const) {
    const account = accounts.get(accountId);
    if (account && datesOn(claim, accountId).some((date) => date <= account.checkpoint.date)) {
      errors.push(`The claim and its credits must follow the ${label} account's starting balance.`);
    }
  }
  const later = ledger.events.some((other) => other.id !== claim.id &&
    datesOn(other, claim.sourceId).some((date) => date > claim.effectiveDate));
  if (later) errors.push("The claim closes the old account; remove entries recorded on it after the claim date.");
  return errors;
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
    if (event.type === "withdrawal" && event.settlement) {
      if (event.capitalReduction !== null) errors.push("A final settlement empties the account; leave its capital reduction unset.");
      const settlement = event;
      const later = ledger.events.some((other) => other.id !== settlement.id &&
        datesOn(other, settlement.accountId).some((date) => date > settlement.effectiveDate) &&
        !(other.type === "reversal" && other.reversesId === settlement.id));
      if (later) errors.push("A final settlement must be the last entry in its account.");
    }
    if (event.type === "yearSummary") {
      const summary = event;
      if (summary.periodStart > summary.effectiveDate || financialYear(summary.periodStart) !== financialYear(summary.effectiveDate)) {
        errors.push("A financial year summary must start and end within one financial year.");
      }
      if (summary.closing === null && summary.effectiveDate.slice(5) === "03-31") {
        errors.push("A financial year summary ending on 31 Mar needs the passbook closing balance.");
      }
      const account = accounts.get(summary.accountId);
      if (account && summary.periodStart <= account.checkpoint.date) {
        errors.push("A financial year summary must start after the account's starting balance.");
      }
      const inside = (date: string) => date >= summary.periodStart && date <= summary.effectiveDate;
      const owned = ledger.events.some((other) => other.id !== summary.id && !isEpfAccountMove(other) &&
        other.accountId === summary.accountId && (
          // A balance update inside would be replaced by, then added to, the period totals.
          ((other.type === "contribution" || other.type === "interest" || other.type === "reconciliation") && inside(other.effectiveDate)) ||
          (other.type === "yearSummary" && other.periodStart <= summary.effectiveDate && other.effectiveDate >= summary.periodStart)));
      if (owned) errors.push("A financial year summary owns its period; remove the contributions, interest, balance updates or summaries recorded inside it.");
      if (sum([summary.contributions.employee, summary.contributions.employer, summary.interest.employee, summary.interest.employer]) <= 0) {
        errors.push("Event amounts must be positive.");
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
    if (event.type === "claimTransfer") errors.push(...validateClaimTransfer(event, ledger, accounts, today));
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
      : event.type === "reconciliation" || event.type === "reversal" || event.type === "yearSummary" ||
        event.type === "claimTransfer" ? null : event.amount.total;
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
  // A passbook closing balance is struck after the day's other activity, so a
  // summary replays after same-day entries. A settlement empties its account,
  // so it comes later still, followed only by its own reversal.
  // A claim transfer's claim also empties its account, like a settlement; a
  // credit on the claim date arrives after it. Later credits replay as ordinary
  // same-day activity, so a 31 Mar closing balance includes them.
  const settlementIds = new Set(ledger.events.flatMap((event) => (event.type === "withdrawal" && event.settlement) ||
    event.type === "claimTransfer" ? [event.id] : []));
  type Step = { date: string; event: EpfEvent; credit: boolean; creditIndex: number };
  const dayRank = (step: Step) => step.event.type === "claimTransfer" && step.credit
    ? (step.date === step.event.effectiveDate ? 4 : 0)
    : step.event.type === "yearSummary" ? 1 : settlementIds.has(step.event.id) ? 2
      : step.event.type === "reversal" && settlementIds.has(step.event.reversesId) ? 3 : 0;
  const steps = ledger.events.flatMap((event): Step[] => {
    const debit = { date: event.effectiveDate, event, credit: false, creditIndex: -1 };
    if (event.type === "claimTransfer") {
      return [debit, ...event.credits.map((credit, creditIndex) => ({ date: credit.date, event, credit: true, creditIndex }))];
    }
    return event.type === "transfer" && event.creditDate
      ? [debit, { date: event.creditDate, event, credit: true, creditIndex: 0 }] : [debit];
  }).sort((a, b) => compareCodeUnits(a.date, b.date) || dayRank(a) - dayRank(b) ||
    Date.parse(a.event.recordedAt) - Date.parse(b.event.recordedAt) || compareCodeUnits(a.event.id, b.event.id) ||
    Number(a.credit) - Number(b.credit) || a.creditIndex - b.creditIndex);
  const transit = new Map<string, { value: number; capital: number | null }>();
  // Claim transfers: what the claim left in transit, by part, and the old
  // account's capital still waiting to move with the first credit.
  const claimTransit = new Map<string, EpfBalance>();
  const pendingCapital = new Map<string, number | null>();
  const applied = new Set<string>();
  try {
    for (const step of steps) {
      if (step.date > asOf) continue;
      const event = step.event;
      if (event.type === "claimTransfer") {
        const source = states.get(event.sourceId)!;
        const destination = states.get(event.destinationId)!;
        if (!step.credit) {
          const due = shift(source.balance, event.interest, 1);
          const credited = sumBalances(event.credits.filter((credit) => credit.date < event.effectiveDate)
            .map((credit) => credit.amount));
          if (!sameBalance(sumBalances([due, credited]), event.payout)) {
            throw new Error("The claim must pay out the old account's whole balance, including the interest paid with it.");
          }
          source.balance = { total: 0, components: due.components ? { employee: 0, employer: 0 } : null };
          source.lastEvidenceDate = event.effectiveDate;
          // Capital that has not moved yet waits in transit for the first credit.
          if (!pendingCapital.has(event.id)) pendingCapital.set(event.id, source.capital);
          source.capital = 0;
          claimTransit.set(event.id, due);
          if (due.total > 0) transit.set(event.id, { value: due.total, capital: pendingCapital.get(event.id) ?? null });
          continue;
        }
        const credit = event.credits[step.creditIndex];
        const early = credit.date < event.effectiveDate;
        if (early) {
          if (exceeds(credit.amount, source.balance)) {
            throw new Error("A credit before the claim cannot be more than the old account's balance on that date.");
          }
          source.balance = shift(source.balance, credit.amount, -1);
          source.lastEvidenceDate = credit.date;
        } else {
          const remaining = claimTransit.get(event.id)!;
          if (exceeds(credit.amount, remaining)) {
            throw new Error("The new account's credits cannot add up to more than the claim.");
          }
          claimTransit.set(event.id, shift(remaining, credit.amount, -1));
        }
        destination.balance = shift(destination.balance, credit.amount, 1);
        destination.lastEvidenceDate = credit.date;
        if (step.creditIndex === 0) {
          // All of the old account's capital moves with the first credit, when
          // both sides know it and the credit covers it. Interest never does.
          const capital = early ? source.capital : pendingCapital.get(event.id) ?? null;
          const moves = capital !== null && destination.capital !== null && credit.amount.total >= capital;
          destination.capital = moves ? shiftCapital(destination.capital, capital, 1) : null;
          if (early) {
            pendingCapital.set(event.id, moves ? 0 : null);
            if (moves) source.capital = 0;
          } else pendingCapital.set(event.id, 0);
        }
        if (!early) {
          const left = claimTransit.get(event.id)!;
          if (left.total === 0) transit.delete(event.id);
          else transit.set(event.id, { value: left.total, capital: pendingCapital.get(event.id) ?? null });
        }
        continue;
      }
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
          if (original.type === "withdrawal") {
            if (original.settlement) state.balance = shift(state.balance, original.settlement.interest, -1);
            // Capital before a settlement was not recorded, so it is unknown again.
            state.capital = shiftCapital(state.capital, original.capitalReduction, 1);
          }
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
      } else if (event.type === "yearSummary") {
        const employee = add(event.contributions.employee, event.interest.employee);
        const employer = add(event.contributions.employer, event.interest.employer);
        state.balance = shift(state.balance, { total: add(employee, employer), components: { employee, employer } }, 1);
        state.capital = shiftCapital(state.capital, add(event.contributions.employee, event.contributions.employer), 1);
        const closing = event.closing;
        if (closing && (!decimal(state.balance.total).equals(add(closing.employee, closing.employer)) ||
          (state.balance.components && (!decimal(state.balance.components.employee).equals(closing.employee) ||
            !decimal(state.balance.components.employer).equals(closing.employer))))) {
          throw new Error("A financial year summary must match its passbook closing balance.");
        }
        reasons.add(`${event.id}:summarizedFlows`);
      } else if (event.type === "withdrawal" && event.settlement) {
        const due = shift(state.balance, event.settlement.interest, 1);
        const paid = event.amount;
        if (!decimal(due.total).equals(paid.total) || (due.components && paid.components &&
          (!decimal(due.components.employee).equals(paid.components.employee) ||
            !decimal(due.components.employer).equals(paid.components.employer)))) {
          throw new Error("A final settlement must pay out the whole balance, including the interest paid with it.");
        }
        state.balance = { total: 0, components: due.components && paid.components ? { employee: 0, employer: 0 } : null };
        // Nothing remains, so neither does any contributed capital.
        state.capital = 0;
        if (event.destination === "unknown") reasons.add(`${event.id}:unknownWithdrawalDestination`);
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
