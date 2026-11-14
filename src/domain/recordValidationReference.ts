import { formatLocalCalendarDate, getCalendarDatePart } from "@/src/domain/dates";
import { epfStateSchema } from "@/src/domain/epf/persistence";
import type { PpfAccount, PpfLedgerEntry } from "@/src/types";

/**
 * The date that already-saved records are checked against (#646).
 *
 * Saved PPF and EPF records were checked for future dates when they were
 * written. Re-checking them against the device's current date at hydration,
 * restore or an unrelated save would quarantine or block the whole portfolio
 * when the clock or time zone moves back, for example after travel or an
 * automatic time correction. The reference is therefore the later of the
 * device's local today and the latest date the saved records contain. New
 * entries are still checked against the real current date where they are
 * written.
 */
export type RecordValidationReference = {
  /** Local calendar date, `YYYY-MM-DD`. */
  today: string;
  /** Local noon on `today`, for validators that take a `Date`. */
  now: Date;
};

type SavedDatedRecords = {
  epf?: unknown;
  ppfAccounts?: readonly unknown[];
  ppfLedgerEntries?: readonly unknown[];
};

function isCalendarDate(value: unknown): value is string {
  return typeof value === "string" && getCalendarDatePart(value) === value;
}

function epfRecordDates(epf: unknown): string[] {
  const parsed = epfStateSchema.safeParse(epf);
  if (!parsed.success) return [];
  const dates: string[] = [];
  for (const account of parsed.data.accounts) {
    dates.push(account.checkpoint.date);
    if (account.historyCompleteThrough) dates.push(account.historyCompleteThrough);
  }
  for (const event of parsed.data.events) {
    dates.push(event.effectiveDate, event.postedDate);
    if ("creditDate" in event && event.creditDate) dates.push(event.creditDate);
  }
  return dates;
}

function ppfRecordDates(
  accounts: readonly unknown[] = [],
  entries: readonly unknown[] = [],
): unknown[] {
  const dates: unknown[] = [];
  for (const account of accounts as Partial<PpfAccount>[]) {
    dates.push(account?.balanceAsOf);
    if (account?.opening?.kind === "date") dates.push(account.opening.openedOn);
  }
  for (const entry of entries as Partial<PpfLedgerEntry>[]) dates.push(entry?.date);
  return dates;
}

export function getRecordValidationReference(
  records: SavedDatedRecords,
  deviceNow: Date = new Date(),
): RecordValidationReference {
  let today = formatLocalCalendarDate(deviceNow);
  for (const date of [
    ...epfRecordDates(records.epf),
    ...ppfRecordDates(records.ppfAccounts, records.ppfLedgerEntries),
  ]) {
    if (isCalendarDate(date) && date > today) today = date;
  }
  return { today, now: new Date(`${today}T12:00:00`) };
}
