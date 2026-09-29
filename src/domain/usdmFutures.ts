import { decimal, type FinancialDecimalInstance } from "@/src/domain/precision";
import type { CashEntry } from "@/src/types";

type NativeAmount = string;

export type UsdmFuturesExecution = {
  type: "execution";
  id: string;
  at: string;
  contract: string;
  side: "buy" | "sell";
  quantity: NativeAmount;
  price: NativeAmount;
  feeUsdt: NativeAmount;
  leverage?: NativeAmount;
};

export type UsdmFuturesWalletEvent = {
  type: "funding";
  id: string;
  at: string;
  amountUsdt: NativeAmount;
  contract: string;
} | {
  type: "transfer";
  id: string;
  at: string;
  amountUsdt: NativeAmount;
  transferBoundary: "internal" | "external";
  linkedCashEntryId?: string;
  cashDate?: string;
  conversionFeeInr?: NativeAmount;
};

export type UsdmFuturesEvent = UsdmFuturesExecution | UsdmFuturesWalletEvent;

export type UsdmFuturesAccount = {
  id: string;
  settlementAsset: "USDT";
  marginMode: "cross";
  positionMode: "one-way";
  openingAt: string;
  openingWalletUsdt: NativeAmount;
  openingRate?: UsdmInrRate;
  events: UsdmFuturesEvent[];
  eventRates?: UsdmEventRate[];
  valuation?: UsdmValuationEvidence;
};

export type UsdmMark = {
  contract: string;
  priceUsdt: NativeAmount;
  reportedMarginUsdt?: NativeAmount;
  observedAt: string;
  source: string;
};

export type UsdmInrRate = {
  inrPerUsdt: NativeAmount;
  observedAt: string;
  source: string;
};

export type UsdmEventRate = UsdmInrRate & { eventId: string };

export type UsdmValuationEvidence = {
  asOf: string;
  marks: UsdmMark[];
  inrRate: UsdmInrRate;
  reconciliation: UsdmWalletReconciliation;
};

export type UsdmWalletReconciliation = {
  observedWalletUsdt: NativeAmount;
  observedAt: string;
  source: string;
  allOpenPositionsConfirmed: boolean;
  allWalletEventsConfirmed: boolean;
  portfolioBoundaryConfirmed?: boolean;
};

export type UsdmClosedCycle = {
  contract: string;
  openingExecutionId: string;
  closingExecutionId: string;
  openedAt: string;
  closedAt: string;
  side: "long" | "short";
  realizedPnlUsdt: string;
  feesUsdt: string;
  beforeWalletCutover: boolean;
};

export type UsdmPosition = {
  contract: string;
  signedQuantity: string;
  entryPriceUsdt: string;
  realizedPnlUsdt: string;
  unrealizedPnlUsdt: string | null;
  notionalUsdt: string | null;
  reportedMarginUsdt: string | null;
  markSource: string | null;
  markObservedAt: string | null;
  leverage: string | null;
};

export type UsdmReplay = {
  walletUsdt: string;
  realizedPnlUsdt: string;
  historicalRealizedPnlUsdt: string;
  historicalWalletActivityUsdt: string;
  historicalRealizedPnlInr: string | null;
  historicalFeesInr: string | null;
  historicalEventRateStatus: "complete" | "missing" | "stale";
  realizedPnlInr: string | null;
  feesInr: string | null;
  fundingInr: string | null;
  externalTransfersInr: string | null;
  eventRateStatus: "complete" | "missing" | "stale";
  feesUsdt: string;
  fundingUsdt: string;
  internalTransfersUsdt: string;
  externalTransfersUsdt: string;
  positions: UsdmPosition[];
  closedCycles: UsdmClosedCycle[];
  equityUsdt: string | null;
  equityInr: string | null;
  valuationStatus: "ready" | "missing-mark" | "stale-mark" | "missing-rate" | "stale-rate" | "unreconciled" | "stale-wallet" | "wallet-mismatch";
};

export type UsdmPortfolioContribution = {
  status: "ready" | "pending";
  reason: string;
  equityInr: string | null;
  investedInr: string | null;
  pnlInr: string | null;
  tradingPnlInr: string | null;
  fxPnlInr: string | null;
};

type RunningPosition = {
  quantity: FinancialDecimalInstance;
  entry: FinancialDecimalInstance;
  realized: FinancialDecimalInstance;
  cycleOpenedAt: string | null;
  cycleOpeningId: string | null;
  cycleSide: "long" | "short" | null;
  cycleRealized: FinancialDecimalInstance;
  cycleFees: FinancialDecimalInstance;
  leverage: FinancialDecimalInstance | null;
};

function native(value: string, label: string, allowNegative = false) {
  if (value.length > 64 || !/^-?\d+(?:\.\d{1,8})?$/.test(value) || (!allowNegative && value.startsWith("-"))) {
    throw new Error(`${label} must be a decimal string with at most 8 places.`);
  }
  return decimal(value);
}

function positive(value: string, label: string) {
  const result = native(value, label);
  if (!result.greaterThan(0)) throw new Error(`${label} must be positive.`);
  return result;
}

function timestamp(value: string, label: string) {
  const parsed = Date.parse(value);
  const parts = /^(\d{4})-(\d\d)-(\d\d)T/.exec(value);
  const localDate = parts && new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])));
  if (!parts || !localDate || localDate.getUTCFullYear() !== Number(parts[1]) ||
      localDate.getUTCMonth() + 1 !== Number(parts[2]) || localDate.getUTCDate() !== Number(parts[3]) ||
      !/(Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(parsed)) {
    throw new Error(`${label} must be an ISO timestamp with timezone.`);
  }
  return parsed;
}

function contract(value: string) {
  if (!/^[A-Z0-9]+USDT$/.test(value)) {
    throw new Error("Only USDT-settled linear perpetual contracts are supported.");
  }
}

function canonical(value: FinancialDecimalInstance) {
  return value.toFixed();
}

export function replayUsdmFutures(
  account: UsdmFuturesAccount,
  options: {
    asOf: string;
    marks: UsdmMark[];
    inrRate?: UsdmInrRate;
    reconciliation?: UsdmWalletReconciliation;
    maxRateAgeMs?: number;
    maxMarkAgeMs?: number;
    eventRates?: UsdmEventRate[];
  },
): UsdmReplay {
  if (!account.id.trim()) throw new Error("Futures account ID is required.");
  if (account.settlementAsset !== "USDT" || account.marginMode !== "cross" || account.positionMode !== "one-way") {
    throw new Error("Only cross-margin, one-way USDT futures are supported.");
  }
  const openingAt = timestamp(account.openingAt, "Opening time");
  const asOf = timestamp(options.asOf, "Valuation time");
  if (openingAt > asOf) throw new Error("Opening time cannot follow valuation time.");
  let wallet = native(account.openingWalletUsdt, "Opening wallet", true);
  let realized = decimal(0);
  let historicalRealized = decimal(0);
  let historicalWalletActivity = decimal(0);
  let fees = decimal(0);
  let funding = decimal(0);
  let internalTransfers = decimal(0);
  let externalTransfers = decimal(0);
  let realizedInr = decimal(0);
  let feesInr = decimal(0);
  let historicalRealizedInr = decimal(0);
  let historicalFeesInr = decimal(0);
  let fundingInr = decimal(0);
  let externalTransfersInr = decimal(0);
  let missingEventRate = false;
  let staleEventRate = false;
  let missingHistoricalRate = false;
  let staleHistoricalRate = false;
  const eventRates = new Map<string, UsdmEventRate>();
  for (const rate of options.eventRates ?? []) {
    if (!rate.eventId.trim() || eventRates.has(rate.eventId) || !rate.source.trim()) {
      throw new Error("Event INR rates need unique event IDs and a source.");
    }
    positive(rate.inrPerUsdt, "Event INR per USDT");
    timestamp(rate.observedAt, "Event INR rate time");
    eventRates.set(rate.eventId, rate);
  }
  const inrForEvent = (event: UsdmFuturesEvent, amount: FinancialDecimalInstance, historical = false) => {
    if (amount.isZero()) return decimal(0);
    const rate = eventRates.get(event.id);
    if (!rate) {
      if (historical) missingHistoricalRate = true;
      else missingEventRate = true;
      return decimal(0);
    }
    if (Math.abs(timestamp(rate.observedAt, "Event INR rate time") - timestamp(event.at, "Event time")) > 24 * 60 * 60 * 1000) {
      if (historical) staleHistoricalRate = true;
      else staleEventRate = true;
      return decimal(0);
    }
    return amount.times(rate.inrPerUsdt);
  };
  const positions = new Map<string, RunningPosition>();
  const closedCycles: UsdmClosedCycle[] = [];
  const ids = new Set<string>();

  const events = account.events.map((event, order) => {
    if (!event.id.trim() || ids.has(event.id)) throw new Error("Futures event IDs must be unique and nonempty.");
    ids.add(event.id);
    const at = timestamp(event.at, "Event time");
    if (at > asOf) throw new Error("Event follows the valuation time.");
    return { event, at, order };
  }).sort((a, b) => a.at - b.at || a.order - b.order);
  for (const eventId of eventRates.keys()) {
    if (!ids.has(eventId)) throw new Error("Event INR rate refers to an unknown event.");
  }

  const applyWalletDelta = (amount: FinancialDecimalInstance, beforeCutover: boolean) => {
    if (beforeCutover) historicalWalletActivity = historicalWalletActivity.plus(amount);
    else wallet = wallet.plus(amount);
  };
  for (const { event, at } of events) {
    const beforeCutover = at < openingAt;
    if (event.type === "funding") {
      contract(event.contract);
      const amount = native(event.amountUsdt, "Funding", true);
      if (!beforeCutover) funding = funding.plus(amount);
      if (!beforeCutover) fundingInr = fundingInr.plus(inrForEvent(event, amount));
      applyWalletDelta(amount, beforeCutover);
      continue;
    }
    if (event.type === "transfer") {
      if (event.transferBoundary !== "internal" && event.transferBoundary !== "external") {
        throw new Error("Transfer boundary is required.");
      }
      const amount = native(event.amountUsdt, "Transfer", true);
      applyWalletDelta(amount, beforeCutover);
      if (!beforeCutover && event.transferBoundary === "internal") internalTransfers = internalTransfers.plus(amount);
      if (!beforeCutover && event.transferBoundary === "external") externalTransfers = externalTransfers.plus(amount);
      if (!beforeCutover && event.transferBoundary === "external") externalTransfersInr = externalTransfersInr.plus(inrForEvent(event, amount));
      continue;
    }
    contract(event.contract);
    const quantity = positive(event.quantity, "Execution quantity");
    const price = positive(event.price, "Execution price");
    const fee = native(event.feeUsdt, "Execution fee");
    const leverage = event.leverage === undefined ? null : positive(event.leverage, "Leverage");
    if (leverage && (!leverage.isInteger() || leverage.greaterThan(125))) {
      throw new Error("Reported leverage must be an integer from 1 to 125.");
    }
    if (!beforeCutover) fees = fees.plus(fee);
    if (!beforeCutover) feesInr = feesInr.plus(inrForEvent(event, fee));
    else historicalFeesInr = historicalFeesInr.plus(inrForEvent(event, fee, true));
    applyWalletDelta(fee.negated(), beforeCutover);
    const signed = event.side === "buy" ? quantity : quantity.negated();
    const position = positions.get(event.contract) ?? {
      quantity: decimal(0), entry: decimal(0), realized: decimal(0),
      cycleOpenedAt: null, cycleOpeningId: null, cycleSide: null,
      cycleRealized: decimal(0), cycleFees: decimal(0),
      leverage: null,
    };
    const previous = position.quantity;
    const next = previous.plus(signed);
    if (!previous.isZero() && next.isZero() === false && previous.isPositive() !== next.isPositive()) {
      throw new Error("Reversal must be entered as a close followed by a new opening execution.");
    }
    if (previous.isZero()) {
      position.cycleOpenedAt = event.at;
      position.cycleOpeningId = event.id;
      position.cycleSide = signed.isPositive() ? "long" : "short";
      position.cycleRealized = decimal(0);
      position.cycleFees = decimal(0);
    }
    if (leverage) position.leverage = leverage;
    position.cycleFees = position.cycleFees.plus(fee);
    if (previous.isZero() || previous.isPositive() === signed.isPositive()) {
      position.entry = previous.abs().times(position.entry).plus(quantity.times(price)).dividedBy(next.abs());
    } else {
      const closing = quantity;
      const pnl = previous.isPositive()
        ? price.minus(position.entry).times(closing)
        : position.entry.minus(price).times(closing);
      position.realized = position.realized.plus(pnl);
      position.cycleRealized = position.cycleRealized.plus(pnl);
      if (beforeCutover) {
        historicalRealized = historicalRealized.plus(pnl);
        historicalRealizedInr = historicalRealizedInr.plus(inrForEvent(event, pnl, true));
      }
      else realized = realized.plus(pnl);
      if (!beforeCutover) realizedInr = realizedInr.plus(inrForEvent(event, pnl));
      applyWalletDelta(pnl, beforeCutover);
      if (next.isZero()) position.entry = decimal(0);
    }
    if (next.isZero()) {
      closedCycles.push({
        contract: event.contract,
        openingExecutionId: position.cycleOpeningId!,
        closingExecutionId: event.id,
        openedAt: position.cycleOpenedAt!,
        closedAt: event.at,
        side: position.cycleSide!,
        realizedPnlUsdt: canonical(position.cycleRealized),
        feesUsdt: canonical(position.cycleFees),
        beforeWalletCutover: beforeCutover,
      });
      position.cycleOpenedAt = null;
      position.cycleOpeningId = null;
      position.cycleSide = null;
    }
    position.quantity = next;
    positions.set(event.contract, position);
  }

  const marks = new Map<string, UsdmMark>();
  for (const mark of options.marks) {
    contract(mark.contract);
    positive(mark.priceUsdt, "Mark price");
    if (mark.reportedMarginUsdt !== undefined) native(mark.reportedMarginUsdt, "Reported position margin");
    const at = timestamp(mark.observedAt, "Mark time");
    if (at > asOf || !mark.source.trim() || marks.has(mark.contract)) throw new Error("Invalid or duplicate mark price.");
    marks.set(mark.contract, mark);
  }
  if (options.inrRate) {
    positive(options.inrRate.inrPerUsdt, "INR per USDT");
    const rateAt = timestamp(options.inrRate.observedAt, "INR rate time");
    if (!options.inrRate.source.trim() || rateAt > asOf) throw new Error("Invalid INR rate provenance.");
  }
  if (options.reconciliation) {
    native(options.reconciliation.observedWalletUsdt, "Observed wallet", true);
    const walletAt = timestamp(options.reconciliation.observedAt, "Wallet observation time");
    if (!options.reconciliation.source.trim() || walletAt > asOf) throw new Error("Invalid wallet provenance.");
  }
  let missingMark = false;
  let staleMark = false;
  let unrealizedTotal = decimal(0);
  const results: UsdmPosition[] = [...positions].map(([name, position]) => {
    const mark = position.quantity.isZero() ? undefined : marks.get(name);
    if (mark && asOf - Date.parse(mark.observedAt) > (options.maxMarkAgeMs ?? 24 * 60 * 60 * 1000)) staleMark = true;
    const unrealized = mark
      ? decimal(mark.priceUsdt).minus(position.entry).times(position.quantity)
      : null;
    if (!position.quantity.isZero() && !mark) missingMark = true;
    if (unrealized) unrealizedTotal = unrealizedTotal.plus(unrealized);
    return {
      contract: name,
      signedQuantity: canonical(position.quantity),
      entryPriceUsdt: canonical(position.entry),
      realizedPnlUsdt: canonical(position.realized),
      unrealizedPnlUsdt: unrealized === null ? null : canonical(unrealized),
      notionalUsdt: mark ? canonical(position.quantity.abs().times(mark.priceUsdt)) : null,
      reportedMarginUsdt: mark?.reportedMarginUsdt ?? null,
      markSource: mark?.source ?? null,
      markObservedAt: mark?.observedAt ?? null,
      leverage: position.leverage === null ? null : canonical(position.leverage),
    };
  });
  const equity = missingMark ? null : wallet.plus(unrealizedTotal);
  let status: UsdmReplay["valuationStatus"] = "ready";
  if (missingMark) status = "missing-mark";
  else if (staleMark) status = "stale-mark";
  else if (!options.reconciliation || !options.reconciliation.allOpenPositionsConfirmed || !options.reconciliation.allWalletEventsConfirmed ||
           !options.reconciliation.source.trim()) status = "unreconciled";
  else if (asOf - timestamp(options.reconciliation.observedAt, "Wallet observation time") > (options.maxRateAgeMs ?? 24 * 60 * 60 * 1000)) status = "stale-wallet";
  else if (wallet.minus(native(options.reconciliation.observedWalletUsdt, "Observed wallet", true)).abs().greaterThan("0.00000001")) status = "wallet-mismatch";
  else if (!options.inrRate) status = "missing-rate";
  else {
    const rateAt = timestamp(options.inrRate.observedAt, "INR rate time");
    if (asOf - rateAt > (options.maxRateAgeMs ?? 24 * 60 * 60 * 1000)) status = "stale-rate";
  }
  return {
    walletUsdt: canonical(wallet),
    realizedPnlUsdt: canonical(realized),
    historicalRealizedPnlUsdt: canonical(historicalRealized),
    historicalWalletActivityUsdt: canonical(historicalWalletActivity),
    historicalRealizedPnlInr: missingHistoricalRate || staleHistoricalRate ? null : historicalRealizedInr.toDecimalPlaces(2).toFixed(2),
    historicalFeesInr: missingHistoricalRate || staleHistoricalRate ? null : historicalFeesInr.toDecimalPlaces(2).toFixed(2),
    historicalEventRateStatus: staleHistoricalRate ? "stale" : missingHistoricalRate ? "missing" : "complete",
    realizedPnlInr: missingEventRate || staleEventRate ? null : realizedInr.toDecimalPlaces(2).toFixed(2),
    feesInr: missingEventRate || staleEventRate ? null : feesInr.toDecimalPlaces(2).toFixed(2),
    fundingInr: missingEventRate || staleEventRate ? null : fundingInr.toDecimalPlaces(2).toFixed(2),
    externalTransfersInr: missingEventRate || staleEventRate ? null : externalTransfersInr.toDecimalPlaces(2).toFixed(2),
    eventRateStatus: staleEventRate ? "stale" : missingEventRate ? "missing" : "complete",
    feesUsdt: canonical(fees),
    fundingUsdt: canonical(funding),
    internalTransfersUsdt: canonical(internalTransfers),
    externalTransfersUsdt: canonical(externalTransfers),
    positions: results,
    closedCycles,
    equityUsdt: equity === null ? null : canonical(equity),
    equityInr: status === "ready" && equity !== null && options.inrRate
      ? equity.times(options.inrRate.inrPerUsdt).toDecimalPlaces(2).toFixed(2)
      : null,
    valuationStatus: status,
  };
}

export function validateUsdmFuturesAccount(account: UsdmFuturesAccount): void {
  const latest = Math.max(
    Date.parse(account.openingAt),
    ...account.events.map((event) => Date.parse(event.at)),
  );
  replayUsdmFutures(account, {
    asOf: new Date(latest).toISOString(),
    marks: [],
    eventRates: account.eventRates,
  });
  if (account.openingRate) {
    positive(account.openingRate.inrPerUsdt, "Opening INR per USDT");
    if (!account.openingRate.source.trim() ||
        Math.abs(timestamp(account.openingRate.observedAt, "Opening rate time") - timestamp(account.openingAt, "Opening time")) > 24 * 60 * 60 * 1000) {
      throw new Error("Opening INR rate needs a source and a time within 24 hours of the wallet boundary.");
    }
  }
  if (account.valuation) {
    if (Date.parse(account.valuation.asOf) < latest) {
      throw new Error("Valuation evidence predates the latest account event.");
    }
    replayUsdmFutures(account, {
      asOf: account.valuation.asOf,
      marks: account.valuation.marks,
      inrRate: account.valuation.inrRate,
      reconciliation: account.valuation.reconciliation,
      eventRates: account.eventRates,
    });
  }
}

export function calculateUsdmPortfolioContribution(account: UsdmFuturesAccount, asOf: string, cashEntries: CashEntry[] = []): UsdmPortfolioContribution {
  const pending = (reason: string): UsdmPortfolioContribution => ({
    status: "pending", reason, equityInr: null, investedInr: null, pnlInr: null,
    tradingPnlInr: null, fxPnlInr: null,
  });
  if (!account.valuation) return pending("Current wallet, mark and INR evidence is missing.");
  if (decimal(account.openingWalletUsdt).isNegative()) {
    return pending("A negative starting wallet needs a verified capital basis before portfolio inclusion.");
  }
  if (timestamp(account.valuation.asOf, "Valuation time") > timestamp(asOf, "Portfolio time")) {
    return pending("Futures valuation is dated after the portfolio time.");
  }
  const replay = replayUsdmFutures(account, {
    asOf, marks: account.valuation.marks, inrRate: account.valuation.inrRate,
    reconciliation: account.valuation.reconciliation, eventRates: account.eventRates,
  });
  if (replay.valuationStatus !== "ready" || replay.equityInr === null) {
    return pending(`Futures valuation is ${replay.valuationStatus}.`);
  }
  if (!account.valuation.reconciliation.portfolioBoundaryConfirmed) {
    return pending("Confirm that this wallet is not already counted in Spot, Cash or another holding.");
  }
  const linkedTransfers = account.events.filter((event): event is Extract<UsdmFuturesEvent, { type: "transfer" }> => event.type === "transfer").filter((event) =>
    event.transferBoundary === "internal" && Date.parse(event.at) >= Date.parse(account.openingAt));
  if (linkedTransfers.some((event) => !event.linkedCashEntryId)) {
    return pending("Internal transfers need a linked Cash outflow or Spot movement before aggregation.");
  }
  const linkedCashBasis = linkedTransfers.reduce((total, event) => {
    const entry = cashEntries.find((item) => item.id === event.linkedCashEntryId &&
      item.linkedFutures?.accountId === account.id && item.linkedFutures.eventId === event.id);
    if (!entry) return total;
    return total.plus(entry.type === "withdrawal" ? entry.amount : -entry.amount);
  }, decimal(0));
  if (linkedTransfers.some((event) => !cashEntries.some((item) => item.id === event.linkedCashEntryId &&
    item.linkedFutures?.accountId === account.id && item.linkedFutures.eventId === event.id))) {
    return pending("Linked Cash movement is missing or mismatched.");
  }
  if (replay.eventRateStatus !== "complete" || replay.externalTransfersInr === null ||
      replay.realizedPnlInr === null || replay.fundingInr === null || replay.feesInr === null) {
    return pending("Event-date INR rates are required for complete contribution and P&L.");
  }
  if (!decimal(account.openingWalletUsdt).isZero() && !account.openingRate) {
    return pending("Starting wallet INR rate is missing.");
  }
  const basis = decimal(account.openingWalletUsdt).times(account.openingRate?.inrPerUsdt ?? "0")
    .plus(replay.externalTransfersInr).plus(linkedCashBasis);
  const pnl = decimal(replay.equityInr).minus(basis);
  const unrealized = replay.positions.reduce((sum, position) =>
    sum.plus(position.unrealizedPnlUsdt ?? "0"), decimal(0));
  const trading = decimal(replay.realizedPnlInr).plus(replay.fundingInr).minus(replay.feesInr)
    .plus(unrealized.times(account.valuation.inrRate.inrPerUsdt));
  return {
    status: "ready", reason: "Reconciled wallet equity; notional and margin excluded.",
    equityInr: decimal(replay.equityInr).toFixed(2),
    investedInr: basis.toDecimalPlaces(2).toFixed(2),
    pnlInr: pnl.toDecimalPlaces(2).toFixed(2),
    tradingPnlInr: trading.toDecimalPlaces(2).toFixed(2),
    fxPnlInr: pnl.minus(trading).toDecimalPlaces(2).toFixed(2),
  };
}
