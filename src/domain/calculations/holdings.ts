import type {
  Asset,
  AssetClass,
  CashEntry,
  Holding,
  MonthlySnapshot,
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

export type ConsolidatedHoldingRow = {
  asset: Asset;
  assetClass: AssetClass;
  currentAllocationPct: number;
  currentValue: number;
  initialAllocationPct: number;
  instrumentType?: Asset["instrumentType"];
  investedValue: number;
  pnl: number;
  pnlPct: number;
  sectorType?: Asset["sectorType"];
  units: number;
};

export type PortfolioRollupTotals = {
  cashBalance: number;
  holdingsCurrentValue: number;
  pnl: number;
  pnlPct: number;
  totalCurrentValue: number;
  totalInvested: number;
};

export type MonthlyAssetSnapshotItem = {
  assetClass: AssetClass;
  percentage: number;
  value: number;
};

export type MonthlyProgressSummary = {
  assetSnapshot: MonthlyAssetSnapshotItem[];
  expenseRate: number | null;
  monthlyGain: number;
  monthlyGainPct: number;
  savingsRate: number | null;
  snapshot: MonthlySnapshot;
};

export type CashMonthlyMetrics = {
  added: number;
  available: number;
  invested: number;
  savingsRate: number | null;
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

function isSameMonth(isoDate: string, now: Date) {
  const date = new Date(isoDate);

  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth()
  );
}

export function calculateCashMonthlyMetrics({
  cashEntries,
  now = new Date(),
  openingPositions,
  trades,
}: {
  cashEntries: CashEntry[];
  now?: Date;
  openingPositions: OpeningPosition[];
  trades: Trade[];
}): CashMonthlyMetrics {
  const added = cashEntries
    .filter((entry) => entry.type === "addition" && isSameMonth(entry.date, now))
    .reduce((total, entry) => total + entry.amount, 0);
  const tradeInvested = trades
    .filter((trade) => trade.type === "buy" && isSameMonth(trade.date, now))
    .reduce((total, trade) => total + trade.totalValue, 0);
  const openingInvested = openingPositions
    .filter((position) => isSameMonth(position.date, now))
    .reduce(
      (total, position) =>
        total + position.quantity * position.averageCostPrice,
      0,
    );
  const invested = tradeInvested + openingInvested;

  return {
    added,
    available: calculateCashBalance(cashEntries),
    invested,
    savingsRate: added > 0 ? round((invested / added) * 100) : null,
  };
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

export function calculateConsolidatedHoldingRows(
  holdings: Holding[],
): ConsolidatedHoldingRow[] {
  const totalInvested = holdings.reduce(
    (total, holding) => total + holding.totalInvested,
    0,
  );
  const totalCurrentValue = holdings.reduce(
    (total, holding) => total + holding.currentValue,
    0,
  );

  return holdings
    .map((holding) => ({
      asset: holding.asset,
      assetClass: holding.asset.assetClass,
      currentAllocationPct:
        totalCurrentValue === 0
          ? 0
          : round((holding.currentValue / totalCurrentValue) * 100),
      currentValue: holding.currentValue,
      initialAllocationPct:
        totalInvested === 0
          ? 0
          : round((holding.totalInvested / totalInvested) * 100),
      instrumentType: holding.asset.instrumentType,
      investedValue: holding.totalInvested,
      pnl: holding.unrealisedPnL,
      pnlPct: round(holding.unrealisedPnLPct),
      sectorType: holding.asset.sectorType,
      units: holding.totalUnits,
    }))
    .sort((left, right) => right.currentValue - left.currentValue);
}

export function calculatePortfolioRollupTotals(
  rows: ConsolidatedHoldingRow[],
  cashBalance = 0,
): PortfolioRollupTotals {
  const totalInvested = rows.reduce(
    (total, row) => total + row.investedValue,
    0,
  );
  const holdingsCurrentValue = rows.reduce(
    (total, row) => total + row.currentValue,
    0,
  );
  const pnl = holdingsCurrentValue - totalInvested;

  return {
    cashBalance,
    holdingsCurrentValue,
    pnl,
    pnlPct: totalInvested === 0 ? 0 : round((pnl / totalInvested) * 100),
    totalCurrentValue: holdingsCurrentValue + cashBalance,
    totalInvested,
  };
}

export function calculateMonthlyProgressSummaries(
  snapshots: MonthlySnapshot[],
): MonthlyProgressSummary[] {
  const chronological = [...snapshots].sort((left, right) =>
    left.month.localeCompare(right.month),
  );

  return chronological
    .map((snapshot, index) => {
      const previous = chronological[index - 1];
      const monthlyGain = previous
        ? snapshot.portfolioValue - previous.portfolioValue
        : 0;
      const assetTotal =
        snapshot.equityValue +
        snapshot.debtValue +
        snapshot.cryptoValue +
        snapshot.cashValue;
      const assetValues: Array<Pick<MonthlyAssetSnapshotItem, "assetClass" | "value">> = [
        { assetClass: "stock", value: snapshot.equityValue },
        { assetClass: "debt", value: snapshot.debtValue },
        { assetClass: "crypto", value: snapshot.cryptoValue },
        { assetClass: "cash", value: snapshot.cashValue },
      ];
      const assetSnapshot: MonthlyAssetSnapshotItem[] = assetValues
        .filter((item) => item.value > 0)
        .map((item) => ({
          ...item,
          percentage:
            assetTotal === 0 ? 0 : round((item.value / assetTotal) * 100),
        }))
        .sort((left, right) => right.value - left.value);

      return {
        assetSnapshot,
        expenseRate:
          snapshot.salary === 0 || snapshot.monthlyExpense === undefined
            ? null
            : round((snapshot.monthlyExpense / snapshot.salary) * 100),
        monthlyGain,
        monthlyGainPct:
          previous && previous.portfolioValue !== 0
            ? round((monthlyGain / previous.portfolioValue) * 100)
            : 0,
        savingsRate:
          snapshot.salary === 0
            ? null
            : round((snapshot.monthlyInvestment / snapshot.salary) * 100),
        snapshot,
      };
    })
    .sort((left, right) => right.snapshot.month.localeCompare(left.snapshot.month));
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
