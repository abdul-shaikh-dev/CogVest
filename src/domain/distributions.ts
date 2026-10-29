import { getCalendarDatePart, parseCalendarDate } from "./dates";
import { decimal, isWithinQuantum, moneyQuantum, normalizeMoney } from "./precision";
import type { Asset, CashEntry, Distribution, DistributionCoverage, Trade } from "@/src/types";

/** Contract: docs/design/xirr-evidence-contract.md (D1-D3, D12). */

export class DistributionValidationError extends Error {}

/** What actually reached the investor: gross less tax withheld at source. */
export function distributionNetAmount(distribution: Pick<Distribution, "grossAmount" | "taxWithheld">) {
  return normalizeMoney(decimal(distribution.grossAmount).minus(distribution.taxWithheld));
}

function isCalendarDate(value: string) {
  return value.length === 10 && Boolean(parseCalendarDate(value));
}

export type DistributionGraph = {
  assets: readonly Asset[];
  cashEntries: readonly CashEntry[];
  trades: readonly Trade[];
  distributions: readonly Distribution[];
  distributionCoverage: readonly DistributionCoverage[];
};

/** Lists every inconsistency between payouts, their Cash or buy links and coverage. */
export function distributionGraphProblems(graph: DistributionGraph): string[] {
  const problems: string[] = [];
  const assets = new Map(graph.assets.map((asset) => [asset.id, asset]));
  const cash = new Map(graph.cashEntries.map((entry) => [entry.id, entry]));
  const trades = new Map(graph.trades.map((trade) => [trade.id, trade]));
  const ids = new Set<string>();
  const linkedCash = new Set<string>();

  for (const item of graph.distributions) {
    const label = `payout ${item.id}`;
    if (!item.id || ids.has(item.id)) problems.push(`${label}: id is missing or repeated`);
    ids.add(item.id);
    const asset = assets.get(item.assetId);
    if (!asset) problems.push(`${label}: asset not found`);
    else if (asset.currency !== "INR" || asset.assetClass === "cash") problems.push(`${label}: asset must be an INR investment`);
    if (!isCalendarDate(item.paidOn)) problems.push(`${label}: payment date is invalid`);
    if (!item.recordedAt) problems.push(`${label}: recorded time is missing`);
    const amountsValid = Number.isFinite(item.grossAmount) && item.grossAmount > 0
      && Number.isFinite(item.taxWithheld) && item.taxWithheld >= 0 && item.taxWithheld < item.grossAmount;
    if (!amountsValid) problems.push(`${label}: amounts are invalid`);

    if (item.treatment === "paidToCash") {
      const entry = cash.get(item.linkedCashEntryId ?? "");
      if (item.linkedTradeId) problems.push(`${label}: a payout to Cash cannot link a buy`);
      if (!entry) problems.push(`${label}: linked Cash entry not found`);
      else {
        linkedCash.add(entry.id);
        if (entry.purpose !== "distribution" || entry.type !== "addition" || entry.linkedDistributionId !== item.id
          || entry.linkedTradeId || entry.linkedFutures || entry.linkedEpf) {
          problems.push(`${label}: linked Cash entry is not this payout's addition`);
        }
        if (getCalendarDatePart(entry.date) !== item.paidOn) problems.push(`${label}: Cash date differs from the payment date`);
        if (amountsValid && !isWithinQuantum(entry.amount, distributionNetAmount(item), moneyQuantum)) {
          problems.push(`${label}: Cash amount differs from the net payout`);
        }
      }
    } else if (item.treatment === "reinvested") {
      const trade = trades.get(item.linkedTradeId ?? "");
      if (item.linkedCashEntryId) problems.push(`${label}: a reinvested payout cannot link Cash`);
      if (!trade || trade.type !== "buy" || trade.assetId !== item.assetId) problems.push(`${label}: reinvested payout needs a buy of the same asset`);
      else if ((getCalendarDatePart(trade.date) ?? "") < item.paidOn) problems.push(`${label}: reinvestment is dated before the payout`);
    } else if (item.treatment === "paidOutside") {
      if (item.linkedCashEntryId || item.linkedTradeId) problems.push(`${label}: a payout outside the portfolio has no links`);
    } else problems.push(`${label}: treatment is invalid`);
  }

  for (const entry of graph.cashEntries) {
    if ((entry.purpose === "distribution" || entry.linkedDistributionId) && !linkedCash.has(entry.id)) {
      problems.push(`Cash entry ${entry.id}: payout link is orphaned`);
    }
  }

  const covered = new Set<string>();
  for (const coverage of graph.distributionCoverage) {
    const label = `payout coverage for ${coverage.assetId}`;
    if (covered.has(coverage.assetId)) problems.push(`${label}: repeated`);
    covered.add(coverage.assetId);
    if (!assets.has(coverage.assetId)) problems.push(`${label}: asset not found`);
    if (!isCalendarDate(coverage.from)) problems.push(`${label}: start date is invalid`);
    if (!coverage.confirmedAt) problems.push(`${label}: confirmation time is missing`);
  }
  return problems;
}

export function validateDistributionGraph(graph: DistributionGraph) {
  const problems = distributionGraphProblems(graph);
  if (problems.length) throw new DistributionValidationError(problems[0]);
}

export type DistributionInput = {
  assetId: string;
  grossAmount: number;
  id: string;
  linkedTradeId?: string;
  notes?: string;
  paidOn: string;
  taxWithheld: number;
  treatment: Distribution["treatment"];
};

export type DistributionPlan =
  | { status: "planned"; distributions: Distribution[]; cashEntries: CashEntry[]; distribution?: Distribution }
  | { status: "rejected"; reason: "notFound" | "invalidEntry" };

/**
 * Plans creating, correcting (same id) or deleting (input null) one payout.
 * A payout to Cash owns exactly one Cash addition for the net amount, which is
 * created, updated or removed with it. Other records are never changed.
 */
export function planDistributionChange({
  assets, cashEntries, trades, distributions, distributionCoverage, id, input, recordedAt, today,
}: DistributionGraph & { id: string; input: DistributionInput | null; recordedAt: string; today: string }): DistributionPlan {
  const existing = distributions.find((item) => item.id === id);
  if (!input && !existing) return { status: "rejected", reason: "notFound" };
  const cashId = existing?.linkedCashEntryId ?? `${id}:cash`;
  const withoutCash = cashEntries.filter((entry) => entry.id !== existing?.linkedCashEntryId);
  const others = distributions.filter((item) => item.id !== id);
  if (!input) return { status: "planned", distributions: others, cashEntries: withoutCash };

  if (input.id !== id || !isCalendarDate(input.paidOn) || input.paidOn > today) return { status: "rejected", reason: "invalidEntry" };
  const asset = assets.find((item) => item.id === input.assetId);
  if (existing && existing.assetId !== input.assetId) return { status: "rejected", reason: "invalidEntry" };
  const distribution: Distribution = {
    assetId: input.assetId,
    grossAmount: normalizeMoney(input.grossAmount),
    id,
    ...(input.treatment === "paidToCash" ? { linkedCashEntryId: cashId } : {}),
    ...(input.treatment === "reinvested" && input.linkedTradeId ? { linkedTradeId: input.linkedTradeId } : {}),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    paidOn: input.paidOn,
    recordedAt: existing?.recordedAt ?? recordedAt,
    taxWithheld: normalizeMoney(input.taxWithheld),
    treatment: input.treatment,
  };
  const nextCash = input.treatment === "paidToCash" && asset
    ? [...withoutCash, {
      amount: Number.isFinite(input.grossAmount) && Number.isFinite(input.taxWithheld) ? distributionNetAmount(distribution) : NaN,
      date: input.paidOn,
      id: cashId,
      label: `Payout from ${asset.name}`,
      linkedDistributionId: id,
      purpose: "distribution" as const,
      type: "addition" as const,
    }]
    : withoutCash;
  const nextDistributions = [...others, distribution];
  if (distributionGraphProblems({ assets, cashEntries: nextCash, trades, distributions: nextDistributions, distributionCoverage }).length) {
    return { status: "rejected", reason: "invalidEntry" };
  }
  return { status: "planned", distributions: nextDistributions, cashEntries: nextCash, distribution };
}
