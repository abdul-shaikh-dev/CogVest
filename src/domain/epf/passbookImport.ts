import { decimal } from "@/src/domain/precision";

import { calculateEpfLedger } from "./calculations";
import type { EpfAccount, EpfBalance, EpfEvent } from "./model";
import type { EpfoPassbook, PassbookColumns, PassbookRow } from "./passbook";

/**
 * Turns read passbooks into EPF records (#740): one financial-year summary per
 * year, a claim transfer when a claim's credits are on another imported
 * passbook, a settlement with an unknown destination when they are not, and an
 * external transfer-in for credits from a member ID that was not imported.
 *
 * Member IDs are used only here, in memory, to chain years and pair credits.
 * Records are keyed by the account the user chose, never by member ID.
 */

export type PassbookImportAccount = { memberId: string; id: string; nickname: string };

export type PassbookYearOutcome = {
  accountId: string;
  /** Financial year start, e.g. 2021 for FY 2021-22. */
  year: number;
  status: "imported" | "inProgress" | "blocked";
  message?: string;
};

export type PassbookImportPlan = {
  accounts: EpfAccount[];
  events: EpfEvent[];
  years: PassbookYearOutcome[];
  warnings: string[];
  /** Pension (EPS) contributions left out, by account: CogVest does not value EPS. */
  excludedPension: Array<{ accountId: string; amount: number }>;
};

export type PassbookImportResult = { ok: true; plan: PassbookImportPlan } | { ok: false; errors: string[] };

const EVIDENCE = "EPFO passbook";
const epf = (columns: PassbookColumns): EpfBalance => ({
  total: decimal(columns.employee).plus(columns.employer).toNumber(),
  components: { employee: columns.employee, employer: columns.employer },
});
const sameColumns = (a: PassbookColumns, b: PassbookColumns) =>
  a.employee === b.employee && a.employer === b.employer && a.pension === b.pension;
const dayAfter = (date: string) => {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
};
const fy = (passbook: EpfoPassbook) => Number(passbook.yearStart.slice(0, 4));
const sumEpf = (rows: readonly PassbookRow[]) => rows.reduce(
  (total, row) => ({ employee: total.employee + row.amounts.employee, employer: total.employer + row.amounts.employer, pension: 0 }),
  { employee: 0, employer: 0, pension: 0 });

export const passbookEventId = (accountId: string, year: number, role: string) => `epf-import-${accountId}-fy${year}-${role}`;

export function planPassbookImport(
  passbooks: readonly EpfoPassbook[],
  assignment: readonly PassbookImportAccount[],
  context: { now: Date; today: string },
): PassbookImportResult {
  const recordedAt = context.now.toISOString();
  const errors: string[] = [];
  const accountFor = new Map(assignment.map((item) => [item.memberId, item]));
  const years: PassbookYearOutcome[] = [];
  const warnings: string[] = [];
  const events: EpfEvent[] = [];
  const accounts: EpfAccount[] = [];
  const excludedPension: PassbookImportPlan["excludedPension"] = [];

  // Group by member ID, one passbook per year.
  const byMember = new Map<string, EpfoPassbook[]>();
  for (const passbook of passbooks) {
    if (!accountFor.has(passbook.memberId)) {
      errors.push("Choose an EPF account for every passbook before importing.");
      continue;
    }
    const list = byMember.get(passbook.memberId) ?? [];
    const same = list.find((item) => item.yearStart === passbook.yearStart);
    if (same && JSON.stringify(same) !== JSON.stringify({ ...passbook, printedOn: same.printedOn, open: same.open })) {
      errors.push(`Two different passbooks were chosen for ${accountFor.get(passbook.memberId)!.nickname}, FY ${fy(passbook)}-${(fy(passbook) + 1) % 100}. Keep only one.`);
    } else if (!same) list.push(passbook);
    byMember.set(passbook.memberId, list);
  }
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };

  type Claim = { accountId: string; year: number; row: PassbookRow; interest: PassbookColumns; memberId: string };
  type Credit = { accountId: string; year: number; row: PassbookRow };
  const claims: Claim[] = [];
  const credits: Credit[] = [];

  for (const list of byMember.values()) list.sort((a, b) => a.yearStart.localeCompare(b.yearStart));
  // Oldest account first, so the plan reads the same whatever order files were picked in.
  const members = [...byMember].sort(([, a], [, b]) => a[0].yearStart.localeCompare(b[0].yearStart));
  for (const [memberId, list] of members) {
    const { id: accountId, nickname } = accountFor.get(memberId)!;
    const first = list[0];
    const openingTotal = first.opening.amounts.employee + first.opening.amounts.employer;
    accounts.push({
      id: accountId, nickname, provider: "epfo", status: "active", currency: "INR",
      checkpoint: { date: first.opening.date, balance: epf(first.opening.amounts),
        // A zero opening balance means no money was put in before it (#567).
        capital: openingTotal === 0 ? 0 : null, source: "epfoStatement", recordedAt },
      historyCompleteThrough: null,
    });
    let pension = 0;
    let blockedFrom: string | null = null;
    for (const [index, passbook] of list.entries()) {
      const year = fy(passbook);
      const block = (message: string) => {
        years.push({ accountId, year, status: "blocked", message });
        blockedFrom ??= `Not imported: an earlier year for ${nickname} was blocked.`;
      };
      if (blockedFrom) { block(blockedFrom); continue; }
      const previous = list[index - 1];
      if (previous && passbook.yearStart !== dayAfter(previous.yearEnd)) {
        block(`FY ${year}-${(year + 1) % 100} doesn't follow the previous passbook for ${nickname}: a year is missing.`);
        continue;
      }
      if (previous && !sameColumns(previous.closing.amounts, passbook.opening.amounts)) {
        block(`FY ${year}-${(year + 1) % 100} opens with a different balance than the previous year closed with.`);
        continue;
      }
      if (previous?.open) {
        block(`FY ${year}-${(year + 1) % 100} follows a year that was still open when its passbook was printed. Download that year again.`);
        continue;
      }
      pension += passbook.totals.contributions.pension;
      const yearClaims = passbook.rows.filter((row) => row.kind === "claim");
      const closingEpf = passbook.closing.amounts.employee + passbook.closing.amounts.employer;
      if (yearClaims.length > 1 || (yearClaims.length === 1 && closingEpf !== 0)) {
        block("This year has a partial withdrawal, which CogVest can't import yet. Record it by hand.");
        continue;
      }
      const claim = yearClaims[0];
      const contributionRows = passbook.rows.filter((row) => row.kind === "contribution");
      const contributions = passbook.totals.contributions;
      const interest = claim ? { employee: 0, employer: 0, pension: 0 } : passbook.interest.amounts;
      const hasFlows = contributions.employee + contributions.employer + interest.employee + interest.employer > 0;
      const periodEnd = claim ? claim.date
        : passbook.open ? contributionRows.at(-1)?.date ?? null : passbook.yearEnd;
      if (passbook.open && claim) {
        block("This year is still open and has a claim. Import it after the year's passbook closes.");
        continue;
      }
      if (claim) {
        // A credit on the new account often comes before the claim, so the
        // year's few contributions count on their own dates, not at the claim.
        for (const [position, row] of contributionRows.entries()) {
          for (const party of ["employee", "employer"] as const) {
            if (row.amounts[party] === 0) continue;
            events.push({ id: passbookEventId(accountId, year, `c${position + 1}-${party}`), type: "contribution", accountId,
              recordedAt, evidence: EVIDENCE, effectiveDate: row.date, postedDate: row.date, party, amount: row.amounts[party],
              wageMonth: row.wageMonth });
          }
        }
      } else if (hasFlows && periodEnd) {
        events.push({ id: passbookEventId(accountId, year, "summary"), type: "yearSummary", accountId, recordedAt,
          evidence: EVIDENCE, periodStart: passbook.yearStart, effectiveDate: periodEnd, postedDate: periodEnd,
          contributions: { employee: contributions.employee, employer: contributions.employer },
          interest: { employee: interest.employee, employer: interest.employer },
          closing: claim || passbook.open ? null : { employee: passbook.closing.amounts.employee, employer: passbook.closing.amounts.employer } });
      }
      years.push({ accountId, year, status: passbook.open ? "inProgress" : "imported" });
      if (passbook.open) {
        warnings.push(`${nickname}: FY ${year}-${(year + 1) % 100} is still in progress. It counts contributions to ${periodEnd ?? "its start"}, without this year's interest. Import it again after 31 Mar.`);
      }
      for (const row of passbook.rows) {
        if (row.kind === "transferIn" || row.kind === "transferInterest") credits.push({ accountId, year, row });
      }
      if (claim) {
        claims.push({ accountId, year, row: claim, interest: passbook.interest.amounts, memberId });
        blockedFrom = `Not imported: ${nickname} was closed by its final claim, so later years can't follow it.`;
      }
    }
    if (pension > 0) excludedPension.push({ accountId, amount: pension });
  }

  // Pair each claim with the credits that cite its member ID.
  const used = new Set<PassbookRow>();
  for (const claim of claims) {
    const citing = credits.filter((credit) => credit.row.oldMemberId === claim.memberId)
      .sort((a, b) => a.row.date.localeCompare(b.row.date));
    const destinations = new Set(citing.map((credit) => credit.accountId));
    const payout = epf(claim.row.amounts);
    const interest = epf(claim.interest);
    const nickname = accountFor.get(claim.memberId)!.nickname;
    if (destinations.size > 1) {
      errors.push(`${nickname}'s claim is cited by more than one account's transfer-ins, so it can't be paired.`);
      continue;
    }
    if (citing.length === 0) {
      events.push({ id: passbookEventId(claim.accountId, claim.year, "settlement"), type: "withdrawal", accountId: claim.accountId,
        recordedAt, evidence: EVIDENCE, effectiveDate: claim.row.date, postedDate: claim.row.date, amount: payout,
        capitalReduction: null, destination: "unknown", settlement: { interest } });
      warnings.push(`${nickname}: the final claim isn't matched by a transfer-in on another imported passbook, so where it went stays unknown. Import the new account's passbook to record the move.`);
      continue;
    }
    const credited = sumEpf(citing.map((credit) => credit.row));
    if (credited.employee > payout.components!.employee || credited.employer > payout.components!.employer) {
      errors.push(`The transfer-ins citing ${nickname} add up to more than its claim.`);
      continue;
    }
    for (const credit of citing) used.add(credit.row);
    const complete = credited.employee === payout.components!.employee && credited.employer === payout.components!.employer;
    events.push({ id: passbookEventId(claim.accountId, claim.year, "claim"), type: "claimTransfer", recordedAt, evidence: EVIDENCE,
      effectiveDate: claim.row.date, postedDate: claim.row.date, sourceId: claim.accountId, destinationId: [...destinations][0],
      payout, interest, status: complete ? "completed" : "inTransit",
      credits: citing.map((credit) => ({ date: credit.row.date, postedDate: credit.row.date, amount: epf(credit.row.amounts) })) });
    const account = accounts.find((item) => item.id === claim.accountId);
    if (account) account.status = "transferred";
    if (!complete) warnings.push(`${nickname}: part of the claim hasn't reached the new account yet. It's counted as moving until a later passbook shows it.`);
  }

  // Credits from a member ID that wasn't imported come from an untracked account.
  const importedIds = new Set(byMember.keys());
  for (const credit of credits) {
    if (used.has(credit.row)) continue;
    const nickname = accounts.find((item) => item.id === credit.accountId)?.nickname ?? credit.accountId;
    if (credit.row.oldMemberId && importedIds.has(credit.row.oldMemberId)) {
      errors.push(`${nickname} received a transfer from an imported account whose claim year wasn't imported. Add that year's passbook too.`);
      continue;
    }
    const role = `in-${credit.row.date}-${credit.row.kind}`;
    events.push({ id: passbookEventId(credit.accountId, credit.year, role), type: "externalTransferIn", accountId: credit.accountId,
      recordedAt, evidence: EVIDENCE, effectiveDate: credit.row.date, postedDate: credit.row.date,
      amount: epf(credit.row.amounts), capital: null });
    warnings.push(`${nickname}: a transfer-in on ${credit.row.date} comes from an EPF account that wasn't imported. Its history and capital stay unknown.`);
  }
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };

  const replay = calculateEpfLedger({ accounts, events }, context.today, context.today);
  if (!replay.ok) return { ok: false, errors: replay.errors };
  return { ok: true, plan: { accounts, events, years, warnings, excludedPension } };
}
