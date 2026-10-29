import { decimal } from "./precision";
import type { CashEntry, PpfLedgerEntry } from "@/src/types";

/**
 * A PPF deposit paid from Cash, or a withdrawal paid into Cash, owns one Cash
 * leg (D11 in docs/design/xirr-evidence-contract.md). The two are created,
 * corrected and deleted together, so money moving between Cash and PPF stays
 * inside the portfolio and is never counted twice.
 */
export function ppfCashLegId(entryId: string) {
  return `ppf:${entryId}:cash`;
}

type FundedPpfEntry = Extract<PpfLedgerEntry, { type: "contribution" | "withdrawal" }>;

export function isCashFundedPpfEntry(entry: PpfLedgerEntry): entry is FundedPpfEntry {
  return (entry.type === "contribution" || entry.type === "withdrawal") && entry.fundingSource === "cash";
}

/** The Cash leg a Cash-funded PPF entry owns: a deposit takes Cash out, a withdrawal brings it back. */
export function ppfCashLeg(entry: FundedPpfEntry, accountName: string): CashEntry {
  const deposit = entry.type === "contribution";
  return {
    amount: entry.amount,
    date: entry.date,
    id: ppfCashLegId(entry.id),
    label: deposit ? `To PPF · ${accountName}` : `From PPF · ${accountName}`,
    linkedPpf: { accountId: entry.accountId, entryId: entry.id },
    purpose: "ppfTransfer",
    type: deposit ? "withdrawal" : "addition",
  };
}

/** Problems with PPF Cash links; empty when every leg matches exactly one Cash-funded entry. */
export function ppfCashLinkProblems(entries: readonly PpfLedgerEntry[], cashEntries: readonly CashEntry[]): string[] {
  const problems: string[] = [];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const legsByEntry = new Map<string, CashEntry[]>();
  for (const cash of cashEntries) {
    if (cash.purpose !== "ppfTransfer" && !cash.linkedPpf) continue;
    if (cash.purpose !== "ppfTransfer" || !cash.linkedPpf) {
      problems.push(`${cash.id}: PPF Cash leg needs both its purpose and its link`);
      continue;
    }
    if (cash.linkedTradeId || cash.linkedFutures || cash.linkedEpf || cash.linkedDistributionId) {
      problems.push(`${cash.id}: PPF Cash leg has another link`);
    }
    const entry = byId.get(cash.linkedPpf.entryId);
    if (!entry || !isCashFundedPpfEntry(entry) || entry.accountId !== cash.linkedPpf.accountId) {
      problems.push(`${cash.id}: PPF Cash leg has no matching Cash-funded entry`);
      continue;
    }
    if (cash.type !== (entry.type === "contribution" ? "withdrawal" : "addition") ||
      cash.date !== entry.date || !decimal(cash.amount).equals(entry.amount)) {
      problems.push(`${cash.id}: PPF Cash leg differs from its entry`);
    }
    legsByEntry.set(entry.id, [...(legsByEntry.get(entry.id) ?? []), cash]);
  }
  for (const entry of entries) {
    if (isCashFundedPpfEntry(entry) && (legsByEntry.get(entry.id)?.length ?? 0) !== 1) {
      problems.push(`${entry.id}: Cash-funded PPF entry needs exactly one Cash leg`);
    }
  }
  return problems;
}

export function validatePpfCashLinks(entries: readonly PpfLedgerEntry[], cashEntries: readonly CashEntry[]) {
  const problems = ppfCashLinkProblems(entries, cashEntries);
  if (problems.length) throw new Error(`PPF Cash links are invalid: ${problems[0]}`);
}

/**
 * Cash entries after replacing one PPF entry (or removing it, when `next` is
 * null): its old leg goes and a new one is added when the entry is Cash-funded.
 */
export function cashEntriesWithPpfLeg(cashEntries: readonly CashEntry[], previousId: string | null,
  next: PpfLedgerEntry | null, accountName: string): CashEntry[] {
  const kept = previousId === null ? [...cashEntries]
    : cashEntries.filter((cash) => cash.linkedPpf?.entryId !== previousId);
  return next && isCashFundedPpfEntry(next) ? [...kept, ppfCashLeg(next, accountName)] : kept;
}
