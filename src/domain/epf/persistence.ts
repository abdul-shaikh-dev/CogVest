import { z } from "zod";

import { formatLocalCalendarDate } from "@/src/domain/dates";
import { decimal } from "@/src/domain/precision";
import type { CashEntry } from "@/src/types";
import { calculateEpfLedger } from "./calculations";
import { epfAccountSchema, epfEventSchema } from "./model";

const id = z.string().min(1).max(200).refine((value) => value === value.trim());
const cashDraft = z.object({ id, label: z.string().trim().min(1).max(200) }).strict();
const linkSchema = z.object({ eventId: id, cashEntryId: id }).strict();
const changeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("accountPut"), account: epfAccountSchema }).strict(),
  z.object({ type: z.literal("accountRemove"), id }).strict(),
  z.object({ type: z.literal("eventPut"), event: epfEventSchema, cash: cashDraft.nullable() }).strict(),
  z.object({ type: z.literal("eventRemove"), id }).strict(),
]);
const archivedCashSchema = z.object({
  id, label: z.string().min(1), amount: z.number().finite().positive(), date: z.string(),
  purpose: z.literal("epfTransfer"), type: z.enum(["addition", "withdrawal"]),
  linkedEpf: z.object({ accountId: id, eventId: id }).strict(),
}).strict();
const auditSchema = z.object({
  commandId: id, recordedAt: z.string().datetime({ offset: true }),
  reason: z.string().trim().min(1).max(500), change: changeSchema,
  previousAccount: epfAccountSchema.nullable(), previousEvent: epfEventSchema.nullable(),
  previousCash: archivedCashSchema.nullable(),
}).strict();
export const epfStateSchema = z.object({
  accounts: z.array(epfAccountSchema).max(100), events: z.array(epfEventSchema).max(10000),
  cashLinks: z.array(linkSchema).max(10000), audit: z.array(auditSchema).max(10000),
}).strict();
export type EpfState = z.infer<typeof epfStateSchema>;
export type EpfChange = z.infer<typeof changeSchema>;
export type EpfCommand = { commandId: string; reason: string; change: EpfChange };
export const emptyEpfState = (): EpfState => ({ accounts: [], events: [], cashLinks: [], audit: [] });

export function validateEpfState(input: unknown, cashEntries: readonly CashEntry[], today = formatLocalCalendarDate(new Date())): EpfState {
  const state = epfStateSchema.parse(input);
  const replay = calculateEpfLedger({ accounts: state.accounts, events: state.events }, today, today);
  if (!replay.ok) throw new Error("EPF account history is invalid.");
  if (new Set(state.audit.map((item) => item.commandId)).size !== state.audit.length) {
    throw new Error("EPF audit command IDs must be unique.");
  }
  const eventIds = new Set<string>();
  const cashIds = new Set<string>();
  const eventsById = new Map(state.events.map((event) => [event.id, event]));
  const cashById = new Map<string, CashEntry[]>();
  for (const cash of cashEntries) cashById.set(cash.id, [...(cashById.get(cash.id) ?? []), cash]);
  const reversedIds = new Set(state.events.flatMap((event) => event.type === "reversal" ? [event.reversesId] : []));
  for (const link of state.cashLinks) {
    if (eventIds.has(link.eventId) || cashIds.has(link.cashEntryId)) throw new Error("Duplicate EPF Cash link.");
    eventIds.add(link.eventId); cashIds.add(link.cashEntryId);
    const event = eventsById.get(link.eventId);
    const matches = cashById.get(link.cashEntryId) ?? [];
    const cash = matches[0];
    if (!event || matches.length !== 1 || !cash || cash.linkedTradeId || cash.linkedFutures ||
      !cash.linkedEpf || cash.linkedEpf.eventId !== event.id || cash.purpose !== "epfTransfer") {
      throw new Error("EPF Cash link is missing or inconsistent.");
    }
    archivedCashSchema.parse(cash);
    if (!(event.type === "withdrawal" && event.destination === "unknown") &&
      !(event.type === "contribution" && event.party === "employee")) {
      throw new Error("Only an employee contribution or withdrawal can be linked to Cash.");
    }
    const amount = event.type === "withdrawal" ? event.amount.total : event.amount;
    if (cash.linkedEpf.accountId !== event.accountId || cash.date !== event.effectiveDate ||
      cash.type !== (event.type === "withdrawal" ? "addition" : "withdrawal") ||
      !Number.isFinite(cash.amount) || !decimal(cash.amount).equals(amount)) {
      throw new Error("EPF and Cash values, dates and directions must reconcile exactly.");
    }
    if (reversedIds.has(event.id)) {
      throw new Error("Resolve linked Cash before reversing the EPF event.");
    }
  }
  for (const cash of cashEntries) {
    if ((cash.linkedEpf || cash.purpose === "epfTransfer") && !cashIds.has(cash.id)) {
      throw new Error("Cash entry has no matching EPF link.");
    }
  }
  return state;
}

export function previewEpfAccountDeletion(state: EpfState, accountId: string) {
  const events = state.events.filter((event) => event.type === "transfer"
    ? event.sourceId === accountId || event.destinationId === accountId : event.accountId === accountId);
  return {
    accountId, exists: state.accounts.some((account) => account.id === accountId),
    canDelete: state.accounts.some((account) => account.id === accountId) && events.length === 0,
    eventIds: events.map((event) => event.id),
    counterpartAccountIds: [...new Set(events.flatMap((event) => event.type === "transfer"
      ? [event.sourceId, event.destinationId].filter((value) => value !== accountId) : []))],
    cashEntryIds: state.cashLinks.filter((link) => events.some((event) => event.id === link.eventId)).map((link) => link.cashEntryId),
  };
}

export function planEpfCommand(state: EpfState, cashEntries: CashEntry[], input: EpfCommand, recordedAt: string) {
  const command = z.object({ commandId: id, reason: z.string().trim().min(1).max(500), change: changeSchema }).strict().parse(input);
  const today = formatLocalCalendarDate(new Date(recordedAt));
  validateEpfState(state, cashEntries, today);
  const previousCommand = state.audit.find((item) => item.commandId === command.commandId);
  if (previousCommand) {
    if (JSON.stringify(previousCommand.change) !== JSON.stringify(command.change) || previousCommand.reason !== command.reason) {
      throw new Error("This EPF command ID was already used for a different change.");
    }
    return { status: "alreadyApplied" as const, epf: state, cashEntries };
  }
  const next = epfStateSchema.parse(state);
  let nextCash = [...cashEntries];
  const change = command.change;
  const accountId = change.type === "accountPut" ? change.account.id : change.type === "accountRemove" ? change.id : null;
  const eventId = change.type === "eventPut" ? change.event.id : change.type === "eventRemove" ? change.id : null;
  const previousAccount = state.accounts.find((item) => item.id === accountId) ?? null;
  const previousEvent = state.events.find((item) => item.id === eventId) ?? null;
  const previousLink = state.cashLinks.find((item) => item.eventId === eventId);
  const previousCash = cashEntries.find((item) => item.id === previousLink?.cashEntryId) ?? null;
  if (change.type === "accountPut") {
    next.accounts = [...next.accounts.filter((item) => item.id !== change.account.id), change.account];
  } else if (change.type === "accountRemove") {
    if (!previewEpfAccountDeletion(state, change.id).canDelete) {
      throw new Error("Review and resolve this account's linked events before deleting it.");
    }
    next.accounts = next.accounts.filter((item) => item.id !== change.id);
  } else {
    if (change.type === "eventRemove" && !previousEvent) throw new Error("EPF event was not found.");
    next.events = next.events.filter((item) => item.id !== eventId);
    next.cashLinks = next.cashLinks.filter((item) => item.eventId !== eventId);
    if (previousLink) nextCash = nextCash.filter((item) => item.id !== previousLink.cashEntryId);
    if (change.type === "eventPut") {
      next.events.push(change.event);
      if (change.cash) {
        if (nextCash.some((item) => item.id === change.cash!.id)) throw new Error("Cash entry ID is already in use.");
        const event = change.event;
        if (event.type !== "contribution" && event.type !== "withdrawal") throw new Error("This EPF event cannot move Cash.");
        nextCash.push({ id: change.cash.id, label: change.cash.label,
          amount: event.type === "contribution" ? event.amount : event.amount.total,
          date: event.effectiveDate, purpose: "epfTransfer",
          type: event.type === "contribution" ? "withdrawal" : "addition",
          linkedEpf: { accountId: event.accountId, eventId: event.id },
        });
        next.cashLinks.push({ eventId: event.id, cashEntryId: change.cash.id });
      }
    }
  }
  next.audit.push({ ...command, recordedAt, previousAccount, previousEvent,
    previousCash: previousCash ? archivedCashSchema.parse(previousCash) : null });
  if (previousCash || (change.type === "eventPut" && change.cash)) {
    // A correction must not spend money that was unavailable on that day, or
    // remove the funding of later recorded movements. Existing deficits may improve.
    const changes = new Map<string, { before: ReturnType<typeof decimal>; after: ReturnType<typeof decimal> }>();
    for (const [entries, key] of [[cashEntries, "before"], [nextCash, "after"]] as const) {
      for (const entry of entries) {
        const row = changes.get(entry.date) ?? { before: decimal(0), after: decimal(0) };
        row[key] = entry.type === "addition" ? row[key].plus(entry.amount) : row[key].minus(entry.amount);
        changes.set(entry.date, row);
      }
    }
    let before = decimal(0);
    let after = decimal(0);
    for (const date of [...changes.keys()].sort()) {
      before = before.plus(changes.get(date)!.before);
      after = after.plus(changes.get(date)!.after);
      if (after.isNegative() && after.lessThan(before)) throw new Error("This change would leave insufficient tracked Cash.");
    }
  }
  const checked = validateEpfState(next, nextCash, today);
  return { status: "applied" as const, epf: checked, cashEntries: nextCash };
}
