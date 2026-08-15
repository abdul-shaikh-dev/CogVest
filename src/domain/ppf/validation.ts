import { getCalendarDatePart, isFutureCalendarDate } from "@/src/domain/dates";
import type { PpfAccount, PpfLedgerEntry } from "@/src/types";

export type PpfValidationResult =
  | { isValid: true }
  | { errors: string[]; isValid: false };

export function getFinancialYearStart(date: string | Date): number {
  const value = typeof date === "string" ? new Date(`${date}T12:00:00`) : date;
  const year = value.getFullYear();
  return value.getMonth() >= 3 ? year : year - 1;
}

export function getPpfOpeningDate(account: PpfAccount) {
  return account.opening.kind === "date"
    ? account.opening.openedOn
    : `${account.opening.financialYearStart}-04-01`;
}

export function getPpfMaturityFinancialYearStart(account: PpfAccount) {
  const openingFinancialYear =
    account.opening.kind === "date"
      ? getFinancialYearStart(account.opening.openedOn)
      : account.opening.financialYearStart;
  return openingFinancialYear + 16;
}

export function isPpfContributionDateAllowed(account: PpfAccount, date: string) {
  const maturityFinancialYear = getPpfMaturityFinancialYearStart(account);
  if (date <= `${maturityFinancialYear}-03-31`) return true;
  if (
    account.confirmedExtensionStartFinancialYear === undefined
  ) {
    return false;
  }
  return (
    date >= `${account.confirmedExtensionStartFinancialYear}-04-01` &&
    date <= `${account.confirmedExtensionStartFinancialYear + 5}-03-31`
  );
}

export function validatePpfAccount(
  account: PpfAccount,
  now = new Date(),
): PpfValidationResult {
  const errors: string[] = [];
  const currentFinancialYear = getFinancialYearStart(now);
  const openingFinancialYear =
    account.opening.kind === "date"
      ? getFinancialYearStart(account.opening.openedOn)
      : account.opening.financialYearStart;

  if (account.nickname.trim().length === 0) errors.push("Nickname is required.");
  if (account.provider.trim().length === 0) errors.push("Provider is required.");
  if (!Number.isFinite(new Date(account.createdAt).getTime())) {
    errors.push("Account record time is invalid.");
  }
  if (
    account.accountNumberSuffix !== undefined &&
    !/^\d{2,4}$/.test(account.accountNumberSuffix)
  ) {
    errors.push("Account suffix must contain the final 2 to 4 digits only.");
  }
  if (!Number.isFinite(account.confirmedBalance) || account.confirmedBalance < 0) {
    errors.push("Confirmed balance must be zero or greater.");
  }
  if (
    getCalendarDatePart(account.balanceAsOf) !== account.balanceAsOf ||
    isFutureCalendarDate(account.balanceAsOf, now)
  ) {
    errors.push("Balance date must be a valid non-future date.");
  }
  if (account.opening.kind === "date") {
    if (
      getCalendarDatePart(account.opening.openedOn) !== account.opening.openedOn ||
      isFutureCalendarDate(account.opening.openedOn, now)
    ) {
      errors.push("Opening date must be a valid non-future date.");
    }
  } else if (
    !Number.isInteger(account.opening.financialYearStart) ||
    account.opening.financialYearStart < 1968 ||
    account.opening.financialYearStart > currentFinancialYear
  ) {
    errors.push("Opening financial year is invalid.");
  }
  if (openingFinancialYear > getFinancialYearStart(account.balanceAsOf)) {
    errors.push("Balance date cannot precede the opening financial year.");
  }
  if (
    account.opening.kind === "date" &&
    account.balanceAsOf < account.opening.openedOn
  ) {
    errors.push("Balance date cannot precede the exact opening date.");
  }

  const isExtended =
    account.status === "extendedWithContributions";
  if (isExtended && account.confirmedExtensionStartFinancialYear === undefined) {
    errors.push("Extended accounts require a confirmed extension start year.");
  }
  if (
    account.confirmedExtensionStartFinancialYear !== undefined &&
    (!Number.isInteger(account.confirmedExtensionStartFinancialYear) ||
      account.confirmedExtensionStartFinancialYear <
        getPpfMaturityFinancialYearStart(account) ||
      (account.confirmedExtensionStartFinancialYear -
        getPpfMaturityFinancialYearStart(account)) %
        5 !==
        0)
  ) {
    errors.push("Extension must start at maturity or a later five-year block.");
  }
  if (
    account.status === "active" &&
    account.confirmedExtensionStartFinancialYear !== undefined
  ) {
    errors.push("Active accounts cannot have an extension start year.");
  }

  const baseline = account.baselineFinancialYearContributions;
  if (
    baseline &&
    (!Number.isFinite(baseline.amount) ||
      baseline.amount < 0 ||
      !Number.isInteger(baseline.financialYearStart))
  ) {
    errors.push("Baseline financial-year contributions are invalid.");
  }

  return errors.length === 0 ? { isValid: true } : { errors, isValid: false };
}

export function validatePpfLedgerEntry(
  entry: PpfLedgerEntry,
  now = new Date(),
): PpfValidationResult {
  const errors: string[] = [];

  if (entry.accountId.trim().length === 0) errors.push("Account is required.");
  if (entry.id.trim().length === 0) errors.push("Entry ID is required.");
  if (!Number.isFinite(new Date(entry.recordedAt).getTime())) {
    errors.push("Entry record time is invalid.");
  }
  if (
    getCalendarDatePart(entry.date) !== entry.date ||
    isFutureCalendarDate(entry.date, now)
  ) {
    errors.push("Entry date must be a valid non-future date.");
  }

  if (entry.type === "reconciliation") {
    if (!Number.isFinite(entry.confirmedBalance) || entry.confirmedBalance < 0) {
      errors.push("Reconciled balance must be zero or greater.");
    }
    if (entry.reason.trim().length === 0) {
      errors.push("Reconciliation reason is required.");
    }
  } else {
    if (!Number.isFinite(entry.amount) || entry.amount <= 0) {
      errors.push("Entry amount must be greater than zero.");
    }
    if (entry.type === "contribution" && entry.amount % 50 !== 0) {
      errors.push("PPF contributions must be in multiples of ₹50.");
    }
    if (
      entry.type === "interestCredit" &&
      (!Number.isInteger(entry.financialYearStart) ||
        entry.financialYearStart !== getFinancialYearStart(entry.date))
    ) {
      errors.push("Interest credit financial year does not match its date.");
    }
  }

  return errors.length === 0 ? { isValid: true } : { errors, isValid: false };
}

export function validatePpfLedgerEntryForAccount(
  account: PpfAccount,
  entry: PpfLedgerEntry,
  now = new Date(),
): PpfValidationResult {
  const base = validatePpfLedgerEntry(entry, now);
  const errors = base.isValid ? [] : [...base.errors];

  if (entry.accountId !== account.id) errors.push("Entry account does not match.");
  if (entry.date <= account.balanceAsOf) {
    errors.push("Entry date must be after the confirmed balance date.");
  }
  if (entry.date < getPpfOpeningDate(account)) {
    errors.push("Entry date cannot precede the account opening date.");
  }
  if (
    entry.type === "contribution" &&
    !isPpfContributionDateAllowed(account, entry.date)
  ) {
    errors.push("Contributions are not allowed after maturity without a confirmed extension.");
  }

  return errors.length === 0 ? { isValid: true } : { errors, isValid: false };
}
