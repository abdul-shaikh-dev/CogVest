import { formatLocalCalendarDate, getCalendarDatePart } from "./dates";
import { getOpeningPositionHistoryDate, isTransactionAfterOpeningCutover } from "./openingPositions";
import { decimal, type FinancialDecimalInstance } from "./precision";
import { compareTransactionsChronologically } from "./transactionSemantics";
import type { OpeningPosition, StockSplitEvent, Trade } from "@/src/types";

export class StockSplitError extends Error {
  constructor(readonly eventId: string, message: string) {
    super(message);
    this.name = "StockSplitError";
  }
}

export function orderedStockSplits(events: readonly StockSplitEvent[]) {
  const ids = new Set<string>();
  const dates = new Set<string>();
  for (const event of events) {
    if (!event.id || !["split", "bonus"].includes(event.kind) ||
        getCalendarDatePart(event.effectiveDate) !== event.effectiveDate ||
        !Number.isSafeInteger(event.newShares) || event.newShares <= 0 ||
        !Number.isSafeInteger(event.oldShares) || event.oldShares <= 0 ||
        (event.kind === "split" && event.newShares === event.oldShares) ||
        (event.kind === "bonus" && event.oldIsin !== event.newIsin) ||
        (event.kind === "bonus" && (!event.creditedDate || getCalendarDatePart(event.creditedDate) !== event.creditedDate || event.creditedDate < event.effectiveDate)) ||
        (event.kind === "split" && event.creditedDate !== undefined) ||
        !/^[A-Z0-9]{12}$/.test(event.oldIsin) || !/^[A-Z0-9]{12}$/.test(event.newIsin) ||
        ids.has(event.id) || dates.has(event.effectiveDate)) {
      throw new StockSplitError(event.id, "Share-adjustment terms or ordering are unresolved.");
    }
    ids.add(event.id);
    dates.add(event.effectiveDate);
  }
  return [...events].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
}

export function splitQuantity(quantity: FinancialDecimalInstance, event: StockSplitEvent) {
  const adjusted = quantity.times(event.newShares).dividedBy(event.oldShares);
  const next = event.kind === "bonus" ? quantity.plus(adjusted) : adjusted;
  if (quantity.isNegative() || !next.isInteger()) {
    throw new StockSplitError(event.id, "A share adjustment has an unresolved fractional entitlement or quantity.");
  }
  return next;
}

export type PositionEvent =
  | { date: string; type: "opening"; position: OpeningPosition }
  | { date: string; type: "trade"; trade: Trade }
  | { date: string; type: "split"; split: StockSplitEvent };

/** Splits change existing ownership before ex-date trading, not that day's buys. */
export function positionEvents({
  openingPositions = [], trades, stockSplits = [], through = formatLocalCalendarDate(new Date()),
}: {
  openingPositions?: OpeningPosition[];
  trades: Trade[];
  stockSplits?: readonly StockSplitEvent[];
  through?: string;
}): PositionEvent[] {
  const splits = orderedStockSplits(stockSplits).filter((event) => event.effectiveDate <= through);
  for (const event of splits) {
    if (event.kind === "bonus" && trades.some((trade) => {
      const date = getCalendarDatePart(trade.date) ?? "";
      return (trade.type === "sell" || trade.type === "transferOut") &&
        date >= event.effectiveDate && date < event.creditedDate! &&
        isTransactionAfterOpeningCutover(trade.date, openingPositions);
    })) {
      throw new StockSplitError(event.id, "A disposal before bonus shares were credited needs reconciliation.");
    }
  }
  for (const position of openingPositions) {
    if (splits.some((event) =>
      !position.measuredAsOf && (getOpeningPositionHistoryDate(position) ?? "") < event.effectiveDate)) {
      throw new StockSplitError(splits[0].id, "Confirm the opening balance measurement date before applying a split.");
    }
  }
  const events: PositionEvent[] = [
    ...openingPositions.map((position) => ({
      date: getOpeningPositionHistoryDate(position) ?? "", position, type: "opening" as const,
    })),
    ...[...trades].sort(compareTransactionsChronologically)
      .filter((trade) => isTransactionAfterOpeningCutover(trade.date, openingPositions))
      .map((trade) => ({ date: trade.date, trade, type: "trade" as const })),
    ...splits.map((split) => ({ date: split.effectiveDate, split, type: "split" as const })),
  ];
  return events.sort((a, b) => {
    const day = (getCalendarDatePart(a.date) ?? a.date).localeCompare(getCalendarDatePart(b.date) ?? b.date);
    if (day) return day;
    if (a.type === "split" || b.type === "split") return a.type === b.type ? 0 : a.type === "split" ? -1 : 1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
}

/** Quantity-only consumers must use the same multiplicative event timeline. */
export function positionQuantity(input: Parameters<typeof positionEvents>[0]) {
  let quantity = decimal(0);
  for (const event of positionEvents(input)) {
    if (event.type === "split") quantity = splitQuantity(quantity, event.split);
    else if (event.type === "opening") quantity = quantity.plus(event.position.quantity);
    else quantity = quantity.plus(
      event.trade.type === "buy" || event.trade.type === "transferIn" ? event.trade.quantity : -event.trade.quantity,
    );
  }
  return quantity;
}
