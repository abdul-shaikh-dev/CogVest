import { formatLocalCalendarDate, parseCalendarDate } from "@/src/domain/dates";
import { calculateEpfLedger, changeEpfEvent, type EpfAccount, type EpfBalance, type EpfEvent } from "@/src/domain/epf";
import { formatDate, formatINR } from "@/src/domain/formatters";
import { decimal } from "@/src/domain/precision";
import { parseInrAmount, type EpfEvidence, type EpfFieldErrors } from "./epfAccountForm";

export type EpfEntryKind =
  | "employeeContribution"
  | "employerContribution"
  | "interest"
  | "withdrawal"
  | "transferOut"
  | "transferIn";

export const epfEntryKindOptions: Array<{ label: string; value: EpfEntryKind }> = [
  { label: "Employee contribution", value: "employeeContribution" },
  { label: "Employer contribution", value: "employerContribution" },
  { label: "Official interest", value: "interest" },
  { label: "Withdrawal", value: "withdrawal" },
  { label: "Transfer to another tracked EPF account", value: "transferOut" },
  { label: "Transfer in from an untracked account", value: "transferIn" },
];

export type EpfWithdrawalDestination = "external" | "unknown" | "cash";
export const epfWithdrawalDestinationOptions: Array<{ label: string; value: EpfWithdrawalDestination }> = [
  { label: "Paid out to me (not tracked in CogVest)", value: "external" },
  { label: "Into my tracked Cash", value: "cash" },
  { label: "I'm not sure", value: "unknown" },
];

export type EpfEntryDraft = {
  kind: EpfEntryKind;
  amount: string;
  /** Optional split for aggregate entries. Both blank leaves the breakdown unknown. */
  employee: string;
  employer: string;
  voluntary: boolean;
  date: string;
  /** Posting date; differs from the effective date for delayed official interest. */
  postedDate: string;
  evidence: EpfEvidence;
  destination: EpfWithdrawalDestination;
  targetAccountId: string;
  transferStatus: "completed" | "inTransit";
  creditDate: string;
};
export type EpfEntryField = "amount" | "employee" | "employer" | "date" | "postedDate" | "targetAccountId" | "creditDate";

export function emptyEpfEntryDraft(now: Date): EpfEntryDraft {
  const today = formatLocalCalendarDate(now);
  return { kind: "employeeContribution", amount: "", employee: "", employer: "", voluntary: false,
    date: today, postedDate: today, evidence: "statement", destination: "external",
    targetAccountId: "", transferStatus: "completed", creditDate: today };
}

const splitKinds = new Set<EpfEntryKind>(["interest", "withdrawal", "transferOut", "transferIn"]);
export const entryHasSplit = (kind: EpfEntryKind) => splitKinds.has(kind);

export function draftFromEpfEvent(event: EpfEvent, accountId: string, cashLinked: boolean, now: Date): EpfEntryDraft {
  const base = emptyEpfEntryDraft(now);
  const split = (balance: EpfBalance) => balance.components
    ? { employee: String(balance.components.employee), employer: String(balance.components.employer) }
    : { employee: "", employer: "" };
  const common = { ...base, date: event.effectiveDate, postedDate: event.postedDate,
    evidence: (event.evidence === "Own record" ? "ownRecord" : "statement") as EpfEvidence };
  switch (event.type) {
    case "contribution":
      return { ...common, kind: event.party === "employee" ? "employeeContribution" : "employerContribution",
        amount: String(event.amount), voluntary: Boolean(event.voluntary) };
    case "interest":
      return { ...common, kind: "interest", amount: String(event.amount.total), ...split(event.amount) };
    case "withdrawal":
      return { ...common, kind: "withdrawal", amount: String(event.amount.total), ...split(event.amount),
        destination: cashLinked ? "cash" : event.destination };
    case "externalTransferIn":
      return { ...common, kind: "transferIn", amount: String(event.amount.total), ...split(event.amount) };
    case "transfer":
      return { ...common, kind: "transferOut", amount: String(event.amount.total), ...split(event.amount),
        targetAccountId: event.sourceId === accountId ? event.destinationId : event.sourceId,
        transferStatus: event.status === "completed" ? "completed" : "inTransit",
        creditDate: event.creditDate ?? base.creditDate };
    default:
      throw new Error("This entry type is not edited with the entry form.");
  }
}

function validDate(value: string, today: string) {
  if (!parseCalendarDate(value) || value.length !== 10) return "Choose a date.";
  if (value > today) return "The date cannot be in the future.";
  return null;
}

export type EpfEntryEffect = {
  accounts: Array<{ accountId: string; nickname: string; before: number | null; after: number | null }>;
  totalBefore: number | null;
  totalAfter: number | null;
  inTransitAfter: number;
  cashChange: number;
};

export type EpfEntryPlan = {
  event: EpfEvent;
  cash: { id: string; label: string } | null;
  effect: EpfEntryEffect;
};

/**
 * Builds the exact evidenced record for an optional ledger entry. Contributions
 * are capital, interest is return, transfers move money without creating it.
 */
export function buildEpfEntry(
  draft: EpfEntryDraft,
  context: {
    account: EpfAccount;
    accounts: readonly EpfAccount[];
    events: readonly EpfEvent[];
    id: string;
    cashId: string;
    now: Date;
    existing?: EpfEvent;
  },
): { ok: true; plan: EpfEntryPlan } | { ok: false; errors: EpfFieldErrors<EpfEntryField>; message?: string } {
  const today = formatLocalCalendarDate(context.now);
  const errors: EpfFieldErrors<EpfEntryField> = {};
  const amount = parseInrAmount(draft.amount);
  if (amount === null || amount <= 0) errors.amount = "Enter the amount from your statement, above zero.";
  const dateError = validDate(draft.date, today);
  if (dateError) errors.date = dateError;
  else if (draft.date <= context.account.checkpoint.date) {
    errors.date = `Use a date after the starting balance (${formatDate(context.account.checkpoint.date)}). That balance already includes earlier activity.`;
  }

  let components: EpfBalance["components"] = null;
  if (entryHasSplit(draft.kind) && (draft.employee.trim() || draft.employer.trim())) {
    const employee = parseInrAmount(draft.employee);
    const employer = parseInrAmount(draft.employer);
    if (employee === null) errors.employee = "Enter the employee part, or leave both parts blank.";
    if (employer === null) errors.employer = "Enter the employer part, or leave both parts blank.";
    if (employee !== null && employer !== null && amount !== null && !decimal(employee).plus(employer).equals(amount)) {
      errors.employer = "The two parts must add up to the amount.";
    }
    if (employee !== null && employer !== null) components = { employee, employer };
  }

  if (draft.kind === "interest") {
    const postedError = validDate(draft.postedDate, today);
    if (postedError) errors.postedDate = postedError;
    else if (!errors.date && draft.postedDate < draft.date) errors.postedDate = "Interest cannot be credited before the period it is for.";
  }
  const target = context.accounts.find((item) => item.id === draft.targetAccountId && item.id !== context.account.id);
  if (draft.kind === "transferOut") {
    if (!target) errors.targetAccountId = "Choose the EPF account that received the money.";
    else if (!errors.date && draft.date <= target.checkpoint.date) {
      errors.date = `Use a date after ${target.nickname}'s starting balance (${formatDate(target.checkpoint.date)}).`;
    }
    if (draft.transferStatus === "completed") {
      const creditError = validDate(draft.creditDate, today);
      if (creditError) errors.creditDate = creditError;
      else if (!errors.date && draft.creditDate < draft.date) errors.creditDate = "The money cannot arrive before it left.";
    }
  }
  if (Object.keys(errors).length || amount === null) return { ok: false, errors };

  const evidence = draft.evidence === "ownRecord" ? "Own record"
    : context.account.provider === "epfo" ? "EPFO passbook" : "Employer trust statement";
  const base = { id: context.existing?.id ?? context.id, recordedAt: context.now.toISOString(),
    effectiveDate: draft.date, postedDate: draft.kind === "interest" ? draft.postedDate : draft.date, evidence };
  const balance: EpfBalance = { total: amount, components };
  let event: EpfEvent;
  switch (draft.kind) {
    case "employeeContribution":
    case "employerContribution":
      event = { ...base, accountId: context.account.id, type: "contribution",
        party: draft.kind === "employeeContribution" ? "employee" : "employer", amount,
        ...(draft.kind === "employeeContribution" && draft.voluntary ? { voluntary: true } : {}) };
      break;
    case "interest":
      event = { ...base, accountId: context.account.id, type: "interest", amount: balance };
      break;
    case "withdrawal":
      // Linked Cash requires the unknown destination plus an explicit, validated Cash record.
      event = { ...base, accountId: context.account.id, type: "withdrawal", amount: balance, capitalReduction: null,
        destination: draft.destination === "external" ? "external" : "unknown" };
      break;
    case "transferIn":
      event = { ...base, accountId: context.account.id, type: "externalTransferIn", amount: balance, capital: null };
      break;
    case "transferOut":
      event = { ...base, type: "transfer", sourceId: context.account.id, destinationId: target!.id,
        amount: balance, capital: null, status: draft.transferStatus,
        creditDate: draft.transferStatus === "completed" ? draft.creditDate : null,
        ...(draft.transferStatus === "completed" ? { postedDate: draft.creditDate } : {}) };
      break;
  }
  const cash = draft.kind === "withdrawal" && draft.destination === "cash"
    ? { id: context.cashId, label: `From ${context.account.nickname} EPF` } : null;

  const ledger = { accounts: [...context.accounts], events: [...context.events] };
  const before = calculateEpfLedger(ledger, today, today);
  const after = changeEpfEvent(ledger, { type: "put", event }, today);
  if (!before.ok || !after.ok) {
    return { ok: false, errors: {},
      message: "This entry conflicts with other recorded EPF activity, for example by making a balance negative. Check the amount and date." };
  }
  const affected = event.type === "transfer" ? [event.sourceId, event.destinationId] : [context.account.id];
  const value = (result: typeof before, id: string) => result.ok
    ? result.accounts.find((item) => item.accountId === id)?.balance.total ?? null : null;
  return { ok: true, plan: { event, cash, effect: {
    accounts: affected.map((id) => ({ accountId: id, nickname: context.accounts.find((item) => item.id === id)?.nickname ?? id,
      before: value(before, id), after: value(after.result, id) })),
    totalBefore: before.total,
    totalAfter: after.result.total,
    inTransitAfter: after.result.inTransit,
    cashChange: cash ? amount : 0,
  } } };
}

export function buildEpfReversal(
  original: EpfEvent,
  draft: { date: string; reason: string },
  context: { accounts: readonly EpfAccount[]; events: readonly EpfEvent[]; id: string; now: Date },
): { ok: true; event: EpfEvent } | { ok: false; errors: EpfFieldErrors<"date" | "reason">; message?: string } {
  const today = formatLocalCalendarDate(context.now);
  const errors: EpfFieldErrors<"date" | "reason"> = {};
  const reason = draft.reason.trim();
  if (!reason) errors.reason = "Say why the provider reversed it.";
  const dateError = validDate(draft.date, today);
  if (dateError) errors.date = dateError;
  else if (draft.date < original.effectiveDate) errors.date = "A reversal cannot come before the entry it reverses.";
  if (Object.keys(errors).length || original.type === "transfer" || original.type === "reconciliation" || original.type === "reversal") {
    return { ok: false, errors, ...(Object.keys(errors).length ? {} : { message: "This entry cannot be reversed." }) };
  }
  const event: EpfEvent = { id: context.id, type: "reversal", accountId: original.accountId, reversesId: original.id,
    reason, effectiveDate: draft.date, postedDate: draft.date, recordedAt: context.now.toISOString(), evidence: original.evidence };
  const result = changeEpfEvent({ accounts: [...context.accounts], events: [...context.events] }, { type: "put", event }, today);
  if (!result.ok) return { ok: false, errors: {}, message: "This reversal conflicts with later EPF activity or has already been recorded." };
  return { ok: true, event };
}

export function eventTitle(event: EpfEvent) {
  switch (event.type) {
    case "reconciliation": return "Balance update";
    case "contribution": return event.party === "employee" ? `Employee contribution${event.voluntary ? " (voluntary)" : ""}` : "Employer contribution";
    case "interest": return "Official interest";
    case "withdrawal": return "Withdrawal";
    case "externalTransferIn": return "Transfer in";
    case "transfer": return "Transfer between accounts";
    case "reversal": return "Provider reversal";
  }
}

/** Signed effect of an entry on one account, for activity lists. */
export function eventAmountLabel(event: EpfEvent, accountId: string) {
  switch (event.type) {
    case "reconciliation": return `Balance ${formatINR(event.balance.total)}`;
    case "contribution": return `+${formatINR(event.amount)}`;
    case "interest":
    case "externalTransferIn": return `+${formatINR(event.amount.total)}`;
    case "withdrawal": return `−${formatINR(event.amount.total)}`;
    case "transfer":
      return event.sourceId === accountId ? `−${formatINR(event.amount.total)}`
        : event.status === "completed" ? `+${formatINR(event.amount.total)}` : "Arriving";
    case "reversal": return "Reversal";
  }
}
