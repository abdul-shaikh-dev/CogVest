import type {
  BuyTrade,
  SellTrade,
  Trade,
  TransferInTrade,
  TransferOutTrade,
} from "@/src/types";
import { getCalendarDatePart } from "@/src/domain/dates";
import { compareCodeUnits } from "@/src/domain/ordering";
import { decimal, type FinancialDecimalInstance } from "@/src/domain/precision";

export type CostBasisAcquisition = {
  fees: number;
  /**
   * Charges an import recorded beside its gross total. They belong in the
   * holding's cost, but not in import reconciliation, whose baselines come from
   * broker holdings statements that exclude charges (#649).
   */
  importedCharges: FinancialDecimalInstance;
  pricePerUnit: number;
  quantity: number;
};

/**
 * Fees and taxes an import kept in its provenance (#649). An imported trade's
 * `totalValue` is gross (quantity × price); a manual trade has none of these
 * and keeps its fees in `fees`, already inside `totalValue`.
 */
export function getImportedTradeCharges(trade: Trade): FinancialDecimalInstance {
  const provenance = trade.importProvenance;
  return provenance ? decimal(provenance.fees ?? 0).plus(provenance.taxes ?? 0) : decimal(0);
}

/**
 * What a buy cost or a sale returned after every charge. Shared by holding
 * cost, realised gain and XIRR so they cannot disagree (#649).
 */
export function getTradeNetAmount(trade: BuyTrade | SellTrade): FinancialDecimalInstance {
  const charges = getImportedTradeCharges(trade);
  return trade.type === "buy"
    ? decimal(trade.totalValue).plus(charges)
    : decimal(trade.totalValue).minus(charges);
}

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
  const dateOrder = compareCodeUnits(left.date, right.date);
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
  return directionOrder || compareCodeUnits(left.id, right.id);
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
      importedCharges: getImportedTradeCharges(trade),
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
      importedCharges: decimal(0),
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
