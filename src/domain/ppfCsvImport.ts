import { formatLocalCalendarDate, parseCalendarDate } from "./dates";
import { parsePpfCsv, type PpfCsvError } from "./ppfCsv";
import { calculatePpfConfirmedBalance, getFinancialYearStart, validatePpfAccount, validatePpfLedgerEntryForAccount } from "./ppf";
import type { PpfAccount, PpfLedgerEntry } from "@/src/types";

export type PpfCsvImportInput = {
  accountId: string;
  csv: string;
  openingBalance: number;
  balanceAsOf: string;
  baselineFyContribution: number;
  completeThrough: string;
  expectedClosingBalance?: number;
};
export type PpfCsvImportPlan = {
  errors: PpfCsvError[];
  account?: PpfAccount;
  entries: PpfLedgerEntry[];
  expectedState: string;
  alreadyApplied: boolean;
  requiresReplacement: boolean;
  duplicateRows: number;
  summary?: { opening: number; contributions: number; interest: number; withdrawals: number; closing: number; previousClosing: number; previousEntries: number };
};

export function ppfImportState(account: PpfAccount | undefined, entries: readonly PpfLedgerEntry[], input: PpfCsvImportInput) {
  return JSON.stringify([account, entries.filter((entry) => entry.accountId === account?.id), input]);
}
function money(value: number) {
  return Number.isFinite(value) && value >= 0 && Number.isSafeInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) < 0.0001;
}
function financialEntry(entry: PpfLedgerEntry) {
  // Storage validation may reorder object keys. Identity follows financial
  // fields, never insertion order or generated record IDs/timestamps.
  return JSON.stringify([
    entry.accountId, entry.date, entry.type, entry.notes ?? "",
    entry.type === "reconciliation" ? entry.confirmedBalance : entry.amount,
    entry.type === "interestCredit" ? entry.financialYearStart : null,
    entry.type === "reconciliation" ? entry.reason : null,
  ]);
}

export function planPpfCsvImport(input: PpfCsvImportInput, accounts: readonly PpfAccount[], ledger: readonly PpfLedgerEntry[], now = new Date()): PpfCsvImportPlan {
  const existing = accounts.find((account) => account.id === input.accountId);
  const oldEntries = ledger.filter((entry) => entry.accountId === input.accountId);
  const result: PpfCsvImportPlan = {
    errors: [], entries: [], expectedState: ppfImportState(existing, oldEntries, input),
    alreadyApplied: false, requiresReplacement: false, duplicateRows: 0,
  };
  const error = (message: string) => result.errors.push({ message });
  if (!existing) { error("Choose an existing PPF account first."); return result; }
  if (!parseCalendarDate(input.balanceAsOf) || input.balanceAsOf > formatLocalCalendarDate(now)) error("Choose a valid opening balance date, not in the future.");
  if (input.completeThrough !== formatLocalCalendarDate(now)) error("Confirm that the history is complete through today. Refresh the preview if the date changed.");
  if (!money(input.openingBalance) || !money(input.baselineFyContribution)) error("Opening balance and prior financial-year contributions must be non-negative INR amounts with at most two decimal places.");
  if (input.expectedClosingBalance !== undefined && !money(input.expectedClosingBalance)) error("Closing balance must be a non-negative INR amount with at most two decimal places.");
  if (result.errors.length) return result;
  const account: PpfAccount = {
    ...existing, balanceAsOf: input.balanceAsOf, confirmedBalance: input.openingBalance,
    baselineFinancialYearContributions: { financialYearStart: getFinancialYearStart(input.balanceAsOf), amount: input.baselineFyContribution },
  };
  const validation = validatePpfAccount(account, now);
  if (!validation.isValid) result.errors.push(...validation.errors.map((message) => ({ message })));
  const parsed = parsePpfCsv(input.csv, now);
  result.errors.push(...parsed.errors);
  if (result.errors.length) return result;
  let balance = Math.round(input.openingBalance * 100);
  let contributions = 0, interest = 0, withdrawals = 0;
  const seen = new Set<string>();
  const ordered = [...parsed.rows].sort((a, b) => a.date.localeCompare(b.date) || a.rowNumber - b.rowNumber);
  for (const [index, row] of ordered.entries()) {
    const base = { accountId: existing.id, id: `ppf-csv:${existing.id}:${index}`, date: row.date,
      recordedAt: new Date(now.getTime() + index).toISOString(), ...(row.note ? { notes: row.note } : {}), amount: row.amount };
    const entry: PpfLedgerEntry = row.type === "interest"
      ? { ...base, type: "interestCredit", financialYearStart: getFinancialYearStart(row.date) }
      : { ...base, type: row.type };
    const valid = validatePpfLedgerEntryForAccount(account, entry, now);
    if (!valid.isValid) result.errors.push(...valid.errors.map((message) => ({ rowNumber: row.rowNumber, message })));
    const cents = Math.round(row.amount * 100);
    if (row.type === "withdrawal") { balance -= cents; withdrawals += cents; }
    else { balance += cents; if (row.type === "interest") interest += cents; else contributions += cents; }
    if (balance < 0 || ![balance, contributions, interest, withdrawals].every(Number.isSafeInteger)) result.errors.push({ rowNumber: row.rowNumber, message: "This transaction produces an invalid or negative balance." });
    const key = financialEntry(entry);
    if (seen.has(key)) result.duplicateRows++;
    seen.add(key);
    result.entries.push(entry);
  }
  if (input.expectedClosingBalance !== undefined && balance !== Math.round(input.expectedClosingBalance * 100)) error("The calculated closing balance does not match your supplied balance. Correct the checkpoint or CSV before importing.");
  result.account = account;
  result.summary = { opening: input.openingBalance, contributions: contributions / 100, interest: interest / 100,
    withdrawals: withdrawals / 100, closing: balance / 100,
    previousClosing: calculatePpfConfirmedBalance(existing, oldEntries, input.completeThrough).confirmedBalance,
    previousEntries: oldEntries.length };
  const sameAccount = existing.balanceAsOf === account.balanceAsOf && existing.confirmedBalance === account.confirmedBalance &&
    (existing.baselineFinancialYearContributions?.amount ?? 0) === input.baselineFyContribution &&
    (!existing.baselineFinancialYearContributions || existing.baselineFinancialYearContributions.financialYearStart === getFinancialYearStart(account.balanceAsOf));
  const oldRecords = oldEntries.map(financialEntry).sort();
  const newRecords = result.entries.map(financialEntry).sort();
  const sameEntries = JSON.stringify(oldRecords) === JSON.stringify(newRecords);
  result.alreadyApplied = sameAccount && sameEntries;
  result.requiresReplacement = !result.alreadyApplied && (!sameAccount || oldEntries.length > 0);
  return result;
}
