import type {
  Asset,
  AssetClass,
  CashEntry,
  Holding,
  HoldingValuation,
  MonthlySnapshot,
  OpeningPosition,
  QuoteCache,
  Trade,
  StockSplitEvent,
} from "@/src/types";
import { positionEvents, splitQuantity } from "@/src/domain/stockSplits";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { isV1CompatibleQuote, isV1SupportedAsset } from "@/src/domain/portfolioCurrency";
import { getCalendarDatePart, isEffectiveCalendarDate } from "@/src/domain/dates";
import {
  decimal,
  type FinancialDecimalInstance,
  normalizeMoney,
  normalizePercentage,
  normalizeQuantity,
  normalizeUnitPrice,
  roundHalfUp,
  sumFinancialValues,
} from "@/src/domain/precision";
import {
  getOpeningPositionHistoryDate,
  isTransactionAfterOpeningCutover,
  isOpeningPositionEffective,
} from "@/src/domain/openingPositions";
import {
  compareTransactionsChronologically,
  getTradeCostBasisAcquisition,
  getTradeQuantityDelta,
  isTradeCashPurchase,
} from "@/src/domain/transactionSemantics";

import {
  calculateMonthlyPerformance,
  type MonthlyPerformanceResult,
} from "./monthlyPerformance";

type CalculateHoldingInput = {
  asset: Asset;
  currentPrice: number | null;
  openingPositions?: OpeningPosition[];
  trades: Trade[];
  valuation?: HoldingValuation;
  through?: string;
};

type CalculateHoldingsInput = {
  assets: Asset[];
  now?: Date;
  openingPositions?: OpeningPosition[];
  quoteCache: QuoteCache;
  trades: Trade[];
};

export type AllocationItem = {
  assetClass: AssetClass;
  percentage: number | null;
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
  currentAllocationPct: number | null;
  currentValue: number | null;
  initialAllocationPct: number;
  instrumentType?: Asset["instrumentType"];
  investedValue: number;
  pnl: number | null;
  pnlPct: number | null;
  sectorType?: Asset["sectorType"];
  units: number;
};

export type PortfolioRollupTotals = {
  cashBalance: number;
  holdingsCurrentValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
  totalCurrentValue: number | null;
  totalInvested: number;
  valuationCoverage: PortfolioValuationCoverage;
  valuedHoldingsSubtotal: number;
};

export type PortfolioValuationCoverage = {
  pendingAssetIds: string[];
  pendingHoldings: number;
  pendingInvestedValue: number;
  status: "complete" | "incomplete";
  totalHoldings: number;
  valuedHoldings: number;
};

export type MonthlyAssetSnapshotItem = {
  assetClass: AssetClass;
  percentage: number;
  value: number;
};

export type MonthlyProgressSummary = {
  assetSnapshot: MonthlyAssetSnapshotItem[];
  expenseRate: number | null;
  performance: MonthlyPerformanceResult;
  savingsRate: number | null;
  snapshot: MonthlySnapshot;
};

export type CashMonthlyMetrics = {
  added: number;
  available: number;
  contributions: number;
  income: number;
  incomeStatus: "available" | "unavailable";
  investmentRate: number | null;
  invested: number;
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
  return roundHalfUp(value, decimals);
}

function sortTradesByDate(trades: Trade[]) {
  return [...trades].sort(compareTransactionsChronologically);
}

/** Shared moving-average replay; derived values are never persisted as tax lots. */
export function calculatePositionAccounting({
  openingPositions = [],
  trades,
  stockSplits = [],
  through,
}: Pick<CalculateHoldingInput, "openingPositions" | "trades" | "through"> & { stockSplits?: StockSplitEvent[] }) {
  let averageCostPrice = decimal(0);
  let totalUnits = decimal(0);
  const saleGains: Record<string, number | null> = {};
  let chronologyKnown = !openingPositions.some(
    (position) => getOpeningPositionHistoryDate(position) === null,
  ) && !trades.some((trade) => getCalendarDatePart(trade.date) === null);
  let basisKnown = chronologyKnown;
  const costBasisEvents = positionEvents({ openingPositions, trades, stockSplits, through });

  for (const event of costBasisEvents) {
    if (event.type === "split") {
      const cost = totalUnits.times(averageCostPrice);
      totalUnits = splitQuantity(totalUnits, event.split);
      averageCostPrice = totalUnits.isZero() ? decimal(0) : cost.dividedBy(totalUnits);
      continue;
    }
    if (event.type === "opening") {
      const existingCost = totalUnits.times(averageCostPrice);
      const buyCost = decimal(event.position.averageCostPrice).times(event.position.quantity);
      const nextUnits = totalUnits.plus(event.position.quantity);

      averageCostPrice = nextUnits.greaterThan(0)
        ? existingCost.plus(buyCost).dividedBy(nextUnits)
        : decimal(0);
      totalUnits = nextUnits;
      continue;
    }

    const acquisition = getTradeCostBasisAcquisition(event.trade);

    if (acquisition) {
      const existingCost = totalUnits.times(averageCostPrice);
      const acquisitionCost = decimal(acquisition.pricePerUnit)
        .times(acquisition.quantity)
        .plus(acquisition.fees);
      const nextUnits = totalUnits.plus(acquisition.quantity);

      averageCostPrice = nextUnits.greaterThan(0)
        ? existingCost.plus(acquisitionCost).dividedBy(nextUnits)
        : decimal(0);
      totalUnits = nextUnits;
      continue;
    }

    const quantityDelta = getTradeQuantityDelta(event.trade);

    if (quantityDelta > 0) {
      // Uncosted transfer-ins remain visible in quantity while later import
      // reconciliation prevents them from being committed as complete history.
      const knownCost = totalUnits.times(averageCostPrice);
      basisKnown = false;
      totalUnits = totalUnits.plus(quantityDelta);
      averageCostPrice = totalUnits.greaterThan(0)
        ? knownCost.dividedBy(totalUnits)
        : decimal(0);
      continue;
    }

    const remainingUnits = totalUnits.plus(quantityDelta);
    if (remainingUnits.isNegative()) {
      basisKnown = false;
      chronologyKnown = false;
    }
    if (event.trade.type === "sell") {
      // The saved total is net of sale fees; purchase fees are already in basis.
      saleGains[event.trade.id] = basisKnown
        ? normalizeMoney(decimal(event.trade.totalValue).minus(
            averageCostPrice.times(event.trade.quantity),
          ))
        : null;
    }
    totalUnits = remainingUnits.isNegative() ? decimal(0) : remainingUnits;

    if (totalUnits.isZero()) {
      averageCostPrice = decimal(0);
      // A verified full exit ends uncertain basis, but cannot repair bad dates.
      basisKnown = chronologyKnown;
    }
  }

  return { averageCostPrice, totalUnits, saleGains };
}

export function calculateRecordedSaleGains({
  assets, openingPositions, trades, now = new Date(),
}: { assets: Asset[]; openingPositions: OpeningPosition[]; trades: Trade[]; now?: Date }) {
  const gains: Record<string, number | null> = {};
  for (const asset of assets) {
    if (!isV1SupportedAsset(asset)) continue;
    Object.assign(gains, calculatePositionAccounting({
      stockSplits: asset.stockSplits,
      through: formatLocalCalendarDate(now),
      openingPositions: openingPositions.filter((position) =>
        position.assetId === asset.id &&
        (getOpeningPositionHistoryDate(position) === null || isOpeningPositionEffective(position, now))),
      trades: trades.filter((trade) =>
        trade.assetId === asset.id &&
        (getCalendarDatePart(trade.date) === null || isEffectiveCalendarDate(trade.date, now))),
    }).saleGains);
  }
  return gains;
}

export function calculateHolding({
  asset,
  currentPrice,
  openingPositions = [],
  trades,
  valuation,
  through,
}: CalculateHoldingInput): Holding {
  const { averageCostPrice, totalUnits } = calculatePositionAccounting({
    openingPositions,
    trades,
    stockSplits: asset.stockSplits,
    through,
  });

  const totalInvested = totalUnits.times(averageCostPrice);
  const resolvedValuation: HoldingValuation =
    valuation ??
    (currentPrice === null
      ? { status: "pending" }
      : {
          asOf: null,
          currency: asset.currency,
          price: currentPrice,
          source: "manual",
          status: "manual",
        });
  const currentValue =
    currentPrice === null ? null : totalUnits.times(currentPrice);
  const unrealisedPnL =
    currentValue === null ? null : currentValue.minus(totalInvested);
  const unrealisedPnLPct =
    unrealisedPnL === null
      ? null
      : totalInvested.isZero()
        ? decimal(0)
        : unrealisedPnL.dividedBy(totalInvested).times(100);

  return {
    asset,
    averageCostPrice: normalizeUnitPrice(averageCostPrice),
    calculationBasis: {
      averageCostPrice: averageCostPrice.toString(),
      ...(currentValue === null ? {} : { currentValue: currentValue.toString() }),
      totalInvested: totalInvested.toString(),
      totalUnits: totalUnits.toString(),
      ...(unrealisedPnL === null
        ? {}
        : { unrealisedPnL: unrealisedPnL.toString() }),
    },
    currentPrice:
      currentPrice === null ? null : normalizeUnitPrice(currentPrice),
    currentValue: currentValue === null ? null : normalizeMoney(currentValue),
    totalInvested: normalizeMoney(totalInvested),
    totalUnits: normalizeQuantity(totalUnits),
    unrealisedPnL:
      unrealisedPnL === null ? null : normalizeMoney(unrealisedPnL),
    unrealisedPnLPct:
      unrealisedPnLPct === null
        ? null
        : normalizePercentage(unrealisedPnLPct),
    valuation: resolvedValuation,
  };
}

export function calculateHoldings({
  assets,
  now = new Date(),
  openingPositions = [],
  quoteCache,
  trades,
}: CalculateHoldingsInput) {
  return assets
    .map((asset) => {
      const quote = quoteCache[asset.id];

      if (!isV1CompatibleQuote(asset, quote)) {
        return null;
      }

      const assetOpeningPositions = openingPositions.filter(
        (position) =>
          position.assetId === asset.id &&
          isOpeningPositionEffective(position, now),
      );
      const assetTrades = trades.filter(
        (trade) =>
          trade.assetId === asset.id &&
          isEffectiveCalendarDate(trade.date, now) &&
          isTransactionAfterOpeningCutover(trade.date, assetOpeningPositions),
      );

      if (assetTrades.length === 0 && assetOpeningPositions.length === 0) {
        return null;
      }

      const latestManualValuation = [...assetOpeningPositions]
        .filter((position) => position.manualValuation !== undefined)
        .sort(
          (left, right) =>
            (
              right.manualValuation?.asOf ??
              getOpeningPositionHistoryDate(right) ??
              ""
            ).localeCompare(
              left.manualValuation?.asOf ??
                getOpeningPositionHistoryDate(left) ??
                "",
            ),
        )[0]?.manualValuation;
      const latestLegacyPrice = [...assetOpeningPositions]
        .filter((position) => position.currentPrice !== undefined)
        .sort((left, right) =>
          (getOpeningPositionHistoryDate(right) ?? "").localeCompare(
            getOpeningPositionHistoryDate(left) ?? "",
          ),
        )[0]?.currentPrice;
      const currentPrice =
        quote?.price ??
        latestManualValuation?.price ??
        latestLegacyPrice ??
        null;
      const valuation: HoldingValuation = quote
        ? {
            asOf: quote.asOf,
            currency: quote.currency,
            price: quote.price,
            source: quote.source,
            status: quote.source === "manual" ? "manual" : "fetched",
          }
        : latestManualValuation
          ? {
              asOf: latestManualValuation.asOf,
              currency: latestManualValuation.currency,
              price: latestManualValuation.price,
              source: "manual",
              status: "manual",
            }
          : latestLegacyPrice !== undefined
            ? {
                asOf: null,
                currency: asset.currency,
                price: latestLegacyPrice,
                source: "manual",
                status: "manual",
              }
            : { status: "pending" };
      const holding = calculateHolding({
        through: formatLocalCalendarDate(now),
        asset,
        currentPrice,
        openingPositions: assetOpeningPositions,
        trades: assetTrades,
        valuation,
      });

      return holding.totalUnits > 0 ? holding : null;
    })
    .filter((holding): holding is Holding => holding !== null);
}

export function calculateCashBalance(
  cashEntries: CashEntry[],
  now = new Date(),
) {
  const balance = cashEntries
    .filter((entry) => isEffectiveCalendarDate(entry.date, now))
    .reduce(
      (balance, entry) =>
        entry.type === "withdrawal"
          ? balance.minus(entry.amount)
          : balance.plus(entry.amount),
      decimal(0),
    );

  return balance.toNumber();
}

function isSameMonth(isoDate: string, now: Date) {
  const recordMonth = getCalendarDatePart(isoDate)?.slice(0, 7);
  const currentMonth = `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}`;

  return recordMonth === currentMonth;
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
  const monthlyEntries = cashEntries.filter(
    (entry) =>
      isEffectiveCalendarDate(entry.date, now) && isSameMonth(entry.date, now),
  );
  const income = sumFinancialValues(
    monthlyEntries
      .filter(
        (entry) => entry.type === "addition" && entry.purpose === "income",
      )
      .map((entry) => entry.amount),
  );
  const contributions = sumFinancialValues(
    monthlyEntries
      .filter(
        (entry) =>
          entry.type === "addition" &&
          entry.purpose === "capitalContribution",
      )
      .map((entry) => entry.amount),
  );
  const legacyAdded = sumFinancialValues(
    monthlyEntries
      .filter(
        (entry) =>
          entry.type === "addition" &&
          entry.purpose === "legacyUncategorized",
      )
      .map((entry) => entry.amount),
  );
  const monthlyBuyTrades = trades
    .filter(isTradeCashPurchase)
    .filter(
      (trade) =>
        isEffectiveCalendarDate(trade.date, now) &&
        isSameMonth(trade.date, now) &&
        isTransactionAfterOpeningCutover(
          trade.date,
          openingPositions.filter(
            (position) => position.assetId === trade.assetId,
          ),
        ),
    );
  const allBuyTradeIds = new Set(
    trades.filter(isTradeCashPurchase).map((trade) => trade.id),
  );
  const investedFromTrades = sumFinancialValues(
    monthlyBuyTrades.map((trade) => trade.totalValue),
  );
  const unmatchedPurchaseFunding = sumFinancialValues(
    monthlyEntries
      .filter(
        (entry) =>
          entry.type === "withdrawal" &&
          entry.purpose === "purchaseFunding" &&
          (!entry.linkedTradeId || !allBuyTradeIds.has(entry.linkedTradeId)),
      )
      .map((entry) => entry.amount),
  );
  const invested = investedFromTrades.plus(unmatchedPurchaseFunding);
  const incomeStatus =
    income.greaterThan(0) && legacyAdded.isZero()
      ? "available"
      : "unavailable";

  return {
    added: normalizeMoney(income.plus(contributions).plus(legacyAdded)),
    available: calculateCashBalance(cashEntries, now),
    contributions: normalizeMoney(contributions),
    income: normalizeMoney(income),
    incomeStatus,
    investmentRate:
      incomeStatus === "available"
        ? round(invested.dividedBy(income).times(100).toNumber())
        : null,
    invested: normalizeMoney(invested),
  };
}

export function calculatePortfolioTotal(
  holdings: Holding[],
  cashEntries: CashEntry[],
  now = new Date(),
  ppfConfirmedBalance = 0,
) {
  if (holdings.some((holding) => holding.valuation.status === "pending")) {
    return null;
  }

  const holdingsValue = sumFinancialValues(
    holdings.map(
      (holding) =>
        holding.calculationBasis?.currentValue ?? holding.currentValue ?? 0,
    ),
  );

  return normalizeMoney(
    holdingsValue
      .plus(calculateCashBalance(cashEntries, now))
      .plus(ppfConfirmedBalance),
  );
}

export function calculatePortfolioDayChange(
  holdings: Holding[],
): PortfolioDayChange {
  const valuedHoldings = holdings.filter(
    (holding) => holding.valuation.status !== "pending",
  );
  const currentValue = sumFinancialValues(
    valuedHoldings.map(
      (holding) =>
        holding.calculationBasis?.currentValue ?? holding.currentValue ?? 0,
    ),
  );
  const absolute = valuedHoldings.reduce((total, holding) => {
    if (!holding.dayChangePct) return total;

    const preciseCurrentValue = decimal(
      holding.calculationBasis?.currentValue ?? holding.currentValue ?? 0,
    );
    const changeMultiplier = decimal(1).plus(
      decimal(holding.dayChangePct).dividedBy(100),
    );
    if (changeMultiplier.lessThanOrEqualTo(0)) return total;

    const previousValue = preciseCurrentValue.dividedBy(changeMultiplier);

    return total.plus(preciseCurrentValue.minus(previousValue));
  }, decimal(0));
  const previousValue = currentValue.minus(absolute);
  const percentage = previousValue.isZero()
    ? decimal(0)
    : absolute.dividedBy(previousValue).times(100);

  return {
    absolute: normalizeMoney(absolute),
    percentage: normalizePercentage(percentage),
  };
}

export function calculateAllocation({
  cashBalance,
  holdings,
  ppfConfirmedBalance = 0,
}: {
  cashBalance: number;
  holdings: Holding[];
  ppfConfirmedBalance?: number;
}): AllocationItem[] {
  if (holdings.some((holding) => holding.valuation.status === "pending")) {
    return [];
  }

  const values = new Map<AssetClass, FinancialDecimalInstance>();

  for (const holding of holdings) {
    values.set(
      holding.asset.assetClass,
      decimal(values.get(holding.asset.assetClass) ?? 0).plus(
        holding.calculationBasis?.currentValue ?? holding.currentValue ?? 0,
      ),
    );
  }

  if (ppfConfirmedBalance !== 0) {
    values.set(
      "debt",
      decimal(values.get("debt") ?? 0).plus(ppfConfirmedBalance),
    );
  }

  if (cashBalance !== 0) {
    values.set(
      "cash",
      decimal(values.get("cash") ?? 0).plus(cashBalance),
    );
  }

  const allocationValues = [...values.values()];
  const netTotal = sumFinancialValues(allocationValues);

  if (allocationValues.length === 0) {
    return [];
  }

  return [...values.entries()]
    .map(([assetClass, preciseValue]) => ({
      assetClass,
      percentage: netTotal.greaterThan(0)
        ? normalizePercentage(preciseValue.dividedBy(netTotal).times(100))
        : null,
      value: normalizeMoney(preciseValue),
    }))
    .sort((left, right) => right.value - left.value);
}

export function calculateConsolidatedHoldingRows(
  holdings: Holding[],
): ConsolidatedHoldingRow[] {
  const totalInvested = sumFinancialValues(
    holdings.map(
      (holding) =>
        holding.calculationBasis?.totalInvested ?? holding.totalInvested,
    ),
  );
  const totalCurrentValue = sumFinancialValues(
    holdings
      .filter((holding) => holding.valuation.status !== "pending")
      .map(
      (holding) =>
        holding.calculationBasis?.currentValue ?? holding.currentValue ?? 0,
      ),
  );

  return holdings
    .map((holding) => ({
      asset: holding.asset,
      assetClass: holding.asset.assetClass,
      currentAllocationPct:
        holding.valuation.status === "pending" || totalCurrentValue.isZero()
          ? null
          : round(
              decimal(
                holding.calculationBasis?.currentValue ??
                  holding.currentValue ??
                  0,
              )
                .dividedBy(totalCurrentValue)
                .times(100)
                .toNumber(),
            ),
      currentValue: holding.currentValue,
      initialAllocationPct:
        totalInvested.isZero()
          ? 0
          : round(
              decimal(
                holding.calculationBasis?.totalInvested ?? holding.totalInvested,
              )
                .dividedBy(totalInvested)
                .times(100)
                .toNumber(),
            ),
      instrumentType: holding.asset.instrumentType,
      investedValue: holding.totalInvested,
      pnl: holding.unrealisedPnL,
      pnlPct:
        holding.unrealisedPnLPct === null
          ? null
          : round(holding.unrealisedPnLPct),
      sectorType: holding.asset.sectorType,
      units: holding.totalUnits,
    }))
    .sort((left, right) => {
      if (left.currentValue === null) return 1;
      if (right.currentValue === null) return -1;
      return right.currentValue - left.currentValue;
    });
}

export function calculatePortfolioValuationCoverage(
  holdings: Holding[],
): PortfolioValuationCoverage {
  const pending = holdings.filter(
    (holding) => holding.valuation.status === "pending",
  );

  return {
    pendingAssetIds: pending.map((holding) => holding.asset.id),
    pendingHoldings: pending.length,
    pendingInvestedValue: normalizeMoney(
      sumFinancialValues(
        pending.map(
          (holding) =>
            holding.calculationBasis?.totalInvested ?? holding.totalInvested,
        ),
      ),
    ),
    status: pending.length > 0 ? "incomplete" : "complete",
    totalHoldings: holdings.length,
    valuedHoldings: holdings.length - pending.length,
  };
}

export function calculatePortfolioRollupTotals(
  rows: ConsolidatedHoldingRow[],
  cashBalance = 0,
  holdings?: Holding[],
  ppfPosition: { confirmedBalance: number; investedBasis: number } = {
    confirmedBalance: 0,
    investedBasis: 0,
  },
): PortfolioRollupTotals {
  const valuationCoverage = holdings
    ? calculatePortfolioValuationCoverage(holdings)
    : {
        pendingAssetIds: rows
          .filter((row) => row.currentValue === null)
          .map((row) => row.asset.id),
        pendingHoldings: rows.filter((row) => row.currentValue === null).length,
        pendingInvestedValue: normalizeMoney(
          sumFinancialValues(
            rows
              .filter((row) => row.currentValue === null)
              .map((row) => row.investedValue),
          ),
        ),
        status: rows.some((row) => row.currentValue === null)
          ? ("incomplete" as const)
          : ("complete" as const),
        totalHoldings: rows.length,
        valuedHoldings: rows.filter((row) => row.currentValue !== null).length,
      };
  const totalInvested = sumFinancialValues(
    holdings
      ? holdings.map(
          (holding) =>
            holding.calculationBasis?.totalInvested ?? holding.totalInvested,
        )
      : rows.map((row) => row.investedValue),
  ).plus(ppfPosition.investedBasis);
  const holdingsCurrentValue = sumFinancialValues(
    holdings
      ? holdings
          .filter((holding) => holding.valuation.status !== "pending")
          .map(
          (holding) =>
            holding.calculationBasis?.currentValue ?? holding.currentValue ?? 0,
          )
      : rows.map((row) => row.currentValue ?? 0),
  ).plus(ppfPosition.confirmedBalance);
  const pnl = holdingsCurrentValue.minus(totalInvested);
  const complete = valuationCoverage.status === "complete";

  return {
    cashBalance,
    holdingsCurrentValue: complete ? normalizeMoney(holdingsCurrentValue) : null,
    pnl: complete ? normalizeMoney(pnl) : null,
    pnlPct: complete
      ? totalInvested.isZero()
        ? 0
        : round(pnl.dividedBy(totalInvested).times(100).toNumber())
      : null,
    totalCurrentValue: complete
      ? normalizeMoney(holdingsCurrentValue.plus(cashBalance))
      : null,
    totalInvested: normalizeMoney(totalInvested),
    valuationCoverage,
    valuedHoldingsSubtotal: normalizeMoney(holdingsCurrentValue),
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
      const assetTotal = sumFinancialValues([
        snapshot.equityValue,
        snapshot.debtValue,
        snapshot.cryptoValue,
        snapshot.cashValue,
      ]);
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
            assetTotal.isZero()
              ? 0
              : round(
                  decimal(item.value)
                    .dividedBy(assetTotal)
                    .times(100)
                    .toNumber(),
                ),
        }))
        .sort((left, right) => right.value - left.value);

      return {
        assetSnapshot,
        expenseRate:
          !snapshot.salary || snapshot.monthlyExpense === undefined
            ? null
            : round(
                decimal(snapshot.monthlyExpense)
                  .dividedBy(snapshot.salary)
                  .times(100)
                  .toNumber(),
              ),
        performance: calculateMonthlyPerformance(previous, snapshot),
        savingsRate:
          !snapshot.salary
            ? null
            : round(
                decimal(snapshot.monthlyInvestment)
                  .dividedBy(snapshot.salary)
                  .times(100)
                  .toNumber(),
              ),
        snapshot,
      };
    })
    .sort((left, right) => right.snapshot.month.localeCompare(left.snapshot.month));
}

export function calculateMetadataAllocation(
  holdings: Holding[],
  metadataKey: "instrumentType" | "sectorType",
): MetadataAllocationItem[] {
  if (holdings.some((holding) => holding.valuation.status === "pending")) {
    return [];
  }

  const values = new Map<string, FinancialDecimalInstance>();

  for (const holding of holdings) {
    const label = holding.asset[metadataKey] ?? "other";

    values.set(
      label,
      decimal(values.get(label) ?? 0).plus(
        holding.calculationBasis?.currentValue ?? holding.currentValue ?? 0,
      ),
    );
  }

  const total = sumFinancialValues([...values.values()]);

  if (total.isZero()) {
    return [];
  }

  return [...values.entries()]
    .map(([label, preciseValue]) => ({
      label,
      percentage: normalizePercentage(
        preciseValue.dividedBy(total).times(100),
      ),
      value: normalizeMoney(preciseValue),
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
    ...trades
      .filter((trade) => trade.type === "buy" || trade.type === "sell")
      .map((trade) => trade.conviction),
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
