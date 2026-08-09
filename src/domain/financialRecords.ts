import type {
  CashEntry,
  HistoricalQuote,
  MonthlySnapshot,
  OpeningPosition,
  Quote,
  Trade,
} from "@/src/types";

import {
  decimal,
  normalizeMoney,
  normalizePercentage,
  normalizeQuantity,
  normalizeUnitPrice,
} from "./precision";

export function normalizeCashEntry(entry: CashEntry): CashEntry {
  return {
    ...entry,
    amount: normalizeMoney(entry.amount),
  };
}

export function normalizeOpeningPosition(
  position: OpeningPosition,
): OpeningPosition {
  return {
    ...position,
    averageCostPrice: normalizeUnitPrice(position.averageCostPrice),
    ...(position.currentPrice === undefined
      ? {}
      : { currentPrice: normalizeUnitPrice(position.currentPrice) }),
    ...(position.manualValuation === undefined
      ? {}
      : {
          manualValuation: {
            ...position.manualValuation,
            price: normalizeUnitPrice(position.manualValuation.price),
          },
        }),
    quantity: normalizeQuantity(position.quantity),
  };
}

export function normalizeTrade(trade: Trade): Trade {
  const fees = normalizeMoney(trade.fees ?? 0);
  const pricePerUnit = normalizeUnitPrice(trade.pricePerUnit);
  const quantity = normalizeQuantity(trade.quantity);
  const grossValue = decimal(quantity).times(pricePerUnit);
  const totalValue = normalizeMoney(
    trade.type === "buy" ? grossValue.plus(fees) : grossValue.minus(fees),
  );

  return {
    ...trade,
    ...(trade.fees === undefined ? {} : { fees }),
    pricePerUnit,
    quantity,
    totalValue,
  };
}

export function normalizeMonthlySnapshot(
  snapshot: MonthlySnapshot,
): MonthlySnapshot {
  return {
    ...snapshot,
    cashValue: normalizeMoney(snapshot.cashValue),
    cryptoValue: normalizeMoney(snapshot.cryptoValue),
    debtValue: normalizeMoney(snapshot.debtValue),
    equityValue: normalizeMoney(snapshot.equityValue),
    ...(snapshot.generated
      ? {
          generated: {
          ...snapshot.generated,
          priceEvidence: snapshot.generated.priceEvidence?.map((evidence) => ({
            ...evidence,
            ...(evidence.price === undefined
              ? {}
              : { price: normalizeUnitPrice(evidence.price) }),
          })),
          },
        }
      : {}),
    investedValue: normalizeMoney(snapshot.investedValue),
    ...(snapshot.monthlyExpense === undefined
      ? {}
      : { monthlyExpense: normalizeMoney(snapshot.monthlyExpense) }),
    monthlyInvestment: normalizeMoney(snapshot.monthlyInvestment),
    ...(snapshot.performanceBasis
      ? {
          performanceBasis:
            snapshot.performanceBasis.status === "complete"
              ? {
                  ...snapshot.performanceBasis,
                  netExternalFlow: normalizeMoney(
                    snapshot.performanceBasis.netExternalFlow,
                  ),
                  weightedExternalFlow: normalizeMoney(
                    snapshot.performanceBasis.weightedExternalFlow,
                  ),
                }
              : snapshot.performanceBasis,
        }
      : {}),
    portfolioValue: normalizeMoney(snapshot.portfolioValue),
    ...(snapshot.salary === undefined
      ? {}
      : { salary: normalizeMoney(snapshot.salary) }),
  };
}

export function normalizeQuote<T extends Quote | HistoricalQuote>(quote: T): T {
  return {
    ...quote,
    ...("dayChangeAbs" in quote && quote.dayChangeAbs !== undefined
      ? { dayChangeAbs: normalizeUnitPrice(quote.dayChangeAbs) }
      : {}),
    ...("dayChangePct" in quote && quote.dayChangePct !== undefined
      ? { dayChangePct: normalizePercentage(quote.dayChangePct) }
      : {}),
    price: normalizeUnitPrice(quote.price),
  };
}
