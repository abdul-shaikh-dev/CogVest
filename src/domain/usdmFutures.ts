import { decimal, type FinancialDecimalInstance } from "@/src/domain/precision";

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
};

export type UsdmFuturesEvent = UsdmFuturesExecution | UsdmFuturesWalletEvent;

export type UsdmFuturesAccount = {
  id: string;
  settlementAsset: "USDT";
  marginMode: "cross";
  positionMode: "one-way";
  openingAt: string;
  openingWalletUsdt: NativeAmount;
  events: UsdmFuturesEvent[];
};

export type UsdmMark = {
  contract: string;
  priceUsdt: NativeAmount;
  observedAt: string;
  source: string;
};

export type UsdmInrRate = {
  inrPerUsdt: NativeAmount;
  observedAt: string;
  source: string;
};

export type UsdmPosition = {
  contract: string;
  signedQuantity: string;
  entryPriceUsdt: string;
  realizedPnlUsdt: string;
  unrealizedPnlUsdt: string | null;
  notionalUsdt: string | null;
  markSource: string | null;
  markObservedAt: string | null;
};

export type UsdmReplay = {
  walletUsdt: string;
  realizedPnlUsdt: string;
  feesUsdt: string;
  fundingUsdt: string;
  internalTransfersUsdt: string;
  externalTransfersUsdt: string;
  positions: UsdmPosition[];
  equityUsdt: string | null;
  equityInr: string | null;
  valuationStatus: "ready" | "missing-mark" | "stale-mark" | "missing-rate" | "stale-rate" | "unreconciled";
};

type RunningPosition = {
  quantity: FinancialDecimalInstance;
  entry: FinancialDecimalInstance;
  realized: FinancialDecimalInstance;
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
    walletReconciled: boolean;
    maxRateAgeMs?: number;
    maxMarkAgeMs?: number;
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
  let fees = decimal(0);
  let funding = decimal(0);
  let internalTransfers = decimal(0);
  let externalTransfers = decimal(0);
  const positions = new Map<string, RunningPosition>();
  const ids = new Set<string>();

  const events = account.events.map((event, order) => {
    if (!event.id.trim() || ids.has(event.id)) throw new Error("Futures event IDs must be unique and nonempty.");
    ids.add(event.id);
    const at = timestamp(event.at, "Event time");
    if (at < openingAt || at > asOf) throw new Error("Event falls outside the wallet replay window.");
    return { event, at, order };
  }).sort((a, b) => a.at - b.at || a.order - b.order);

  for (const { event } of events) {
    if (event.type === "funding") {
      contract(event.contract);
      const amount = native(event.amountUsdt, "Funding", true);
      funding = funding.plus(amount);
      wallet = wallet.plus(amount);
      continue;
    }
    if (event.type === "transfer") {
      if (event.transferBoundary !== "internal" && event.transferBoundary !== "external") {
        throw new Error("Transfer boundary is required.");
      }
      const amount = native(event.amountUsdt, "Transfer", true);
      wallet = wallet.plus(amount);
      if (event.transferBoundary === "internal") internalTransfers = internalTransfers.plus(amount);
      else externalTransfers = externalTransfers.plus(amount);
      continue;
    }
    contract(event.contract);
    const quantity = positive(event.quantity, "Execution quantity");
    const price = positive(event.price, "Execution price");
    const fee = native(event.feeUsdt, "Execution fee");
    fees = fees.plus(fee);
    wallet = wallet.minus(fee);
    const signed = event.side === "buy" ? quantity : quantity.negated();
    const position = positions.get(event.contract) ?? {
      quantity: decimal(0), entry: decimal(0), realized: decimal(0),
    };
    const previous = position.quantity;
    const next = previous.plus(signed);
    if (!previous.isZero() && next.isZero() === false && previous.isPositive() !== next.isPositive()) {
      throw new Error("Reversal must be entered as a close followed by a new opening execution.");
    }
    if (previous.isZero() || previous.isPositive() === signed.isPositive()) {
      position.entry = previous.abs().times(position.entry).plus(quantity.times(price)).dividedBy(next.abs());
    } else {
      const closing = quantity;
      const pnl = previous.isPositive()
        ? price.minus(position.entry).times(closing)
        : position.entry.minus(price).times(closing);
      position.realized = position.realized.plus(pnl);
      realized = realized.plus(pnl);
      wallet = wallet.plus(pnl);
      if (next.isZero()) position.entry = decimal(0);
    }
    position.quantity = next;
    positions.set(event.contract, position);
  }

  const marks = new Map<string, UsdmMark>();
  for (const mark of options.marks) {
    contract(mark.contract);
    positive(mark.priceUsdt, "Mark price");
    const at = timestamp(mark.observedAt, "Mark time");
    if (at > asOf || !mark.source.trim() || marks.has(mark.contract)) throw new Error("Invalid or duplicate mark price.");
    marks.set(mark.contract, mark);
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
      markSource: mark?.source ?? null,
      markObservedAt: mark?.observedAt ?? null,
    };
  });
  const equity = missingMark ? null : wallet.plus(unrealizedTotal);
  let status: UsdmReplay["valuationStatus"] = "ready";
  if (missingMark) status = "missing-mark";
  else if (staleMark) status = "stale-mark";
  else if (!options.walletReconciled) status = "unreconciled";
  else if (!options.inrRate) status = "missing-rate";
  else {
    const rateAt = timestamp(options.inrRate.observedAt, "INR rate time");
    positive(options.inrRate.inrPerUsdt, "INR per USDT");
    if (!options.inrRate.source.trim() || rateAt > asOf) throw new Error("Invalid INR rate provenance.");
    if (asOf - rateAt > (options.maxRateAgeMs ?? 24 * 60 * 60 * 1000)) status = "stale-rate";
  }
  return {
    walletUsdt: canonical(wallet),
    realizedPnlUsdt: canonical(realized),
    feesUsdt: canonical(fees),
    fundingUsdt: canonical(funding),
    internalTransfersUsdt: canonical(internalTransfers),
    externalTransfersUsdt: canonical(externalTransfers),
    positions: results,
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
    walletReconciled: false,
  });
}
