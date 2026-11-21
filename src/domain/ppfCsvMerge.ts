import { formatLocalCalendarDate } from "./dates";
import { isCashFundedPpfEntry } from "./ppfCashLinks";
import { orderPpfCsvRows, parsePpfCsv, type PpfCsvError, type PpfCsvRow } from "./ppfCsv";
import {
  calculatePpfConfirmedBalance,
  calculatePpfFinancialYearContributions,
  comparePpfLedgerEntries,
  getFinancialYearStart,
  validatePpfAccount,
  validatePpfLedgerEntryForAccount,
} from "./ppf";
import type { PpfAccount, PpfLedgerEntry } from "@/src/types";

/** Days an entry the user typed may differ from the file and still be the same one. */
export const ppfMergeDateToleranceDays = 3;
const annualContributionLimit = 150_000;

export type PpfMergeStatus = "new" | "recorded" | "differs" | "beforeOpening";

export type PpfMergeRow = {
  row: PpfCsvRow;
  status: PpfMergeStatus;
  /** The entry the row matched in the user's records (recorded and differs). */
  existing?: PpfLedgerEntry;
  /** The entry saving would add (new), or the corrected entry (differs). */
  entry?: PpfLedgerEntry;
  /** A differing entry linked to Cash can't be changed from an import. */
  locked?: boolean;
};

export type PpfMergeYear = {
  financialYearStart: number;
  contributions: number;
  interest: number;
  withdrawals: number;
  closing: number;
};

export type PpfMergePlan = {
  errors: PpfCsvError[];
  firstRows?: string[][];
  rows: PpfMergeRow[];
  counts: Record<PpfMergeStatus, number>;
  /** New rows that repeat another row of the file exactly. */
  duplicateRows: number;
  /** Entries saving would add, and corrections the user chose. */
  additions: PpfLedgerEntry[];
  corrections: PpfLedgerEntry[];
  years: PpfMergeYear[];
  warnings: string[];
  /** Detects a change to the account or its entries between preview and save. */
  expectedState: string;
};

export type PpfMergeInput = {
  accountId: string;
  csv: string;
  /** Row numbers of differing rows whose file amount should replace the user's. */
  useFileAmounts?: readonly number[];
};

function entryType(row: PpfCsvRow): PpfLedgerEntry["type"] {
  return row.type === "interest" ? "interestCredit" : row.type;
}

function entryAmount(entry: PpfLedgerEntry) {
  return entry.type === "reconciliation" ? entry.confirmedBalance : entry.amount;
}

function daysBetween(left: string, right: string) {
  return Math.abs(Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)) / 86_400_000;
}

/** The same rules the store applies before saving PPF entries: valid, and never below zero. */
function isValidPpfLedgerTimeline(account: PpfAccount, entries: readonly PpfLedgerEntry[], now: Date) {
  if (!validatePpfAccount(account, now).isValid) return false;
  const ordered = [...entries].sort(comparePpfLedgerEntries);
  return ordered.every((entry, index) => validatePpfLedgerEntryForAccount(account, entry, now).isValid &&
    calculatePpfConfirmedBalance(account, ordered.slice(0, index + 1), entry.date).confirmedBalance >= 0);
}

function rowKey(row: PpfCsvRow) {
  return `${row.date}|${row.type}|${Math.round(row.amount * 100)}`;
}

export function ppfMergeState(account: PpfAccount | undefined, ledger: readonly PpfLedgerEntry[], csv: string) {
  return JSON.stringify([account, ledger.filter((entry) => entry.accountId === account?.id), csv]);
}

function emptyPlan(errors: PpfCsvError[], expectedState: string, firstRows?: string[][]): PpfMergePlan {
  return {
    additions: [], corrections: [], counts: { beforeOpening: 0, differs: 0, new: 0, recorded: 0 },
    duplicateRows: 0, errors, expectedState, firstRows, rows: [], warnings: [], years: [],
  };
}

/**
 * Matches each row of a CogVest PPF CSV against the account's existing entries
 * (#748), without changing anything:
 * - recorded: an entry of the same type and amount within a few days;
 * - differs: an entry of the same type on the same date, or failing that within
 *   a few days, with another amount;
 * - new: nothing matches, so saving adds it;
 * - beforeOpening: dated on or before the account's opening balance, which
 *   already includes it.
 * Exact matches are claimed first, so a typed entry a day off never takes a
 * row that matches another entry exactly.
 */
export function planPpfCsvMerge(
  input: PpfMergeInput,
  accounts: readonly PpfAccount[],
  ledger: readonly PpfLedgerEntry[],
  now = new Date(),
): PpfMergePlan {
  const account = accounts.find((item) => item.id === input.accountId);
  const expectedState = ppfMergeState(account, ledger, input.csv);
  if (!account) return emptyPlan([{ message: "Choose an existing PPF account first." }], expectedState);
  const parsed = parsePpfCsv(input.csv, now);
  if (parsed.errors.length) return emptyPlan(parsed.errors, expectedState, parsed.firstRows);

  const existing = ledger.filter((entry) => entry.accountId === account.id && entry.type !== "reconciliation");
  const claimed = new Set<string>();
  const ordered = orderPpfCsvRows(parsed.rows);
  const matches = new Map<number, { status: PpfMergeStatus; existing?: PpfLedgerEntry }>();
  const claim = (row: PpfCsvRow, status: PpfMergeStatus, test: (entry: PpfLedgerEntry) => boolean) => {
    if (matches.has(row.rowNumber)) return;
    const candidates = existing.filter((entry) => !claimed.has(entry.id) && entry.type === entryType(row) && test(entry));
    const best = candidates.sort((left, right) => daysBetween(left.date, row.date) - daysBetween(right.date, row.date))[0];
    if (!best) return;
    claimed.add(best.id);
    matches.set(row.rowNumber, { existing: best, status });
  };
  const sameAmount = (row: PpfCsvRow) => (entry: PpfLedgerEntry) =>
    Math.round(entryAmount(entry) * 100) === Math.round(row.amount * 100);
  for (const row of ordered) if (row.date <= account.balanceAsOf) matches.set(row.rowNumber, { status: "beforeOpening" });
  for (const row of ordered) claim(row, "recorded", (entry) => sameAmount(row)(entry) && entry.date === row.date);
  for (const row of ordered) {
    claim(row, "recorded", (entry) => sameAmount(row)(entry) && daysBetween(entry.date, row.date) <= ppfMergeDateToleranceDays);
  }
  for (const row of ordered) claim(row, "differs", (entry) => entry.date === row.date);
  // A typed entry a few days off with another amount is most likely the same
  // transaction; showing it side by side avoids counting it twice.
  for (const row of ordered) claim(row, "differs", (entry) => daysBetween(entry.date, row.date) <= ppfMergeDateToleranceDays);

  const useFile = new Set(input.useFileAmounts ?? []);
  const keys = new Map<string, number>();
  for (const row of ordered) keys.set(rowKey(row), (keys.get(rowKey(row)) ?? 0) + 1);
  const plan = emptyPlan([], expectedState);
  ordered.forEach((row, index) => {
    const match = matches.get(row.rowNumber) ?? { status: "new" as const };
    const result: PpfMergeRow = { existing: match.existing, row, status: match.status };
    if (match.status === "new") {
      const base = {
        accountId: account.id, amount: row.amount, date: row.date, id: `ppf-csv:${account.id}:${now.getTime()}:${index}`,
        recordedAt: new Date(now.getTime() + index).toISOString(), ...(row.note ? { notes: row.note } : {}),
      };
      const entry: PpfLedgerEntry = row.type === "interest"
        ? { ...base, financialYearStart: getFinancialYearStart(row.date), type: "interestCredit" }
        : { ...base, type: row.type };
      result.entry = entry;
      plan.additions.push(entry);
      if ((keys.get(rowKey(row)) ?? 0) > 1) plan.duplicateRows += 1;
    } else if (match.status === "differs" && match.existing) {
      result.locked = isCashFundedPpfEntry(match.existing);
      if (!result.locked && useFile.has(row.rowNumber)) {
        result.entry = { ...match.existing, amount: row.amount } as PpfLedgerEntry;
        plan.corrections.push(result.entry);
      }
    }
    plan.counts[result.status] += 1;
    plan.rows.push(result);
  });

  const corrected = new Map(plan.corrections.map((entry) => [entry.id, entry]));
  const accountLedger = [
    ...ledger.filter((entry) => entry.accountId === account.id).map((entry) => corrected.get(entry.id) ?? entry),
    ...plan.additions,
  ];
  if (!isValidPpfLedgerTimeline(account, accountLedger, now)) {
    plan.errors.push({ message: "Adding these rows would leave the account's history invalid, for example a balance below zero." });
  }
  addYearsAndWarnings(plan, account, accountLedger, ordered, now);
  return plan;
}

function addYearsAndWarnings(
  plan: PpfMergePlan,
  account: PpfAccount,
  accountLedger: readonly PpfLedgerEntry[],
  ordered: readonly PpfCsvRow[],
  now: Date,
) {
  const today = formatLocalCalendarDate(now);
  const years = [...new Set(ordered.filter((row) => row.date > account.balanceAsOf).map((row) => getFinancialYearStart(row.date)))].sort();
  for (const year of years) {
    const inYear = accountLedger.filter((entry) => entry.date > account.balanceAsOf && getFinancialYearStart(entry.date) === year);
    const sum = (type: PpfLedgerEntry["type"]) => inYear.filter((entry) => entry.type === type)
      .reduce((total, entry) => total + Math.round(entryAmount(entry) * 100), 0) / 100;
    const yearEnd = `${year + 1}-03-31`;
    const contributions = calculatePpfFinancialYearContributions(account, accountLedger, year);
    plan.years.push({
      closing: calculatePpfConfirmedBalance(account, accountLedger, yearEnd < today ? yearEnd : today).confirmedBalance,
      contributions, financialYearStart: year, interest: sum("interestCredit"), withdrawals: sum("withdrawal"),
    });
    const label = `FY ${year}-${String(year + 1).slice(-2)}`;
    if (contributions > annualContributionLimit) {
      plan.warnings.push(`${label}: deposits total more than the ₹1.5 lakh yearly limit.`);
    }
    // A year's interest is credited at its end, so any year ending after the opening balance should have one.
    if (yearEnd < today && yearEnd > account.balanceAsOf && sum("interestCredit") === 0) {
      plan.warnings.push(`${label}: no interest credit is recorded for this completed year.`);
    }
  }
  // The file's printed balances are already consistent; compare them with what
  // the records would give once saved, at the last row of each date.
  const lastOfDate = new Map<string, PpfCsvRow>();
  for (const row of ordered) if (row.date > account.balanceAsOf) lastOfDate.set(row.date, row);
  for (const row of lastOfDate.values()) {
    if (row.balance === undefined) continue;
    const records = calculatePpfConfirmedBalance(account, accountLedger, row.date).confirmedBalance;
    if (Math.round(records * 100) !== Math.round(row.balance * 100)) {
      plan.warnings.push(`Row ${row.rowNumber}: the file shows a balance your records wouldn't reach once saved. An earlier entry may be missing or differ.`);
      break;
    }
  }
}
