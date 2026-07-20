import type {
  Asset,
  CashEntry,
  HistoricalPriceBasis,
  HistoricalQuoteCache,
  MonthlySnapshot,
  OpeningPosition,
  QuoteCache,
  Trade,
} from "@/src/types";
import { historicalQuoteCacheKey } from "@/src/types";
import {
  isV1CompatibleQuote,
  isV1SupportedAsset,
} from "@/src/domain/portfolioCurrency";

import {
  calculateCashBalance,
  calculateHoldings,
  calculatePortfolioTotal,
} from "./holdings";
import { buildMonthlyPerformanceBasis } from "./monthlyPerformance";

export type GeneratedSnapshotStatus =
  | "already-exists"
  | "created"
  | "insufficient-data";

export type GeneratedMonthEndSnapshotResult = {
  snapshot: MonthlySnapshot | null;
  status: GeneratedSnapshotStatus;
  warnings: string[];
};

export type BuildGeneratedMonthEndSnapshotInput = {
  assets: Asset[];
  cashEntries: CashEntry[];
  existingSnapshots: MonthlySnapshot[];
  historicalQuotes: HistoricalQuoteCache;
  now: Date;
  openingPositions: OpeningPosition[];
  quoteCache: QuoteCache;
  trades: Trade[];
};

type PriceSelectionBasis = HistoricalPriceBasis;

type PriceSelection = {
  basis: PriceSelectionBasis;
  price?: number;
};

function formatMonth(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function getMonthEndDate(targetMonth: string) {
  const [yearValue, monthValue] = targetMonth.split("-");
  const year = Number(yearValue);
  const monthIndex = Number(monthValue) - 1;

  return new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
}

function getUtcMonthKey(isoDate: string) {
  return formatMonth(new Date(isoDate));
}

function isWithinMonth(isoDate: string, targetMonth: string) {
  return getUtcMonthKey(isoDate) === targetMonth;
}

function isOnOrBefore(isoDate: string, maxDate: Date) {
  return new Date(isoDate).getTime() <= maxDate.getTime();
}

function toSnapshotPriceBasis(
  bases: PriceSelectionBasis[],
): MonthlySnapshot["generated"] extends infer T
  ? T extends { priceBasis: infer P }
    ? P
    : never
  : never {
  if (bases.length === 0) {
    return "unavailable";
  }

  const normalized = new Set(
    bases.map((basis) =>
      basis === "cached-historical-close" ? "historical-close" : basis,
    ),
  );

  if (normalized.size === 1) {
    return [...normalized][0] as
      | "historical-close"
      | "latest-local-fallback"
      | "manual-fallback"
      | "unavailable";
  }

  if (
    normalized.has("unavailable") &&
    normalized.size === 1
  ) {
    return "unavailable";
  }

  return "mixed";
}

function formatHoldingWarning(count: number, message: string) {
  const label = count === 1 ? "holding" : "holdings";

  return `${count} ${label} ${message}.`;
}

function buildWarnings(bases: PriceSelectionBasis[]) {
  const counts = bases.reduce(
    (summary, basis) => {
      if (basis === "latest-local-fallback") {
        summary.latestLocalFallback += 1;
      } else if (basis === "manual-fallback") {
        summary.manualFallback += 1;
      } else if (basis === "unavailable") {
        summary.unavailable += 1;
      }

      return summary;
    },
    {
      latestLocalFallback: 0,
      manualFallback: 0,
      unavailable: 0,
    },
  );
  const warnings: string[] = [];

  if (counts.latestLocalFallback > 0) {
    warnings.push(
      formatHoldingWarning(
        counts.latestLocalFallback,
        "used latest local fallback",
      ),
    );
  }

  if (counts.manualFallback > 0) {
    warnings.push(
      formatHoldingWarning(counts.manualFallback, "used manual price fallback"),
    );
  }

  if (counts.unavailable > 0) {
    warnings.push(
      formatHoldingWarning(counts.unavailable, "could not be priced"),
    );
  }

  return warnings;
}

function selectAssetPrice({
  asset,
  historicalQuotes,
  openingPositions,
  quoteCache,
  targetMonth,
}: {
  asset: Asset;
  historicalQuotes: HistoricalQuoteCache;
  openingPositions: OpeningPosition[];
  quoteCache: QuoteCache;
  targetMonth: string;
}): PriceSelection {
  const historicalQuote =
    historicalQuotes[historicalQuoteCacheKey(asset.id, targetMonth)];

  if (historicalQuote && isV1CompatibleQuote(asset, historicalQuote)) {
    return {
      basis: historicalQuote.basis,
      price: historicalQuote.price,
    };
  }

  const latestQuote = quoteCache[asset.id];

  if (latestQuote && isV1CompatibleQuote(asset, latestQuote)) {
    return {
      basis: "latest-local-fallback",
      price: latestQuote.price,
    };
  }

  const latestManualPrice = [...openingPositions]
    .filter((position) => position.currentPrice !== undefined)
    .sort(
      (left, right) =>
        new Date(right.date).getTime() - new Date(left.date).getTime(),
    )[0]?.currentPrice;

  if (latestManualPrice !== undefined) {
    return {
      basis: "manual-fallback",
      price: latestManualPrice,
    };
  }

  return { basis: "unavailable" };
}

export function getPreviousCompletedMonth(now: Date) {
  return formatMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)));
}

export function buildGeneratedMonthEndSnapshot({
  assets,
  cashEntries,
  existingSnapshots,
  historicalQuotes,
  now,
  openingPositions,
  quoteCache,
  trades,
}: BuildGeneratedMonthEndSnapshotInput): GeneratedMonthEndSnapshotResult {
  const targetMonth = getPreviousCompletedMonth(now);
  const existingSnapshot = existingSnapshots.find(
    (snapshot) => snapshot.month === targetMonth,
  );

  if (existingSnapshot) {
    return {
      snapshot: existingSnapshot,
      status: "already-exists",
      warnings: [],
    };
  }

  if (
    openingPositions.length === 0 &&
    trades.length === 0 &&
    cashEntries.length === 0
  ) {
    return {
      snapshot: null,
      status: "insufficient-data",
      warnings: [
        "No holdings, trades, or cash entries were available to generate the previous month-end snapshot.",
      ],
    };
  }

  const monthEnd = getMonthEndDate(targetMonth);
  const supportedAssetIds = new Set(
    assets.filter(isV1SupportedAsset).map((asset) => asset.id),
  );
  const monthOpeningPositions = openingPositions.filter(
    (position) =>
      supportedAssetIds.has(position.assetId) &&
      isOnOrBefore(position.date, monthEnd),
  );
  const monthTrades = trades.filter(
    (trade) =>
      supportedAssetIds.has(trade.assetId) &&
      isOnOrBefore(trade.date, monthEnd),
  );
  const monthCashEntries = cashEntries.filter((entry) =>
    isOnOrBefore(entry.date, monthEnd),
  );

  if (
    monthOpeningPositions.length === 0 &&
    monthTrades.length === 0 &&
    monthCashEntries.length === 0
  ) {
    return {
      snapshot: null,
      status: "insufficient-data",
      warnings: [
        `No holdings, trades, or cash entries were available to derive for target month ${targetMonth}.`,
      ],
    };
  }

  const relevantAssets = assets.filter((asset) => {
    if (!supportedAssetIds.has(asset.id)) {
      return false;
    }

    const hasOpeningPosition = monthOpeningPositions.some(
      (position) => position.assetId === asset.id,
    );
    const hasTrade = monthTrades.some((trade) => trade.assetId === asset.id);

    return hasOpeningPosition || hasTrade;
  });
  const priceSelectionsByAssetId = new Map(
    relevantAssets.map((asset) => [
      asset.id,
      selectAssetPrice({
        asset,
        historicalQuotes,
        openingPositions: monthOpeningPositions.filter(
          (position) => position.assetId === asset.id,
        ),
        quoteCache,
        targetMonth,
      }),
    ]),
  );
  const snapshotQuoteCache = relevantAssets.reduce<QuoteCache>((cache, asset) => {
    const selection = priceSelectionsByAssetId.get(asset.id);

    if (!selection || selection.price === undefined) {
      return cache;
    }

    cache[asset.id] = {
      assetId: asset.id,
      asOf: now.toISOString(),
      currency: asset.currency,
      price: selection.price,
      source: "manual",
    };

    return cache;
  }, {});
  const holdings = calculateHoldings({
    assets: relevantAssets,
    openingPositions: monthOpeningPositions,
    quoteCache: snapshotQuoteCache,
    trades: monthTrades,
  });
  const pricedAssets = holdings.map((holding) => ({
    asset: holding.asset,
    selection:
      priceSelectionsByAssetId.get(holding.asset.id) ?? {
        basis: "unavailable" as const,
      },
  }));
  const cashValue = calculateCashBalance(monthCashEntries);
  const equityValue = holdings.reduce((total, holding) => {
    if (
      holding.asset.assetClass === "stock" ||
      holding.asset.assetClass === "etf"
    ) {
      return total + holding.currentValue;
    }

    return total;
  }, 0);
  const debtValue = holdings.reduce((total, holding) => {
    if (holding.asset.assetClass === "debt") {
      return total + holding.currentValue;
    }

    return total;
  }, 0);
  const cryptoValue = holdings.reduce((total, holding) => {
    if (holding.asset.assetClass === "crypto") {
      return total + holding.currentValue;
    }

    return total;
  }, 0);
  const priceBases = pricedAssets.map((item) => item.selection.basis);
  const warnings = buildWarnings(priceBases);
  const snapshot: MonthlySnapshot = {
    cashValue,
    cryptoValue,
    debtValue,
    equityValue,
    generated: {
      generatedAt: now.toISOString(),
      priceBasis: toSnapshotPriceBasis(priceBases),
      source: "auto",
      warnings,
    },
    id: `snapshot-${targetMonth}`,
    investedValue: holdings.reduce(
      (total, holding) => total + holding.totalInvested,
      0,
    ),
    month: targetMonth,
    monthlyInvestment:
      monthOpeningPositions
        .filter((position) => isWithinMonth(position.date, targetMonth))
        .reduce(
          (total, position) =>
            total + position.quantity * position.averageCostPrice,
          0,
        ) +
      monthTrades
        .filter(
          (trade) =>
            trade.type === "buy" && isWithinMonth(trade.date, targetMonth),
        )
        .reduce((total, trade) => total + trade.totalValue, 0),
    performanceBasis: buildMonthlyPerformanceBasis({
      cashEntries: monthCashEntries,
      openingPositions: monthOpeningPositions,
      targetMonth,
    }),
    portfolioValue: calculatePortfolioTotal(holdings, monthCashEntries),
    salary: 0,
  };

  return {
    snapshot,
    status: "created",
    warnings,
  };
}
