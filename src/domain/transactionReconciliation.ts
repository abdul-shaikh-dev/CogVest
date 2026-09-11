import {
  decimal,
  isWithinQuantum,
  normalizeQuantity,
  normalizeUnitPrice,
  quantityQuantum,
} from "@/src/domain/precision";
import {
  compareTransactionsChronologically,
  getTradeCostBasisAcquisition,
  getTradeQuantityDelta,
  hasUnresolvedTransferCostBasis,
} from "@/src/domain/transactionSemantics";
import type { OpeningPosition, StockSplitEvent, Trade } from "@/src/types";
import { positionEvents, splitQuantity, StockSplitError } from "./stockSplits";

export type TransactionReconciliation = {
  averageCostPrice: number;
  isExact: boolean;
  oversoldTransactionIds: string[];
  quantity: number;
  unresolvedTransactionIds: string[];
};

export function reconcileTransactions({
  openingPosition,
  transactions,
  stockSplits = [],
  through,
  openingMeasuredAsOf,
}: {
  openingPosition?: Pick<
    OpeningPosition,
    "averageCostPrice" | "quantity"
  >;
  transactions: Trade[];
  stockSplits?: StockSplitEvent[];
  through?: string;
  openingMeasuredAsOf?: string;
}): TransactionReconciliation {
  let quantity = decimal(openingPosition?.quantity ?? 0);
  let totalCost = quantity.times(openingPosition?.averageCostPrice ?? 0);
  const oversoldTransactionIds: string[] = [];
  const unresolvedTransactionIds: string[] = [];

  if (openingPosition && stockSplits.length && !openingMeasuredAsOf) {
    return { averageCostPrice: openingPosition.averageCostPrice, quantity: openingPosition.quantity,
      isExact: false, oversoldTransactionIds, unresolvedTransactionIds: ["opening-measurement-date"] };
  }
  const events = positionEvents({ trades: transactions, through,
    stockSplits: stockSplits.filter((event) => !openingMeasuredAsOf || event.effectiveDate > openingMeasuredAsOf) });
  for (const event of events) {
    if (event.type === "split") {
      try { quantity = splitQuantity(quantity, event.split); }
      catch (error) {
        if (!(error instanceof StockSplitError)) throw error;
        unresolvedTransactionIds.push(event.split.id);
      }
      continue;
    }
    if (event.type !== "trade") continue;
    const transaction = event.trade;
    if (hasUnresolvedTransferCostBasis(transaction)) {
      unresolvedTransactionIds.push(transaction.id);
      quantity = quantity.plus(transaction.quantity);
      continue;
    }

    const acquisition = getTradeCostBasisAcquisition(transaction);
    if (acquisition) {
      quantity = quantity.plus(acquisition.quantity);
      totalCost = totalCost.plus(
        decimal(acquisition.quantity)
          .times(acquisition.pricePerUnit)
          .plus(acquisition.fees),
      );
      continue;
    }

    const nextQuantity = quantity.plus(getTradeQuantityDelta(transaction));
    if (nextQuantity.lessThan(quantityQuantum * -1)) {
      oversoldTransactionIds.push(transaction.id);
      continue;
    }

    const averageCostBeforeDisposal = quantity.greaterThan(0)
      ? totalCost.dividedBy(quantity)
      : decimal(0);
    quantity = nextQuantity.abs().lessThan(quantityQuantum)
      ? decimal(0)
      : nextQuantity;
    totalCost = quantity.isZero()
      ? decimal(0)
      : averageCostBeforeDisposal.times(quantity);
  }

  const averageCostPrice = quantity.greaterThan(0)
    ? totalCost.dividedBy(quantity)
    : decimal(0);

  return {
    averageCostPrice: normalizeUnitPrice(averageCostPrice),
    isExact:
      oversoldTransactionIds.length === 0 &&
      unresolvedTransactionIds.length === 0,
    oversoldTransactionIds,
    quantity: normalizeQuantity(quantity),
    unresolvedTransactionIds,
  };
}

export function matchesOpeningPosition(
  reconciliation: TransactionReconciliation,
  openingPosition: Pick<OpeningPosition, "averageCostPrice" | "quantity">,
) {
  return (
    reconciliation.isExact &&
    isWithinQuantum(
      reconciliation.quantity,
      openingPosition.quantity,
      quantityQuantum,
    ) &&
    isWithinQuantum(
      reconciliation.averageCostPrice,
      openingPosition.averageCostPrice,
      10 ** -8,
    )
  );
}
