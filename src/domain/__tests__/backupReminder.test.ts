import {
  backupReminder,
  backupReminderRecordThreshold,
  portfolioFingerprint,
  portfolioRecordCount,
  recordBackupExport,
  snoozeBackupReminder,
  type BackupStatus,
} from "../backupReminder";
import type { RawPortfolioSnapshot } from "../portfolioSnapshot";
import { createEmptyPortfolioSnapshot } from "@/src/store";
import type { CashEntry } from "@/src/types";

const day = 24 * 60 * 60 * 1000;
const start = new Date("2026-01-01T09:00:00.000Z");
const at = (days: number) => new Date(start.getTime() + days * day);

function cash(id: number): CashEntry {
  return {
    amount: 100, date: "2026-01-01", id: `cash-${id}`, label: "Synthetic cash",
    purpose: "capitalContribution", type: "addition",
  } as CashEntry;
}

function portfolio(entries: number): RawPortfolioSnapshot {
  return { ...createEmptyPortfolioSnapshot(), cashEntries: Array.from({ length: entries }, (_, index) => cash(index)) };
}

function due(status: BackupStatus, snapshot: RawPortfolioSnapshot, now: Date, minimalMode = false) {
  return backupReminder({
    fingerprint: portfolioFingerprint(snapshot),
    minimalMode,
    now,
    recordCount: portfolioRecordCount(snapshot),
    status,
  });
}

const fresh: BackupStatus = { reminderDays: 30, trackingSince: start.toISOString() };

describe("backupReminder (#759)", () => {
  it("stays quiet for an empty portfolio, however long", () => {
    expect(due(fresh, portfolio(0), at(400))).toEqual({ due: false });
  });

  it("waits one interval before the first reminder, then names the missing backup", () => {
    expect(due(fresh, portfolio(3), at(29))).toEqual({ due: false });
    expect(due(fresh, portfolio(3), at(30))).toEqual({ daysSinceBackup: 30, due: true, reason: "never", recordsAdded: 3 });
  });

  it("reminds at once when many records exist and none were ever backed up", () => {
    expect(due(fresh, portfolio(backupReminderRecordThreshold), at(0))).toMatchObject({ due: true, reason: "never" });
  });

  it("never reminds when the portfolio is unchanged since the last backup", () => {
    const backedUp = recordBackupExport(fresh, portfolio(3), at(1));
    expect(due(backedUp, portfolio(3), at(500))).toEqual({ due: false });
  });

  it("reminds an interval after the last backup once the portfolio has changed", () => {
    const backedUp = recordBackupExport(fresh, portfolio(3), at(1));
    expect(due(backedUp, portfolio(4), at(30))).toEqual({ due: false });
    expect(due(backedUp, portfolio(4), at(31))).toEqual({ daysSinceBackup: 30, due: true, reason: "days", recordsAdded: 1 });
  });

  it("brings the reminder forward when enough records were added", () => {
    const backedUp = recordBackupExport(fresh, portfolio(3), at(1));
    expect(due(backedUp, portfolio(3 + backupReminderRecordThreshold - 1), at(2))).toEqual({ due: false });
    expect(due(backedUp, portfolio(3 + backupReminderRecordThreshold), at(2)))
      .toEqual({ daysSinceBackup: 1, due: true, reason: "records", recordsAdded: backupReminderRecordThreshold });
  });

  it("ignores display preference changes", () => {
    const snapshot = portfolio(3);
    const backedUp = recordBackupExport(fresh, snapshot, at(1));
    const masked = { ...snapshot, preferences: { ...snapshot.preferences, maskWealthValues: !snapshot.preferences.maskWealthValues } };
    expect(portfolioFingerprint(masked)).toBe(portfolioFingerprint(snapshot));
    expect(due(backedUp, masked, at(100))).toEqual({ due: false });
  });

  it("fingerprints records the same whatever their key order", () => {
    const snapshot = portfolio(2);
    const reordered = { ...snapshot, cashEntries: snapshot.cashEntries.map((entry) => Object.fromEntries(Object.entries(entry).reverse()) as CashEntry) };
    expect(portfolioFingerprint(reordered)).toBe(portfolioFingerprint(snapshot));
    expect(portfolioFingerprint(portfolio(3))).not.toBe(portfolioFingerprint(snapshot));
  });

  it("is off when the interval is 0", () => {
    expect(due({ ...fresh, reminderDays: 0 }, portfolio(100), at(1000))).toEqual({ due: false });
  });

  it("hides in Minimal Mode until the gap is long", () => {
    expect(due(fresh, portfolio(100), at(89), true)).toEqual({ due: false });
    expect(due(fresh, portfolio(100), at(90), true)).toMatchObject({ due: true, reason: "never" });
  });

  it("stays hidden for one interval after Not now, and an export clears the snooze", () => {
    const snoozed = snoozeBackupReminder(fresh, at(30));
    expect(due(snoozed, portfolio(3), at(59))).toEqual({ due: false });
    expect(due(snoozed, portfolio(3), at(60))).toMatchObject({ due: true });
    expect(recordBackupExport(snoozed, portfolio(3), at(40)).snoozedUntil).toBeUndefined();
  });

  it("counts every kind of saved record", () => {
    expect(portfolioRecordCount(portfolio(4))).toBe(4);
  });
});
