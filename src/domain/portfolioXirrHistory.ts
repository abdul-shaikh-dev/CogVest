import { getCalendarDatePart, parseCalendarDate } from "./dates";
import { decimal } from "./precision";
import type { UsdmFuturesAccount } from "./usdmFutures";
import type { Asset, CashEntry, OpeningPosition, PpfAccount, PpfLedgerEntry, Trade } from "@/src/types";

export type XirrHistorySource = "portfolio" | "asset" | "cash" | "trade" | "opening" | "ppf" | "ppf-entry" | "futures";
export type XirrHistoryReference = { source: XirrHistorySource; id: string };
export type XirrHistoryGap = XirrHistoryReference & {
  reason: "history-not-confirmed" | "invalid-date" | "invalid-amount" | "duplicate-id"
    | "ambiguous-cash" | "unmatched-trade-cash" | "unlinked-trade"
    | "foreign-currency" | "missing-asset" | "opening-history"
    | "asset-transfer-boundary" | "ppf-history-and-boundary" | "futures-history-and-boundary";
};

export type PortfolioXirrHistoryInput = {
  asOf: string;
  assets: readonly Asset[];
  cashEntries: readonly CashEntry[];
  trades: readonly Trade[];
  openingPositions: readonly OpeningPosition[];
  ppfAccounts: readonly PpfAccount[];
  ppfLedgerEntries: readonly PpfLedgerEntry[];
  futuresAccounts: readonly UsdmFuturesAccount[];
};

export type PortfolioXirrHistoryAudit = {
  status: "needs-evidence";
  gaps: XirrHistoryGap[];
  /** Recorded Cash facts only, never a complete solver input or inferred funding. */
  recordedExternalCashFlows: Array<{ date: string; amountInr: string; reference: XirrHistoryReference }>;
  internalTradePairs: Array<{ cashId: string; tradeId: string }>;
};

/** Read-only preflight. Schema 15 cannot establish complete whole-portfolio history. */
export function auditPortfolioXirrHistory(input: PortfolioXirrHistoryInput): PortfolioXirrHistoryAudit {
  const result: PortfolioXirrHistoryAudit = {
    status: "needs-evidence",
    gaps: [{ source: "portfolio", id: "portfolio", reason: "history-not-confirmed" }],
    recordedExternalCashFlows: [],
    internalTradePairs: [],
  };
  const gap = (reference: XirrHistoryReference, reason: XirrHistoryGap["reason"]) => {
    result.gaps.push({ ...reference, reason });
  };
  if (!parseCalendarDate(input.asOf) || input.asOf.length !== 10) {
    gap({ source: "portfolio", id: "portfolio" }, "invalid-date");
    return result;
  }

  function unique<T extends { id: string }>(items: readonly T[], source: XirrHistorySource): T[] {
    const counts = new Map<string, number>();
    items.forEach(({ id }) => counts.set(id, (counts.get(id) ?? 0) + 1));
    counts.forEach((count, id) => { if (count > 1) gap({ source, id }, "duplicate-id"); });
    return items.filter(({ id }) => counts.get(id) === 1);
  }
  function effective(value: string | null, reference: XirrHistoryReference) {
    const date = value === null ? null : getCalendarDatePart(value);
    if (!date) gap(reference, "invalid-date");
    return date && date <= input.asOf ? date : null;
  }
  const assets = new Map(unique(input.assets, "asset").map((asset) => [asset.id, asset]));
  const trades = unique(input.trades, "trade").filter((trade) => effective(trade.date, { source: "trade", id: trade.id }));
  const cash = unique(input.cashEntries, "cash").filter((entry) => effective(entry.date, { source: "cash", id: entry.id }));
  const tradeMap = new Map(trades.map((trade) => [trade.id, trade]));
  const cashByTrade = new Map<string, CashEntry[]>();
  cash.forEach((entry) => {
    if (entry.linkedTradeId) cashByTrade.set(entry.linkedTradeId, [...(cashByTrade.get(entry.linkedTradeId) ?? []), entry]);
  });
  const matched = new Set<string>();

  for (const entry of cash) {
    const reference: XirrHistoryReference = { source: "cash", id: entry.id };
    if (!Number.isFinite(entry.amount) || entry.amount <= 0) {
      gap(reference, "invalid-amount");
      continue;
    }
    const external = (entry.purpose === "capitalContribution" && entry.type === "addition")
      || (entry.purpose === "withdrawal" && entry.type === "withdrawal");
    if (external && !entry.linkedTradeId && !entry.linkedFutures) {
      result.recordedExternalCashFlows.push({
        reference,
        date: getCalendarDatePart(entry.date)!,
        amountInr: decimal(entry.amount).times(entry.type === "addition" ? -1 : 1).toString(),
      });
      continue;
    }
    if (entry.purpose === "purchaseFunding" || entry.purpose === "saleProceeds") {
      const trade = tradeMap.get(entry.linkedTradeId ?? "");
      const expectedType = entry.purpose === "purchaseFunding" ? "buy" : "sell";
      if (trade && (trade.type === "buy" || trade.type === "sell")
        && trade.type === expectedType && !entry.linkedFutures
        && entry.type === (trade.type === "buy" ? "withdrawal" : "addition")
        && cashByTrade.get(trade.id)?.length === 1
        && assets.get(trade.assetId)?.currency === "INR"
        && Number.isFinite(trade.totalValue) && decimal(entry.amount).equals(trade.totalValue)
        && getCalendarDatePart(entry.date) === getCalendarDatePart(trade.date)) {
        result.internalTradePairs.push({ cashId: entry.id, tradeId: trade.id });
        matched.add(trade.id);
      } else gap(reference, "unmatched-trade-cash");
    } else if (entry.purpose === "futuresTransfer") {
      // Not an external flow merely because the monthly Progress report excludes Futures.
      gap(reference, "futures-history-and-boundary");
    } else gap(reference, "ambiguous-cash");
  }

  for (const trade of trades) {
    const reference: XirrHistoryReference = { source: "trade", id: trade.id };
    const asset = assets.get(trade.assetId);
    if (!asset) gap(reference, "missing-asset");
    else if (asset.currency !== "INR") gap(reference, "foreign-currency");
    if (trade.type === "transferIn" || trade.type === "transferOut") {
      gap(reference, "asset-transfer-boundary");
    } else {
      if (!Number.isFinite(trade.totalValue) || trade.totalValue < 0) gap(reference, "invalid-amount");
      if (!matched.has(trade.id)) gap(reference, "unlinked-trade");
    }
  }
  for (const opening of unique(input.openingPositions, "opening")) {
    // An aggregate purchase date/cost is not a dated external contribution or opening market value.
    gap({ source: "opening", id: opening.id }, "opening-history");
  }
  for (const account of unique(input.ppfAccounts, "ppf")) {
    gap({ source: "ppf", id: account.id }, "ppf-history-and-boundary");
  }
  for (const entry of unique(input.ppfLedgerEntries, "ppf-entry")) {
    if (effective(entry.date, { source: "ppf-entry", id: entry.id })) {
      gap({ source: "ppf-entry", id: entry.id }, "ppf-history-and-boundary");
    }
  }
  for (const account of unique(input.futuresAccounts, "futures")) {
    gap({ source: "futures", id: account.id }, "futures-history-and-boundary");
  }
  result.recordedExternalCashFlows.sort((a, b) => a.date.localeCompare(b.date) || a.reference.id.localeCompare(b.reference.id));
  return result;
}
