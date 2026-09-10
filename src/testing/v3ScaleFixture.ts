import {
  buildMonthlyProgressChartData,
  calculateHoldings,
} from "@/src/domain/calculations";
import { calculateRecordedSaleGains } from "@/src/domain/calculations/holdings";
import {
  buildAssetHistory,
  downsampleAssetHistory,
} from "@/src/domain/calculations/assetHistory";
import { createDefaultPreferences, portfolioSchemaVersion } from "@/src/store";
import {
  createDailyPriceCacheFixture,
  dailyPriceCacheFixtureNow,
} from "@/src/testing/dailyPriceCacheFixture";
import type { Asset, MonthlySnapshot, OpeningPosition, QuoteCache, Trade } from "@/src/types";
import type { RawPortfolioSnapshot } from "@/src/store";
import type { DailyPriceEntry } from "@/src/services/quotes/dailyPriceCache";

export const v3ScaleFixtureAssetCount = 250;
export const v3ScaleFixtureTradeCount = 1_000;
export const v3ScaleFixtureSnapshotCount = 60;

export type V3ScaleFixture = {
  dailyPriceEntries: DailyPriceEntry[];
  now: Date;
  portfolio: RawPortfolioSnapshot;
  quoteCache: QuoteCache;
};

function monthAt(index: number) {
  const date = new Date(Date.UTC(2021, index, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function tradeDate(year: number) {
  return `${year}-06-15`;
}

function assetFor(index: number, dailyEntries: DailyPriceEntry[]): Asset {
  const dailyEntry = dailyEntries[index];
  const isDailyCrypto = dailyEntry?.provider === "coingecko";
  const number = String(index + 1).padStart(3, "0");

  return {
    assetClass: isDailyCrypto ? "crypto" : "stock",
    currency: "INR",
    exchange: isDailyCrypto ? "CRYPTO" : "NSE",
    id: `v3-asset-${number}`,
    instrumentType: isDailyCrypto ? "crypto" : "stock",
    name: `V3 Scale Asset ${number}`,
    quoteSourceId: dailyEntry?.providerId,
    sectorType: isDailyCrypto ? "digitalAsset" : "technology",
    symbol: `V3${number}`,
    ticker: isDailyCrypto ? `V3${number}-INR` : `V3${number}.NS`,
  };
}

function tradesFor(asset: Asset, index: number): Trade[] {
  const buyPrice = 100 + index;
  const secondBuyPrice = buyPrice + 10;
  const sellPrice = buyPrice + 20;

  return [
    {
      assetId: asset.id,
      date: tradeDate(2021),
      id: `${asset.id}-buy-1`,
      pricePerUnit: buyPrice,
      quantity: 10,
      totalValue: buyPrice * 10,
      type: "buy",
    },
    {
      assetId: asset.id,
      date: tradeDate(2022),
      fees: 1,
      id: `${asset.id}-buy-2`,
      pricePerUnit: secondBuyPrice,
      quantity: 5,
      totalValue: secondBuyPrice * 5 + 1,
      type: "buy",
    },
    {
      assetId: asset.id,
      date: tradeDate(2023),
      fees: 1,
      id: `${asset.id}-sell-1`,
      pricePerUnit: sellPrice,
      quantity: 3,
      totalValue: sellPrice * 3 - 1,
      type: "sell",
    },
    {
      assetId: asset.id,
      date: tradeDate(2024),
      id: `${asset.id}-sell-2`,
      pricePerUnit: sellPrice + 5,
      quantity: 2,
      totalValue: (sellPrice + 5) * 2,
      type: "sell",
    },
  ];
}

function openingFor(asset: Asset, index: number): OpeningPosition {
  return {
    assetId: asset.id,
    averageCostPrice: 90 + index,
    date: "2019-01-01",
    id: `${asset.id}-opening`,
    measuredAsOf: "2020-01-31",
    quantity: 5,
  };
}

function snapshots(): MonthlySnapshot[] {
  return Array.from({ length: v3ScaleFixtureSnapshotCount }, (_, index) => {
    const equityValue = 1_000_000 + index * 10_000;
    const debtValue = 250_000 + index * 2_500;
    const cryptoValue = 100_000 + index * 1_250;
    const cashValue = 50_000 + index * 500;

    return {
      cashValue,
      cryptoValue,
      debtValue,
      equityValue,
      id: `v3-snapshot-${monthAt(index)}`,
      investedValue: 900_000 + index * 8_000,
      month: monthAt(index),
      monthlyExpense: 30_000,
      monthlyInvestment: 8_000,
      portfolioValue: equityValue + debtValue + cryptoValue + cashValue,
    };
  });
}

export function createV3ScaleFixture(): V3ScaleFixture {
  const dailyPriceEntries = createDailyPriceCacheFixture();
  const assets = Array.from(
    { length: v3ScaleFixtureAssetCount },
    (_, index) => assetFor(index, dailyPriceEntries),
  );
  const openingPositions = assets.map(openingFor);
  const trades = assets.flatMap(tradesFor);
  const quoteCache = Object.fromEntries(
    assets.map((asset, index) => [
      asset.id,
      {
        assetId: asset.id,
        asOf: dailyPriceCacheFixtureNow.toISOString(),
        currency: "INR" as const,
        price: 150 + index,
        source: index < dailyPriceEntries.length
          ? dailyPriceEntries[index].provider
          : "manual" as const,
      },
    ]),
  );
  const portfolio: RawPortfolioSnapshot = {
    assets,
    cashEntries: [],
    monthlySnapshots: snapshots(),
    openingPositions,
    ppfAccounts: [],
    ppfLedgerEntries: [],
    preferences: createDefaultPreferences(),
    schemaVersion: portfolioSchemaVersion,
    trades,
  };

  return { dailyPriceEntries, now: dailyPriceCacheFixtureNow, portfolio, quoteCache };
}

function performanceNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

export type V3ScaleFixtureBenchmark = {
  assetHistories: { milliseconds: number; sampledPointCount: number };
  holdings: { milliseconds: number; holdingCount: number };
  monthlyChart: { milliseconds: number; pointCount: number };
  recordedSaleGains: { gainCount: number; milliseconds: number };
};

/** Pure desktop diagnostic only; timing values are reported, never treated as gates. */
export function runV3ScaleFixtureBenchmark(
  fixture = createV3ScaleFixture(),
): V3ScaleFixtureBenchmark {
  const { dailyPriceEntries, now, portfolio, quoteCache } = fixture;
  const holdingsStartedAt = performanceNow();
  const holdings = calculateHoldings({
    assets: portfolio.assets,
    now,
    openingPositions: portfolio.openingPositions,
    quoteCache,
    trades: portfolio.trades,
  });
  const holdingsMilliseconds = performanceNow() - holdingsStartedAt;

  const gainsStartedAt = performanceNow();
  const gains = calculateRecordedSaleGains({
    assets: portfolio.assets,
    now,
    openingPositions: portfolio.openingPositions,
    trades: portfolio.trades,
  });
  const gainsMilliseconds = performanceNow() - gainsStartedAt;

  const chartStartedAt = performanceNow();
  const chart = buildMonthlyProgressChartData(portfolio.monthlySnapshots, "All");
  const chartMilliseconds = performanceNow() - chartStartedAt;

  const historiesStartedAt = performanceNow();
  const sampledPointCount = dailyPriceEntries.reduce((count, entry, index) => {
    const asset = portfolio.assets[index];
    const history = buildAssetHistory({
      asset,
      entry,
      openingPositions: portfolio.openingPositions,
      trades: portfolio.trades,
    });
    return count + downsampleAssetHistory(history.points).length;
  }, 0);
  const historiesMilliseconds = performanceNow() - historiesStartedAt;

  return {
    assetHistories: { milliseconds: historiesMilliseconds, sampledPointCount },
    holdings: { holdingCount: holdings.length, milliseconds: holdingsMilliseconds },
    monthlyChart: { milliseconds: chartMilliseconds, pointCount: chart.monthLabels.length },
    recordedSaleGains: { gainCount: Object.keys(gains).length, milliseconds: gainsMilliseconds },
  };
}
