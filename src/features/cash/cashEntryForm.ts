import {
  isFutureCalendarDate,
  parseCalendarDate,
} from "@/src/domain/dates";
import type {
  CashEntry,
  CashEntryPurpose,
  CashEntryType,
} from "@/src/types";

export type ManualCashPurpose = Extract<
  CashEntryPurpose,
  "capitalContribution" | "income" | "legacyUncategorized"
>;

export type CashEntryFormErrors = Partial<
  Record<"amount" | "date" | "label" | "save", string>
>;

export type CashEntryFormValues = {
  amount: string;
  date: string;
  label: string;
  notes: string;
  purpose: ManualCashPurpose;
  type: CashEntryType;
};

export function isLinkedCashEntry(entry: CashEntry) {
  return (
    Boolean(entry.linkedTradeId) ||
    entry.purpose === "purchaseFunding" ||
    entry.purpose === "saleProceeds"
  );
}

export function validateCashEntryForm({
  amount,
  date,
  label,
  now,
}: Pick<CashEntryFormValues, "amount" | "date" | "label"> & {
  now: Date;
}) {
  const errors: CashEntryFormErrors = {};
  const trimmedAmount = amount.trim();
  const parsedAmount =
    trimmedAmount.length > 0 ? Number(trimmedAmount) : Number.NaN;

  if (!Number.isFinite(parsedAmount)) {
    errors.amount = "Amount must be a valid number.";
  } else if (parsedAmount <= 0) {
    errors.amount = "Amount must be greater than zero.";
  }

  if (label.trim().length === 0) {
    errors.label = "Label is required.";
  }

  if (date.trim().length === 0) {
    errors.date = "Date is required.";
  } else if (!parseCalendarDate(date)) {
    errors.date = "Date must be valid.";
  } else if (isFutureCalendarDate(date, now)) {
    errors.date = "Date cannot be in the future.";
  }

  return { errors, parsedAmount };
}
