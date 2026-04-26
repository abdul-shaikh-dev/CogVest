import type {
  Asset,
  AssetClass,
  CashEntry,
  Holding,
  QuoteCache,
  Trade,
} from "@/src/types";

type CalculateHoldingInput = {
  asset: Asset;
  currentPrice: number;
  trades: Trade[];
};

type CalculateHoldingsInput = {
  assets: Asset[];
  quoteCache: QuoteCache;
  trades: Trade[];
};

export type AllocationItem = {
  assetClass: AssetClass;
  percentage: number;
  value: number;
};

export type PortfolioDayChange = {
  absolute: number;
  percentage: number;
};

export type ConvictionReadiness = {
  highConvictionCount: number;
  isReady: boolean;
  lowConvictionCount: number;
  ratedTradeCount: number;
  requiredTradeCount: number;
};

const defaultConvictionTradeCount = 5;

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;

  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function sortTradesByDate(trades: Trade[]) {
  return [...trades].sort(
    (left, right) =>
      new Date(left.date).getTime() - new Date(right.date).getTime(),
  );
}

export function calculateHolding({
  asset,
  currentPrice,
  trades,
}: CalculateHoldingInput): Holding {
  let averageCostPrice = 0;
  let totalUnits = 0;

  for (const trade of sortTradesByDate(trades)) {
    if (trade.type === "buy") {
      const existingCost = totalUnits * averageCostPrice;
      const buyCost = trade.pricePerUnit * trade.quantity + (trade.fees ?? 0);
      const nextUnits = totalUnits + trade.quantity;

      averageCostPrice = nextUnits > 0 ? (existingCost + buyCost) / nextUnits : 0;
      totalUnits = nextUnits;
      continue;
    }

    totalUnits = Math.max(0, totalUnits - trade.quantity);

    if (totalUnits === 0) {
      averageCostPrice = 0;
    }
  }

  const totalInvested = totalUnits * averageCostPrice;
  const currentValue = totalUnits * currentPrice;
  const unrealisedPnL = currentValue - totalInvested;
  const unrealisedPnLPct =
    totalInvested === 0 ? 0 : (unrealisedPnL / totalInvested) * 100;

  return {
    asset,
    averageCostPrice,
    currentPrice,
    currentValue,
    totalInvested,
    totalUnits,
    unrealisedPnL,
    unrealisedPnLPct,
  };
}

export function calculateHoldings({
  assets,
  quoteCache,
  trades,
}: CalculateHoldingsInput) {
  return assets
    .map((asset) => {
      const assetTrades = trades.filter((trade) => trade.assetId === asset.id);

      if (assetTrades.length === 0) {
        return null;
      }

      const currentPrice = quoteCache[asset.id]?.price ?? 0;
      const holding = calculateHolding({
        asset,
        currentPrice,
        trades: assetTrades,
      });

      return holding.totalUnits > 0 ? holding : null;
    })
    .filter((holding): holding is Holding => holding !== null);
}

export function calculateCashBalance(cashEntries: CashEntry[]) {
  return cashEntries.reduce((balance, entry) => {
    if (entry.type === "withdrawal") {
      return balance - entry.amount;
    }

    return balance + entry.amount;
  }, 0);
}

export function calculatePortfolioTotal(
  holdings: Holding[],
  cashEntries: CashEntry[],
) {
  const holdingsValue = holdings.reduce(
    (total, holding) => total + holding.currentValue,
    0,
  );

  return holdingsValue + calculateCashBalance(cashEntries);
}

export function calculatePortfolioDayChange(
  holdings: Holding[],
): PortfolioDayChange {
  const currentValue = holdings.reduce(
    (total, holding) => total + holding.currentValue,
    0,
  );
  const absolute = holdings.reduce((total, holding) => {
    if (!holding.dayChangePct) {
      return total;
    }

    const previousValue = holding.currentValue / (1 + holding.dayChangePct / 100);

    return total + (holding.currentValue - previousValue);
  }, 0);
  const previousValue = currentValue - absolute;
  const percentage = previousValue === 0 ? 0 : (absolute / previousValue) * 100;

  return {
    absolute: round(absolute),
    percentage: round(percentage),
  };
}

export function calculateAllocation({
  cashBalance,
  holdings,
}: {
  cashBalance: number;
  holdings: Holding[];
}): AllocationItem[] {
  const values = new Map<AssetClass, number>();

  for (const holding of holdings) {
    values.set(
      holding.asset.assetClass,
      (values.get(holding.asset.assetClass) ?? 0) + holding.currentValue,
    );
  }

  if (cashBalance > 0) {
    values.set("cash", (values.get("cash") ?? 0) + cashBalance);
  }

  const total = [...values.values()].reduce((sum, value) => sum + value, 0);

  if (total === 0) {
    return [];
  }

  return [...values.entries()]
    .map(([assetClass, value]) => ({
      assetClass,
      percentage: round((value / total) * 100),
      value,
    }))
    .sort((left, right) => right.value - left.value);
}

export function daysHeld(fromIsoDate: string, toIsoDate = new Date().toISOString()) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const fromTime = new Date(fromIsoDate).getTime();
  const toTime = new Date(toIsoDate).getTime();

  return Math.max(0, Math.floor((toTime - fromTime) / millisecondsPerDay));
}

export function getConvictionReadiness(
  trades: Trade[],
  requiredTradeCount = defaultConvictionTradeCount,
): ConvictionReadiness {
  const ratedTrades = trades.filter((trade) => trade.conviction !== undefined);
  const highConvictionCount = ratedTrades.filter(
    (trade) => trade.conviction !== undefined && trade.conviction >= 4,
  ).length;
  const lowConvictionCount = ratedTrades.filter(
    (trade) => trade.conviction !== undefined && trade.conviction <= 2,
  ).length;

  return {
    highConvictionCount,
    isReady: ratedTrades.length >= requiredTradeCount,
    lowConvictionCount,
    ratedTradeCount: ratedTrades.length,
    requiredTradeCount,
  };
}
