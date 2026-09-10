import { validateBackupPayload } from "@/src/domain/portfolioBackup";
import {
  calculateHoldings,
} from "@/src/domain/calculations";
import { calculateRecordedSaleGains } from "@/src/domain/calculations/holdings";
import {
  buildAssetHistory,
  downsampleAssetHistory,
} from "@/src/domain/calculations/assetHistory";
import {
  createV3ScaleFixture,
  runV3ScaleFixtureBenchmark,
  v3ScaleFixtureAssetCount,
  v3ScaleFixtureSnapshotCount,
  v3ScaleFixtureTradeCount,
} from "@/src/testing/v3ScaleFixture";

describe("V3 scale fixture", () => {
  it("builds deterministic, linked raw portfolio and daily-history inputs", () => {
    const fixture = createV3ScaleFixture();
    const { portfolio } = fixture;

    expect(portfolio.assets).toHaveLength(v3ScaleFixtureAssetCount);
    expect(portfolio.trades).toHaveLength(v3ScaleFixtureTradeCount);
    expect(portfolio.monthlySnapshots).toHaveLength(v3ScaleFixtureSnapshotCount);
    expect(fixture.dailyPriceEntries).toHaveLength(10);
    expect(fixture.dailyPriceEntries.every((entry) => entry.points.length > 0)).toBe(true);
    expect(fixture.dailyPriceEntries.every((entry) => entry.points.length === 3_653)).toBe(true);
    expect(
      fixture.dailyPriceEntries.every((entry) =>
        portfolio.assets.some((asset) => asset.quoteSourceId === entry.providerId),
      ),
    ).toBe(true);
    expect(portfolio.monthlySnapshots.map((snapshot) => snapshot.month)).toEqual(
      [...portfolio.monthlySnapshots.map((snapshot) => snapshot.month)].sort(),
    );
    expect(portfolio.monthlySnapshots.every((snapshot) =>
      Number.isFinite(snapshot.portfolioValue) &&
      snapshot.portfolioValue ===
        snapshot.cashValue + snapshot.cryptoValue + snapshot.debtValue + snapshot.equityValue,
    )).toBe(true);

    expect(validateBackupPayload({
      casFolioSalt: null,
      historicalQuoteCache: {},
      portfolio,
      quoteCache: fixture.quoteCache,
    }).portfolio).toEqual(portfolio);
  });

  it("exercises holdings, sale gains, chart transforms, and bounded history sampling", () => {
    const fixture = createV3ScaleFixture();
    const result = runV3ScaleFixtureBenchmark(fixture);
    const holdings = calculateHoldings({
      assets: fixture.portfolio.assets,
      now: fixture.now,
      openingPositions: fixture.portfolio.openingPositions,
      quoteCache: fixture.quoteCache,
      trades: fixture.portfolio.trades,
    });
    const saleGains = calculateRecordedSaleGains({
      assets: fixture.portfolio.assets,
      now: fixture.now,
      openingPositions: fixture.portfolio.openingPositions,
      trades: fixture.portfolio.trades,
    });
    const firstEntry = fixture.dailyPriceEntries[0];
    const firstAsset = fixture.portfolio.assets.find(
      (asset) => asset.quoteSourceId === firstEntry.providerId,
    );
    expect(firstAsset).toBeDefined();

    const history = buildAssetHistory({
      asset: firstAsset!,
      entry: firstEntry,
      openingPositions: fixture.portfolio.openingPositions,
      trades: fixture.portfolio.trades,
    });
    const sampled = downsampleAssetHistory(history.points);
    expect(history.points).toHaveLength(3_653);
    expect(sampled.length).toBeLessThanOrEqual(500);
    expect(sampled[0]).toEqual(history.points[0]);
    expect(sampled.at(-1)).toEqual(history.points.at(-1));
    expect(result.holdings.holdingCount).toBe(v3ScaleFixtureAssetCount);
    expect(result.recordedSaleGains.gainCount).toBe(v3ScaleFixtureAssetCount * 2);
    expect(holdings.every((holding) => holding.totalUnits === 15 && Number.isFinite(holding.totalInvested))).toBe(true);
    expect(Object.values(saleGains).every((gain) => typeof gain === "number" && Number.isFinite(gain))).toBe(true);
    expect(result.monthlyChart.pointCount).toBe(v3ScaleFixtureSnapshotCount);
    expect(result.assetHistories.sampledPointCount).toBeLessThanOrEqual(5_000);
    expect(Object.values(result).every((phase) => phase.milliseconds >= 0)).toBe(true);

    if (process.env.COGVEST_V3_BENCHMARK === "1") {
      console.info("[v3-scale-fixture] raw-pc-timings", JSON.stringify(result));
    }
  });
});
