import type {
  BuyTrade,
  SellTrade,
  Trade,
  TransferInTrade,
  TransferOutTrade,
} from "@/src/types";
import { getCalendarDatePart } from "@/src/domain/dates";

export type CostBasisAcquisition = {
  fees: number;
  pricePerUnit: number;
  quantity: number;
};

export function isManualTrade(trade: Trade): trade is BuyTrade | SellTrade {
  return trade.type === "buy" || trade.type === "sell";
}

export function isTradeAcquisition(
  trade: Trade,
): trade is BuyTrade | TransferInTrade {
  return trade.type === "buy" || trade.type === "transferIn";
}

export function isTradeDisposal(
  trade: Trade,
): trade is SellTrade | TransferOutTrade {
  return trade.type === "sell" || trade.type === "transferOut";
}

export function compareTransactionsChronologically(left: Trade, right: Trade) {
  const dateOrder = left.date.localeCompare(right.date);
  if (dateOrder !== 0) return dateOrder;

  const leftProvenance = left.importProvenance;
  const rightProvenance = right.importProvenance;
  if (
    leftProvenance?.importBatchId &&
    leftProvenance.importBatchId === rightProvenance?.importBatchId &&
    leftProvenance.originalRowNumber !== rightProvenance.originalRowNumber
  ) {
    return leftProvenance.originalRowNumber - rightProvenance.originalRowNumber;
  }

  const directionOrder =
    Number(!isTradeAcquisition(left)) - Number(!isTradeAcquisition(right));
  return directionOrder || left.id.localeCompare(right.id);
}

export function hasAmbiguousSameDayTransactionOrder(
  existing: Trade[],
  incoming: Trade[],
) {
  return incoming.some((candidate) =>
    existing.some((prior) => {
      const candidateDate = getCalendarDatePart(candidate.date);
      const priorDate = getCalendarDatePart(prior.date);
      const sameKnownBatch =
        candidate.importProvenance?.importBatchId !== undefined &&
        candidate.importProvenance.importBatchId ===
          prior.importProvenance?.importBatchId;

      return (
        candidate.assetId === prior.assetId &&
        candidateDate !== null &&
        candidateDate === priorDate &&
        !sameKnownBatch &&
        isTradeAcquisition(candidate) !== isTradeAcquisition(prior)
      );
    }),
  );
}

export function getTradeQuantityDelta(trade: Trade) {
  return isTradeAcquisition(trade) ? trade.quantity : -trade.quantity;
}

/** Only purchases are new user investment; transfers move existing ownership. */
export function isTradeCashPurchase(trade: Trade): trade is BuyTrade {
  return trade.type === "buy";
}

/**
 * Costed transfer-ins are acquisitions for moving-average basis. An uncosted
 * transfer remains explicit so the importer can block reconciliation.
 */
export function getTradeCostBasisAcquisition(
  trade: Trade,
): CostBasisAcquisition | undefined {
  if (trade.type === "buy") {
    return {
      fees: trade.fees ?? 0,
      pricePerUnit: trade.pricePerUnit,
      quantity: trade.quantity,
    };
  }

  if (
    trade.type === "transferIn" &&
    trade.acquisitionCostPerUnit !== undefined
  ) {
    return {
      fees: 0,
      pricePerUnit: trade.acquisitionCostPerUnit,
      quantity: trade.quantity,
    };
  }

  return undefined;
}

export function hasUnresolvedTransferCostBasis(trade: Trade) {
  return (
    trade.type === "transferIn" && trade.acquisitionCostPerUnit === undefined
  );
}
