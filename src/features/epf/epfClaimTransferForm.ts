import { formatLocalCalendarDate, parseCalendarDate } from "@/src/domain/dates";
import type { EpfAccount, EpfBalance, EpfClaimTransfer } from "@/src/domain/epf";
import { formatDate } from "@/src/domain/formatters";
import { decimal } from "@/src/domain/precision";
import { parseInrAmount } from "./epfAccountForm";

/** One credit on the new account's passbook, as typed. */
export type EpfClaimCreditDraft = { date: string; amount: string; employee: string; employer: string };
export type EpfClaimCreditPart = "Date" | "Amount" | "Employee" | "Employer";
export type EpfClaimCreditField = `credit${number}${EpfClaimCreditPart}`;
export const claimCreditField = (index: number, part: EpfClaimCreditPart): EpfClaimCreditField => `credit${index}${part}`;
export const MAX_CLAIM_CREDITS = 6;

export const emptyClaimCredit = (date: string): EpfClaimCreditDraft => ({ date, amount: "", employee: "", employer: "" });

export type EpfClaimDraftFields = {
  amount: string;
  employee: string;
  employer: string;
  settlementInterest: string;
  settlementInterestEmployee: string;
  settlementInterestEmployer: string;
  targetAccountId: string;
  transferStatus: "completed" | "inTransit";
  date: string;
  credits: EpfClaimCreditDraft[];
};

export type EpfClaimField = "amount" | "employee" | "employer" | "settlementInterest" | "settlementInterestEmployee"
  | "settlementInterestEmployer" | "targetAccountId" | "date" | EpfClaimCreditField;

function validDate(value: string, today: string) {
  if (!parseCalendarDate(value) || value.length !== 10) return "Choose a date.";
  if (value > today) return "The date cannot be in the future.";
  return null;
}

/** Amount plus an optional employee/employer split that must add up to it. */
function readBalance(
  values: { amount: string; employee: string; employer: string },
  fields: { amount: EpfClaimField; employee: EpfClaimField; employer: EpfClaimField },
  messages: { amount: string; total: string },
  errors: Partial<Record<EpfClaimField, string>>,
  allowZero = false,
): EpfBalance | null {
  const amount = parseInrAmount(values.amount);
  if (amount === null || (!allowZero && amount <= 0)) errors[fields.amount] = messages.amount;
  let components: EpfBalance["components"] = null;
  if (values.employee.trim() || values.employer.trim()) {
    const employee = parseInrAmount(values.employee);
    const employer = parseInrAmount(values.employer);
    if (employee === null) errors[fields.employee] = "Enter the employee part, or leave both parts blank.";
    if (employer === null) errors[fields.employer] = "Enter the employer part, or leave both parts blank.";
    if (employee !== null && employer !== null && amount !== null && !decimal(employee).plus(employer).equals(amount)) {
      errors[fields.employer] = messages.total;
    }
    if (employee !== null && employer !== null) components = { employee, employer };
  }
  return amount === null ? null : { total: amount, components };
}

/**
 * A move between member IDs that EPFO settles as a claim (#735): the old
 * account's claim, the interest paid inside it, and the new account's credits,
 * which may arrive before the claim date. Replay checks that they add up.
 */
export function buildEpfClaimTransfer(
  draft: EpfClaimDraftFields,
  context: { account: EpfAccount; accounts: readonly EpfAccount[]; id: string; now: Date; evidence: string },
): { ok: true; event: EpfClaimTransfer } | { ok: false; errors: Partial<Record<EpfClaimField, string>> } {
  const today = formatLocalCalendarDate(context.now);
  const errors: Partial<Record<EpfClaimField, string>> = {};
  const target = context.accounts.find((item) => item.id === draft.targetAccountId && item.id !== context.account.id);
  if (!target) errors.targetAccountId = "Choose the EPF account that received the money.";
  const dateError = validDate(draft.date, today);
  if (dateError) errors.date = dateError;
  else if (draft.date <= context.account.checkpoint.date) {
    errors.date = `Use a date after the starting balance (${formatDate(context.account.checkpoint.date)}).`;
  }
  const payout = readBalance(draft, { amount: "amount", employee: "employee", employer: "employer" },
    { amount: "Enter the claim amount from the old passbook, above zero.", total: "The two parts must add up to the claim." }, errors);
  const interest = readBalance({ amount: draft.settlementInterest, employee: draft.settlementInterestEmployee,
    employer: draft.settlementInterestEmployer },
  { amount: "settlementInterest", employee: "settlementInterestEmployee", employer: "settlementInterestEmployer" },
  { amount: "Enter the interest paid with the claim, or 0 if none.", total: "The two parts must add up to the interest." },
  errors, true);

  const credits = draft.credits.map((credit, index) => {
    const field = (part: EpfClaimCreditPart) => claimCreditField(index, part);
    const creditDateError = validDate(credit.date, today);
    if (creditDateError) errors[field("Date")] = creditDateError;
    else if (target && credit.date <= target.checkpoint.date) {
      errors[field("Date")] = `Use a date after ${target.nickname}'s starting balance (${formatDate(target.checkpoint.date)}).`;
    } else if (index > 0 && !errors[claimCreditField(index - 1, "Date")] && credit.date < draft.credits[index - 1].date) {
      errors[field("Date")] = "List the credits in date order.";
    }
    const amount = readBalance(credit, { amount: field("Amount"), employee: field("Employee"), employer: field("Employer") },
      { amount: "Enter the credit from the new passbook, above zero.", total: "The two parts must add up to the credit." }, errors);
    return amount ? { date: credit.date, postedDate: credit.date, amount } : null;
  });

  if (Object.keys(errors).length || !payout || !interest || !target || credits.some((credit) => credit === null)) {
    return { ok: false, errors };
  }
  return { ok: true, event: {
    id: context.id, type: "claimTransfer", recordedAt: context.now.toISOString(), effectiveDate: draft.date,
    postedDate: draft.date, evidence: context.evidence, sourceId: context.account.id, destinationId: target.id,
    payout, interest, credits: credits.filter((credit) => credit !== null), status: draft.transferStatus,
  } };
}

export function claimDraftFromEvent(event: EpfClaimTransfer) {
  const split = (balance: EpfBalance) => balance.components
    ? { employee: String(balance.components.employee), employer: String(balance.components.employer) }
    : { employee: "", employer: "" };
  return {
    amount: String(event.payout.total), ...split(event.payout),
    settlementInterest: String(event.interest.total),
    settlementInterestEmployee: split(event.interest).employee,
    settlementInterestEmployer: split(event.interest).employer,
    targetAccountId: event.destinationId,
    transferStatus: event.status,
    credits: event.credits.map((credit) => ({ date: credit.date, amount: String(credit.amount.total), ...split(credit.amount) })),
  };
}

/** Credits received so far, for the new account's activity row. */
export const claimCreditedTotal = (event: EpfClaimTransfer) =>
  event.credits.reduce((total, credit) => total.plus(credit.amount.total), decimal(0)).toNumber();
