import { getCalendarDatePart, parseCalendarDate } from "./dates";
import { decimal, sumFinancialValues } from "./precision";
import { distributionNetAmount } from "./distributions";
import { positionEvents, splitQuantity } from "./stockSplits";
import type { Asset, Distribution, DistributionCoverage, OpeningPosition, Quote, Trade } from "@/src/types";

/**
 * Per-asset and Investments XIRR inputs from existing records.
 * Contract: docs/design/xirr-evidence-contract.md (D1, D4-D8). Investor sign:
 * money in is negative, money out and the terminal value are positive.
 */

/** D7: the newest usable price may be at most this many calendar days before the end date. */
export const XIRR_MAX_QUOTE_AGE_DAYS = 7;

export type XirrFlowSource = "trade" | "distribution" | "terminal";
export type XirrFlow = { date: string; amountInr: string; source: XirrFlowSource; id: string };

export type XirrUnavailableReason =
  | "invalid-end-date" | "missing-asset" | "cash-asset" | "foreign-currency"
  | "distributions-not-recorded" | "payout-before-purchase" | "opening-history" | "transfer-without-value"
  | "demerger" | "split-needs-review" | "invalid-trade" | "duplicate-trade" | "no-purchases"
  | "units-mismatch" | "missing-quote" | "stale-quote" | "quote-after-end" | "quote-currency"
  | "ppf-not-supported" | "epf-not-supported" | "futures-not-supported" | "no-assets";

export type XirrLimitation = "fees-not-in-source" | "manual-price";

export type XirrAssetIssue = { assetId: string; reason: XirrUnavailableReason; recordId?: string };

export type XirrInputResult =
  | {
    status: "ready";
    /** Dated flows, oldest first; the terminal value, when held, is last. */
    flows: XirrFlow[];
    startDate: string;
    endDate: string;
    /** Earliest price date behind the terminal value, or null when nothing is still held. */
    valueAsOf: string | null;
    limitations: Array<{ assetId: string; limitation: XirrLimitation; recordId?: string }>;
    includedAssetIds: string[];
  }
  | { status: "unavailable"; reasons: XirrAssetIssue[] };

export type AssetXirrInput = {
  asset: Asset | undefined;
  assetId: string;
  assets: readonly Asset[];
  trades: readonly Trade[];
  openingPositions: readonly OpeningPosition[];
  quote: Quote | undefined;
  /** Payouts of every asset; only this asset's are used. */
  distributions: readonly Distribution[];
  coverage: DistributionCoverage | undefined;
  endDate: string;
};

/** D1: only classes that cannot pay distributions are eligible until distributions are recorded. */
function cannotDistribute(asset: Asset) {
  return asset.assetClass === "crypto";
}

function daysBetween(from: string, to: string) {
  const [a, b] = [from, to].map((value) => {
    const [y, m, d] = value.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86_400_000);
}

function isDemergerMember(asset: Asset, assets: readonly Asset[]) {
  return Boolean(asset.demerger) || assets.some((other) => other.demerger?.childAssetId === asset.id);
}

/** D4: manual totals include the fee; imported totals are gross with fees and taxes in provenance. */
function tradeFlow(trade: Trade & { type: "buy" | "sell" }) {
  const provenance = trade.importProvenance;
  const charges = provenance ? decimal(provenance.fees ?? 0).plus(provenance.taxes ?? 0) : decimal(0);
  const net = trade.type === "buy" ? decimal(trade.totalValue).plus(charges) : decimal(trade.totalValue).minus(charges);
  return trade.type === "buy" ? net.negated() : net;
}

type AssetOutcome =
  | { ok: true; flows: XirrFlow[]; terminal: XirrFlow | null; valueAsOf: string | null;
    limitations: Array<{ assetId: string; limitation: XirrLimitation; recordId?: string }> }
  | { ok: false; reasons: XirrAssetIssue[] };

function assetOutcome(input: AssetXirrInput): AssetOutcome {
  const { asset, assetId, endDate } = input;
  const reasons: XirrAssetIssue[] = [];
  const issue = (reason: XirrUnavailableReason, recordId?: string) =>
    reasons.push({ assetId, reason, ...(recordId ? { recordId } : {}) });

  if (!asset) {
    issue("missing-asset");
    return { ok: false, reasons };
  }
  if (asset.assetClass === "cash") issue("cash-asset");
  if (asset.currency !== "INR") issue("foreign-currency");
  if (isDemergerMember(asset, input.assets)) issue("demerger");
  input.openingPositions.filter((opening) => opening.assetId === assetId)
    .forEach((opening) => issue("opening-history", opening.id));

  const seen = new Map<string, number>();
  input.trades.forEach((trade) => seen.set(trade.id, (seen.get(trade.id) ?? 0) + 1));
  const trades = input.trades.filter((trade) => {
    if (trade.assetId !== assetId) return false;
    if ((seen.get(trade.id) ?? 0) > 1) {
      issue("duplicate-trade", trade.id);
      return false;
    }
    const date = getCalendarDatePart(trade.date);
    if (!date) {
      issue("invalid-trade", trade.id);
      return false;
    }
    return date <= endDate;
  });

  const flows: XirrFlow[] = [];
  const limitations: Array<{ assetId: string; limitation: XirrLimitation; recordId?: string }> = [];
  for (const trade of trades) {
    if (trade.type === "transferIn" || trade.type === "transferOut") {
      issue("transfer-without-value", trade.id);
      continue;
    }
    if (!Number.isFinite(trade.totalValue) || trade.totalValue <= 0
      || !Number.isFinite(trade.quantity) || trade.quantity <= 0) {
      issue("invalid-trade", trade.id);
      continue;
    }
    const provenance = trade.importProvenance;
    if (provenance && provenance.fees === undefined && provenance.taxes === undefined) {
      limitations.push({ assetId, limitation: "fees-not-in-source", recordId: trade.id });
    }
    flows.push({ date: getCalendarDatePart(trade.date)!, amountInr: tradeFlow(trade).toString(), source: "trade", id: trade.id });
  }
  if (!flows.some((flow) => decimal(flow.amountInr).isNegative())) issue("no-purchases");

  // D1-D3: every payout counts as money returned to the investor on its date,
  // whether paid to Cash, outside or reinvested (the reinvested buy stays a
  // separate purchase). Assets that can pay out need ongoing coverage from the
  // first purchase.
  const firstFlow = flows.map((flow) => flow.date).sort()[0];
  if (!cannotDistribute(asset) && (!input.coverage || !firstFlow || input.coverage.from > firstFlow)) {
    issue("distributions-not-recorded");
  }
  for (const payout of input.distributions) {
    if (payout.assetId !== assetId || payout.paidOn > endDate) continue;
    if (!firstFlow || payout.paidOn < firstFlow) issue("payout-before-purchase", payout.id);
    flows.push({ date: payout.paidOn, amountInr: distributionNetAmount(payout).toString(), source: "distribution", id: payout.id });
  }

  // A disposal must never exceed the units held at that point, not only at the end.
  let units = decimal(0);
  let oversold = false;
  try {
    for (const event of positionEvents({ trades, stockSplits: asset.stockSplits ?? [], through: endDate })) {
      if (event.type === "split") units = splitQuantity(units, event.split);
      else if (event.type === "trade") {
        const sign = event.trade.type === "buy" || event.trade.type === "transferIn" ? 1 : -1;
        units = units.plus(decimal(event.trade.quantity).times(sign));
        if (units.isNegative()) oversold = true;
      }
    }
  } catch {
    issue("split-needs-review");
  }
  if (oversold) issue("units-mismatch");

  let terminal: XirrFlow | null = null;
  let valueAsOf: string | null = null;
  if (units.greaterThan(0)) {
    const quote = input.quote;
    const quoteDate = quote ? getCalendarDatePart(quote.asOf) : null;
    if (!quote || !quoteDate || !Number.isFinite(quote.price) || quote.price <= 0) issue("missing-quote");
    else if (quote.currency !== "INR") issue("quote-currency");
    else if (quoteDate > endDate) issue("quote-after-end");
    else if (daysBetween(quoteDate, endDate) > XIRR_MAX_QUOTE_AGE_DAYS) issue("stale-quote");
    else {
      if (quote.source === "manual") limitations.push({ assetId, limitation: "manual-price" });
      terminal = { date: endDate, amountInr: units.times(quote.price).toString(), source: "terminal", id: assetId };
      valueAsOf = quoteDate;
    }
  }

  if (reasons.length) return { ok: false, reasons };
  return { ok: true, flows, terminal, valueAsOf, limitations };
}

function compareFlows(a: XirrFlow, b: XirrFlow) {
  if ((a.source === "terminal") !== (b.source === "terminal")) return a.source === "terminal" ? 1 : -1;
  return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
}

function validEndDate(endDate: string) {
  return endDate.length === 10 && Boolean(parseCalendarDate(endDate));
}

/** Per-asset XIRR input (D4-D7). Fully sold assets have no terminal value. */
export function buildAssetXirrInput(input: AssetXirrInput): XirrInputResult {
  if (!validEndDate(input.endDate)) {
    return { status: "unavailable", reasons: [{ assetId: input.assetId, reason: "invalid-end-date" }] };
  }
  const outcome = assetOutcome(input);
  if (!outcome.ok) return { status: "unavailable", reasons: outcome.reasons };
  const flows = [...outcome.flows, ...(outcome.terminal ? [outcome.terminal] : [])].sort(compareFlows);
  return {
    status: "ready",
    flows,
    startDate: flows[0].date,
    endDate: input.endDate,
    valueAsOf: outcome.valueAsOf,
    limitations: outcome.limitations,
    includedAssetIds: [input.assetId],
  };
}

export type InvestmentsXirrInput = {
  assets: readonly Asset[];
  trades: readonly Trade[];
  openingPositions: readonly OpeningPosition[];
  quotes: Readonly<Record<string, Quote>>;
  distributions: readonly Distribution[];
  distributionCoverage: readonly DistributionCoverage[];
  hasPpfAccounts: boolean;
  hasEpfAccounts: boolean;
  hasFuturesAccounts: boolean;
  endDate: string;
};

/**
 * Investments XIRR input (D8): every market asset with history, Cash excluded.
 * Buys and sells cross the boundary whether or not a Cash leg is linked.
 * PPF, EPF and Futures are inside the boundary but not yet supported here, so
 * their presence makes the result unavailable rather than silently partial.
 */
export function buildInvestmentsXirrInput(input: InvestmentsXirrInput): XirrInputResult {
  const portfolio = "portfolio";
  if (!validEndDate(input.endDate)) {
    return { status: "unavailable", reasons: [{ assetId: portfolio, reason: "invalid-end-date" }] };
  }
  const reasons: XirrAssetIssue[] = [];
  if (input.hasPpfAccounts) reasons.push({ assetId: portfolio, reason: "ppf-not-supported" });
  if (input.hasEpfAccounts) reasons.push({ assetId: portfolio, reason: "epf-not-supported" });
  if (input.hasFuturesAccounts) reasons.push({ assetId: portfolio, reason: "futures-not-supported" });

  // Assets whose only activity is after the end date are outside the period.
  const inPeriod = (trade: Trade) => {
    const date = getCalendarDatePart(trade.date);
    return !date || date <= input.endDate;
  };
  const assetIds = [...new Set([
    ...input.trades.filter(inPeriod).map((trade) => trade.assetId),
    ...input.openingPositions.map((opening) => opening.assetId),
  ])].sort();
  const assets = new Map(input.assets.map((asset) => [asset.id, asset]));
  const flows: XirrFlow[] = [];
  const terminals: XirrFlow[] = [];
  const limitations: Array<{ assetId: string; limitation: XirrLimitation; recordId?: string }> = [];
  const valueDates: string[] = [];
  for (const assetId of assetIds) {
    const outcome = assetOutcome({
      asset: assets.get(assetId), assetId, assets: input.assets, trades: input.trades,
      openingPositions: input.openingPositions, quote: input.quotes[assetId], endDate: input.endDate,
      distributions: input.distributions,
      coverage: input.distributionCoverage.find((item) => item.assetId === assetId),
    });
    if (!outcome.ok) {
      reasons.push(...outcome.reasons);
      continue;
    }
    flows.push(...outcome.flows);
    if (outcome.terminal) terminals.push(outcome.terminal);
    if (outcome.valueAsOf) valueDates.push(outcome.valueAsOf);
    limitations.push(...outcome.limitations);
  }
  if (!assetIds.length) reasons.push({ assetId: portfolio, reason: "no-assets" });
  if (reasons.length) return { status: "unavailable", reasons };

  flows.sort(compareFlows);
  const terminalValue = sumFinancialValues(terminals.map((flow) => flow.amountInr));
  const allFlows = terminalValue.greaterThan(0)
    ? [...flows, { date: input.endDate, amountInr: terminalValue.toString(), source: "terminal" as const, id: portfolio }]
    : flows;
  return {
    status: "ready",
    flows: allFlows,
    startDate: flows[0].date,
    endDate: input.endDate,
    valueAsOf: valueDates.length ? valueDates.sort()[0] : null,
    limitations,
    includedAssetIds: assetIds,
  };
}
