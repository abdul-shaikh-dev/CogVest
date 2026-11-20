import { decimal } from "@/src/domain/precision";

import { calculateEpfLedger } from "./calculations";
import { isEpfAccountMove, type EpfAccount, type EpfBalance, type EpfEvent, type EpfLedger } from "./model";
import type { PassbookImportPlan } from "./passbookImport";

/**
 * Merges a passbook import plan into the saved EPF ledger (#740). Re-importing
 * the same passbooks changes nothing; a changed year replaces only that year's
 * imported records; hand-made entries are never overwritten. The result is one
 * batch to save after the user confirms.
 */

export type PassbookBatchItem =
  | { type: "accountPut"; account: EpfAccount }
  | { type: "eventPut"; event: EpfEvent }
  | { type: "eventRemove"; id: string };

export type PassbookRecordChange =
  | { kind: "added"; event: EpfEvent }
  | { kind: "updated"; before: EpfEvent; event: EpfEvent }
  | { kind: "removed"; before: EpfEvent };

export type PassbookMergeResult =
  | { ok: true; changes: PassbookBatchItem[]; records: PassbookRecordChange[]; accountsAdded: string[]; startingBalancesMoved: string[] }
  | { ok: false; conflicts: string[] };

const importPrefix = (accountId: string) => `epf-import-${accountId}-`;
const isImported = (event: EpfEvent, accountId: string) => event.id.startsWith(importPrefix(accountId));
const touches = (event: EpfEvent, accountId: string) => isEpfAccountMove(event)
  ? event.sourceId === accountId || event.destinationId === accountId : event.accountId === accountId;
/** Same record apart from when it was recorded. */
const sameRecord = (a: EpfEvent, b: EpfEvent) => JSON.stringify({ ...a, recordedAt: "" }) === JSON.stringify({ ...b, recordedAt: "" });
const sameBalance = (a: EpfBalance, b: EpfBalance) => decimal(a.total).equals(b.total) &&
  (!a.components || !b.components || (decimal(a.components.employee).equals(b.components.employee) &&
    decimal(a.components.employer).equals(b.components.employer)));

export function mergePassbookImport(saved: EpfLedger, plan: PassbookImportPlan, today: string): PassbookMergeResult {
  const conflicts: string[] = [];
  const changes: PassbookBatchItem[] = [];
  const accountsAdded: string[] = [];
  const startingBalancesMoved: string[] = [];
  const accounts = new Map(saved.accounts.map((account) => [account.id, account]));

  for (const planned of plan.accounts) {
    const existing = accounts.get(planned.id);
    if (!existing) {
      changes.push({ type: "accountPut", account: planned });
      accountsAdded.push(planned.id);
      continue;
    }
    const name = existing.nickname;
    const handEntries = saved.events.filter((event) => touches(event, existing.id) && !isImported(event, existing.id));
    const status = planned.status === "transferred" ? "transferred" : existing.status;
    if (planned.checkpoint.date < existing.checkpoint.date) {
      if (handEntries.length) {
        conflicts.push(`${name} already has entries recorded by hand. The passbooks start before its starting balance, so ` +
          "import them into a new EPF account, or remove those entries first.");
        continue;
      }
      changes.push({ type: "accountPut", account: { ...existing, status, checkpoint: planned.checkpoint } });
      startingBalancesMoved.push(existing.id);
    } else if (planned.checkpoint.date === existing.checkpoint.date) {
      if (!sameBalance(planned.checkpoint.balance, existing.checkpoint.balance)) {
        conflicts.push(`${name}'s starting balance doesn't match the passbook's opening balance on the same date.`);
        continue;
      }
      if (status !== existing.status) changes.push({ type: "accountPut", account: { ...existing, status } });
    } else {
      // A later passbook must carry on from the balance already recorded.
      const replay = calculateEpfLedger(saved, planned.checkpoint.date, today);
      const recorded = replay.ok ? replay.accounts.find((item) => item.accountId === existing.id)?.balance : undefined;
      if (!recorded || !sameBalance(planned.checkpoint.balance, recorded)) {
        conflicts.push(`The first passbook for ${name} opens with a different balance than CogVest has recorded for that date. ` +
          "Import the earlier years too, or check the account.");
        continue;
      }
      if (status !== existing.status) changes.push({ type: "accountPut", account: { ...existing, status } });
    }
  }
  if (conflicts.length) return { ok: false, conflicts };

  const records: PassbookRecordChange[] = [];
  const savedById = new Map(saved.events.map((event) => [event.id, event]));
  const plannedIds = new Set(plan.events.map((event) => event.id));
  for (const event of plan.events) {
    const before = savedById.get(event.id);
    if (before && sameRecord(before, event)) continue;
    changes.push({ type: "eventPut", event });
    records.push(before ? { kind: "updated", before, event } : { kind: "added", event });
  }
  // A year imported again replaces that year's earlier imported records.
  const replacedYears = plan.years.filter((year) => year.status !== "blocked")
    .map((year) => `${importPrefix(year.accountId)}fy${year.year}-`);
  for (const event of saved.events) {
    if (plannedIds.has(event.id) || !replacedYears.some((prefix) => event.id.startsWith(prefix))) continue;
    changes.push({ type: "eventRemove", id: event.id });
    records.push({ kind: "removed", before: event });
  }

  // The merged ledger must replay; a clash with hand-made entries surfaces here.
  const nextAccounts = new Map(accounts);
  const nextEvents = new Map(savedById);
  for (const change of changes) {
    if (change.type === "accountPut") nextAccounts.set(change.account.id, change.account);
    else if (change.type === "eventPut") nextEvents.set(change.event.id, change.event);
    else nextEvents.delete(change.id);
  }
  const replay = calculateEpfLedger({ accounts: [...nextAccounts.values()], events: [...nextEvents.values()] }, today, today);
  if (!replay.ok) {
    return { ok: false, conflicts: ["The imported years clash with EPF entries already recorded: " + replay.errors.join(" ")] };
  }
  return { ok: true, changes, records, accountsAdded, startingBalancesMoved };
}
