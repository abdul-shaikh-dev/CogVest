import type { RawPortfolioSnapshot } from "@/src/domain/portfolioSnapshot";

/**
 * Backup reminders (#759).
 *
 * The portfolio lives only on this phone, so CogVest notes when a backup is
 * due. The rule is pure: it compares the portfolio now with the one the last
 * backup saved, and reminds only when something would be lost. Restoring a
 * backup is not a backup: it changes the portfolio but not the record of the
 * last export.
 */

/** Days without a backup before the reminder shows. 0 turns it off. */
export const backupReminderDayOptions = [0, 7, 30, 90] as const;
export type BackupReminderDays = (typeof backupReminderDayOptions)[number];
export const defaultBackupReminderDays: BackupReminderDays = 30;

/** Records added since the last backup that bring the reminder forward. */
export const backupReminderRecordThreshold = 25;

/** Minimal Mode shows the reminder only after a gap this long. */
export const backupReminderMinimalModeDays = 90;

const dayMs = 24 * 60 * 60 * 1000;

export type BackupStatus = {
  /** When this phone started keeping the record; the clock until the first backup. */
  trackingSince: string;
  reminderDays: BackupReminderDays;
  lastBackupAt?: string;
  /** `portfolioFingerprint` of the portfolio the last backup saved. */
  fingerprintAtBackup?: string;
  recordCountAtBackup?: number;
  /** Set by "Not now"; the reminder stays hidden until then. */
  snoozedUntil?: string;
};

/** Every saved record the user would lose without a backup. */
export function portfolioRecordCount(snapshot: RawPortfolioSnapshot) {
  return snapshot.assets.length
    + snapshot.openingPositions.length
    + snapshot.trades.length
    + snapshot.cashEntries.length
    + snapshot.distributions.length
    + snapshot.futuresAccounts.length
    + snapshot.monthlySnapshots.length
    + snapshot.ppfAccounts.length
    + snapshot.ppfLedgerEntries.length
    + snapshot.epf.accounts.length
    + snapshot.epf.events.length;
}

/** JSON with object keys sorted, so equal records hash alike whatever their key order. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item ?? null)).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * A short hash of the portfolio's records. Display preferences are left out:
 * hiding values or changing the theme is not new data to back up.
 */
export function portfolioFingerprint(snapshot: RawPortfolioSnapshot) {
  const { preferences: _preferences, ...records } = snapshot;
  const text = canonicalJson(records);
  // cyrb53: two 32-bit lanes, 53 bits in all. Collisions only hide a reminder.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export type BackupReminder =
  | { due: false }
  | { due: true; reason: "never" | "days" | "records"; daysSinceBackup: number; recordsAdded: number };

export type BackupReminderInput = {
  status: BackupStatus;
  now: Date;
  fingerprint: string;
  recordCount: number;
  minimalMode: boolean;
};

function wholeDaysBetween(fromIso: string, to: Date) {
  const from = Date.parse(fromIso);
  if (!Number.isFinite(from)) return 0;
  return Math.max(0, Math.floor((to.getTime() - from) / dayMs));
}

export function backupReminder({ status, now, fingerprint, recordCount, minimalMode }: BackupReminderInput): BackupReminder {
  if (status.reminderDays === 0 || recordCount === 0) return { due: false };
  if (status.fingerprintAtBackup !== undefined && status.fingerprintAtBackup === fingerprint) return { due: false };
  if (status.snoozedUntil !== undefined && Date.parse(status.snoozedUntil) > now.getTime()) return { due: false };

  const daysSinceBackup = wholeDaysBetween(status.lastBackupAt ?? status.trackingSince, now);
  const recordsAdded = Math.max(0, recordCount - (status.recordCountAtBackup ?? 0));
  const overdue = daysSinceBackup >= status.reminderDays;
  const manyAdded = recordsAdded >= backupReminderRecordThreshold;
  if (!overdue && !manyAdded) return { due: false };
  if (minimalMode && daysSinceBackup < backupReminderMinimalModeDays) return { due: false };

  const reason = status.lastBackupAt === undefined ? "never" : overdue ? "days" : "records";
  return { due: true, reason, daysSinceBackup, recordsAdded };
}

/** "Not now" hides the reminder for one reminder interval. */
export function snoozeBackupReminder(status: BackupStatus, now: Date): BackupStatus {
  const days = status.reminderDays === 0 ? defaultBackupReminderDays : status.reminderDays;
  return { ...status, snoozedUntil: new Date(now.getTime() + days * dayMs).toISOString() };
}

/** A finished export: the reminder clock and the comparison point move to now. */
export function recordBackupExport(status: BackupStatus, snapshot: RawPortfolioSnapshot, now: Date): BackupStatus {
  const { snoozedUntil: _snoozedUntil, ...rest } = status;
  return {
    ...rest,
    lastBackupAt: now.toISOString(),
    fingerprintAtBackup: portfolioFingerprint(snapshot),
    recordCountAtBackup: portfolioRecordCount(snapshot),
  };
}
