import type {
  Asset,
  AssetClass,
  CashEntry,
  Holding,
  OpeningPosition,
  QuoteCache,
  Trade,
} from "@/src/types";

type CalculateHoldingInput = {
  asset: Asset;
  currentPrice: number;
  openingPositions?: OpeningPosition[];
  trades: Trade[];
};

type CalculateHoldingsInput = {
  assets: Asset[];
  openingPositions?: OpeningPosition[];
  quoteCache: QuoteCache;
  trades: Trade[];
};

export type AllocationItem = {
  assetClass: AssetClass;
  percentage: number;
  value: number;
};

export type MetadataAllocationItem = {
  label: string;
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
  openingPositions = [],
  trades,
}: CalculateHoldingInput): Holding {
  let averageCostPrice = 0;
  let totalUnits = 0;
  const costBasisEvents = [
    ...openingPositions.map((position) => ({
      date: position.date,
      fees: 0,
      pricePerUnit: position.averageCostPrice,
      quantity: position.quantity,
      type: "opening" as const,
    })),
    ...sortTradesByDate(trades).map((trade) => ({
      date: trade.date,
      fees: trade.fees ?? 0,
      pricePerUnit: trade.pricePerUnit,
      quantity: trade.quantity,
      type: trade.type,
    })),
  ].sort(
    (left, right) =>
      new Date(left.date).getTime() - new Date(right.date).getTime(),
  );

  for (const event of costBasisEvents) {
    if (event.type === "buy" || event.type === "opening") {
      const existingCost = totalUnits * averageCostPrice;
      const buyCost = event.pricePerUnit * event.quantity + event.fees;
      const nextUnits = totalUnits + event.quantity;

      averageCostPrice = nextUnits > 0 ? (existingCost + buyCost) / nextUnits : 0;
      totalUnits = nextUnits;
      continue;
    }

    totalUnits = Math.max(0, totalUnits - event.quantity);

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
  openingPositions = [],
  quoteCache,
  trades,
}: CalculateHoldingsInput) {
  return assets
    .map((asset) => {
      const assetTrades = trades.filter((trade) => trade.assetId === asset.id);
      const assetOpeningPositions = openingPositions.filter(
        (position) => position.assetId === asset.id,
      );

      if (assetTrades.length === 0 && assetOpeningPositions.length === 0) {
        return null;
      }

      const latestManualPrice = [...assetOpeningPositions]
        .filter((position) => position.currentPrice !== undefined)
        .sort(
          (left, right) =>
            new Date(right.date).getTime() - new Date(left.date).getTime(),
        )[0]?.currentPrice;
      const currentPrice = quoteCache[asset.id]?.price ?? latestManualPrice ?? 0;
      const holding = calculateHolding({
        asset,
        currentPrice,
        openingPositions: assetOpeningPositions,
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

export function calculateMetadataAllocation(
  holdings: Holding[],
  metadataKey: "instrumentType" | "sectorType",
): MetadataAllocationItem[] {
  const values = new Map<string, number>();

  for (const holding of holdings) {
    const label = holding.asset[metadataKey] ?? "other";

    values.set(label, (values.get(label) ?? 0) + holding.currentValue);
  }

  const total = [...values.values()].reduce((sum, value) => sum + value, 0);

  if (total === 0) {
    return [];
  }

  return [...values.entries()]
    .map(([label, value]) => ({
      label,
      percentage: round((value / total) * 100),
      value,
    }))
    .sort((left, right) => right.value - left.value);
}

export function calculateInstrumentAllocation(holdings: Holding[]) {
  return calculateMetadataAllocation(holdings, "instrumentType");
}

export function calculateSectorAllocation(holdings: Holding[]) {
  return calculateMetadataAllocation(holdings, "sectorType");
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
  openingPositions: OpeningPosition[] = [],
): ConvictionReadiness {
  const ratedConvictions = [
    ...trades.map((trade) => trade.conviction),
    ...openingPositions.map((position) => position.conviction),
  ].filter((conviction): conviction is NonNullable<typeof conviction> =>
    conviction !== undefined,
  );
  const highConvictionCount = ratedConvictions.filter(
    (conviction) => conviction >= 4,
  ).length;
  const lowConvictionCount = ratedConvictions.filter(
    (conviction) => conviction <= 2,
  ).length;

  return {
    highConvictionCount,
    isReady: ratedConvictions.length >= requiredTradeCount,
    lowConvictionCount,
    ratedTradeCount: ratedConvictions.length,
    requiredTradeCount,
  };
}
