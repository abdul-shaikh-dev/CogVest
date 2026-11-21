import { calculateEpfLedger, type EpfAccount, type EpfLedger } from "@/src/domain/epf";
import type { EpfoPassbook, PassbookReadResult } from "@/src/domain/epf/passbook";
import type { PassbookImportAccount, PassbookImportPlan } from "@/src/domain/epf/passbookImport";
import type { PassbookMergeResult, PassbookRecordChange } from "@/src/domain/epf/passbookImportMerge";
import { formatDate, formatINR } from "@/src/domain/formatters";

/** One chosen PDF and what reading it found. */
export type PickedPassbook = { key: string; name: string; result: PassbookReadResult };

/** Where one member ID's passbooks go: a new account or an existing EPFO account. */
export type MemberChoice = { target: string; nickname: string };
export const NEW_ACCOUNT = "new";

export type MemberGroup = {
  memberId: string;
  /** The last four characters only, to recognise the passbook; never saved. */
  label: string;
  years: string[];
};

export const financialYearLabel = (yearStart: string | number) => {
  const year = typeof yearStart === "number" ? yearStart : Number(yearStart.slice(0, 4));
  return `FY ${year}-${String((year + 1) % 100).padStart(2, "0")}`;
};
const memberEnding = (memberId: string) => `ending ${memberId.slice(-4)}`;

export function groupPassbooks(files: readonly PickedPassbook[]) {
  const read = files.flatMap((file) => file.result.ok ? [file.result.passbook] : []);
  const rejected = files.flatMap((file) => file.result.ok ? [] : [{ key: file.key, name: file.name, message: file.result.message }]);
  const members = new Map<string, EpfoPassbook[]>();
  for (const passbook of read) members.set(passbook.memberId, [...(members.get(passbook.memberId) ?? []), passbook]);
  const groups: MemberGroup[] = [...members].map(([memberId, list]) => ({
    memberId,
    label: `Member ID ${memberEnding(memberId)}`,
    years: [...new Set(list.map((item) => item.yearStart))].sort().map(financialYearLabel),
  })).sort((a, b) => a.years[0].localeCompare(b.years[0]));
  return { passbooks: read, rejected, groups };
}

export const defaultChoice = (group: MemberGroup): MemberChoice =>
  ({ target: NEW_ACCOUNT, nickname: `EPF ${group.memberId.slice(-4)}` });

/** Existing accounts a passbook can go into: EPFO accounts not already chosen for another member ID. */
export function targetOptions(accounts: readonly EpfAccount[], choices: Record<string, MemberChoice>, memberId: string) {
  const taken = new Set(Object.entries(choices).filter(([id]) => id !== memberId).map(([, choice]) => choice.target));
  return [{ label: "A new EPF account", value: NEW_ACCOUNT },
    ...accounts.filter((account) => account.provider === "epfo" && !taken.has(account.id))
      .map((account) => ({ label: account.nickname, value: account.id }))];
}

export function buildAssignment(
  groups: readonly MemberGroup[],
  choices: Record<string, MemberChoice>,
  newIds: Record<string, string>,
  accounts: readonly EpfAccount[],
): { ok: true; assignment: PassbookImportAccount[] } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const assignment = groups.map((group) => {
    const choice = choices[group.memberId] ?? defaultChoice(group);
    if (choice.target !== NEW_ACCOUNT) {
      const existing = accounts.find((account) => account.id === choice.target);
      if (!existing) errors[group.memberId] = "Choose the account again; it is no longer available.";
      return { memberId: group.memberId, id: choice.target, nickname: existing?.nickname ?? choice.nickname };
    }
    const nickname = choice.nickname.trim();
    if (!nickname) errors[group.memberId] = "Name the new account.";
    else if (accounts.some((account) => account.nickname.toLowerCase() === nickname.toLowerCase())) {
      errors[group.memberId] = "An EPF account already has this name. Choose another, or import into that account.";
    }
    return { memberId: group.memberId, id: newIds[group.memberId], nickname };
  });
  const newNames = assignment.filter((item) => item.id === newIds[item.memberId]).map((item) => item.nickname.toLowerCase());
  for (const item of assignment) {
    if (item.id === newIds[item.memberId] && newNames.filter((name) => name === item.nickname.toLowerCase()).length > 1) {
      errors[item.memberId] ??= "Give each new account its own name.";
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, assignment };
}

const yearStatus = { imported: "Imported", inProgress: "Year in progress", blocked: "Not imported" } as const;

function recordLabel(change: PassbookRecordChange, nickname: (id: string) => string) {
  const event = change.kind === "removed" ? change.before : change.event;
  const year = event.id.match(/-fy(\d{4})-/)?.[1];
  const what = event.type === "yearSummary" ? "year summary"
    : event.type === "claimTransfer" ? `move to ${nickname(event.destinationId)}`
      : event.type === "withdrawal" ? "final settlement"
        : event.type === "externalTransferIn" ? `transfer-in on ${formatDate(event.effectiveDate)}`
          : event.type === "contribution" ? "contribution" : "entry";
  return `${year ? `${financialYearLabel(Number(year))} ` : ""}${what}`;
}

/** What the review shows for each account, and whether anything would change. */
export function reviewImport(saved: EpfLedger, plan: PassbookImportPlan, merge: Extract<PassbookMergeResult, { ok: true }>, today: string) {
  const after = applyBatch(saved, merge.changes);
  const before = calculateEpfLedger(saved, today, today);
  const next = calculateEpfLedger(after, today, today);
  const value = (result: typeof before, id: string) => result.ok
    ? result.accounts.find((item) => item.accountId === id)?.balance.total ?? null : null;
  const nickname = (id: string) => after.accounts.find((item) => item.id === id)?.nickname ?? "another account";
  const touched = (change: PassbookRecordChange) => {
    const event = change.kind === "removed" ? change.before : change.event;
    return "accountId" in event ? event.accountId : event.sourceId;
  };
  const accounts = plan.accounts.map((account) => {
    const changes = merge.records.filter((change) => touched(change) === account.id);
    return {
      id: account.id,
      nickname: nickname(account.id),
      isNew: merge.accountsAdded.includes(account.id),
      startingBalanceMoved: merge.startingBalancesMoved.includes(account.id),
      balance: { before: merge.accountsAdded.includes(account.id) ? null : value(before, account.id), after: value(next, account.id) },
      years: plan.years.filter((year) => year.accountId === account.id).map((year) => ({
        key: `${year.accountId}-${year.year}`, label: financialYearLabel(year.year), status: yearStatus[year.status],
        blocked: year.status === "blocked", message: year.message ?? null,
      })),
      added: changes.filter((change) => change.kind === "added").length,
      updated: changes.filter((change) => change.kind === "updated").map((change) => recordLabel(change, nickname)),
      removed: changes.filter((change) => change.kind === "removed").map((change) => recordLabel(change, nickname)),
      excludedPension: plan.excludedPension.find((item) => item.accountId === account.id)?.amount ?? 0,
    };
  });
  return {
    accounts,
    total: { before: before.ok ? before.total : null, after: next.ok ? next.total : null },
    nothingChanges: merge.changes.length === 0,
    warnings: plan.warnings,
  };
}

export function applyBatch(saved: EpfLedger, changes: Extract<PassbookMergeResult, { ok: true }>["changes"]): EpfLedger {
  const accounts = new Map(saved.accounts.map((item) => [item.id, item]));
  const events = new Map(saved.events.map((item) => [item.id, item]));
  for (const change of changes) {
    if (change.type === "accountPut") accounts.set(change.account.id, change.account);
    else if (change.type === "eventPut") events.set(change.event.id, change.event);
    else events.delete(change.id);
  }
  return { accounts: [...accounts.values()], events: [...events.values()] };
}

export const balanceChange = (balance: { before: number | null; after: number | null }) =>
  `${balance.before === null ? "New" : formatINR(balance.before)} → ${balance.after === null ? "—" : formatINR(balance.after)}`;
