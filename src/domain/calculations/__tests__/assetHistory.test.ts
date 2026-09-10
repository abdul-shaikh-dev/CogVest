import { buildAssetHistory, downsampleAssetHistory } from "../assetHistory";
import type { DailyPriceEntry } from "@/src/services/quotes/dailyPriceCache";
import type { Asset, OpeningPosition, Trade } from "@/src/types";

const asset: Asset = { assetClass: "stock", currency: "INR", exchange: "NSE", id: "asset", name: "Asset", symbol: "ASSET", ticker: "ASSET.NS" };
const opening: OpeningPosition = { assetId: asset.id, averageCostPrice: 100, date: "2026-01-02", id: "opening", quantity: 10 };
function entry(points = [{ date: "2026-01-01", close: 100 }, { date: "2026-01-02", close: 110 }, { date: "2026-01-03", close: 120 }]): DailyPriceEntry {
  return { basis: "close", complete: true, currency: "INR", fetchedAt: "2026-09-10T00:00:00.000Z", from: points[0].date, points, provider: "yahoo", providerId: "ASSET.NS", to: points.at(-1)!.date };
}
function trade(type: Trade["type"], date: string, quantity: number): Trade {
  return type === "buy" || type === "sell"
    ? { assetId: asset.id, date, id: `${type}-${date}`, pricePerUnit: 100, quantity, totalValue: quantity * 100, type }
    : { assetId: asset.id, date, id: `${type}-${date}`, quantity, type };
}

describe("asset history", () => {
  it("applies opening quantities and post-cutover trades at end of day", () => {
    const result = buildAssetHistory({ asset, entry: entry(), openingPositions: [{ ...opening, measuredAsOf: "2026-01-02" }], trades: [trade("buy", "2026-01-03", 5), trade("sell", "2026-01-03", 3), trade("transferIn", "2026-01-03", 2), trade("transferOut", "2026-01-03", 1)] });
    expect(result.points.map((point) => point.holdingValue)).toEqual([null, 1100, 1560]);
  });

  it("aggregates same-day deltas before evaluating negative quantity", () => {
    const result = buildAssetHistory({
      asset,
      entry: entry(),
      openingPositions: [],
      trades: [
        trade("buy", "2026-01-02", 1),
        trade("sell", "2026-01-02", 1),
      ],
    });

    expect(result.warning).toBeNull();
    expect(result.points.map((point) => point.holdingValue)).toEqual([null, 0, 0]);
  });

  it("keeps unknown openings, no prior ownership, negative quantities, and currency mismatch honest", () => {
    expect(buildAssetHistory({ asset, entry: entry(), openingPositions: [{ ...opening, date: null }], trades: [] }).points.every((point) => point.holdingValue === null)).toBe(true);
    expect(buildAssetHistory({ asset, entry: entry(), openingPositions: [], trades: [trade("buy", "2026-01-03", 1)] }).points.map((point) => point.holdingValue)).toEqual([null, null, 120]);
    expect(buildAssetHistory({ asset, entry: entry(), openingPositions: [], trades: [trade("sell", "2026-01-01", 1)] }).warning).toContain("negative");
    expect(buildAssetHistory({ asset, entry: entry(), openingPositions: [], trades: [{ ...trade("buy", "2026-01-03", 1), date: "not-a-date" }] }).points.every((point) => point.holdingValue === null)).toBe(true);
    expect(buildAssetHistory({ asset, entry: { ...entry(), currency: "USD" }, openingPositions: [], trades: [] }).warning).toContain("currency");
  });

  it("returns full cached history; sampling stays a separate bounded transform", () => {
    const points = Array.from({ length: 3_653 }, (_, index) => ({ date: new Date(Date.UTC(2016, 0, 1) + index * 86400000).toISOString().slice(0, 10), close: 100 + index / 10 }));
    const started = performance.now();
    const full = buildAssetHistory({ asset, entry: entry(points), openingPositions: [{ ...opening, date: "2016-01-01" }], trades: [] });
    expect(full.points).toHaveLength(3_653);
    const sampled = downsampleAssetHistory(full.points);
    const elapsed = performance.now() - started;
    if (process.env.COGVEST_HISTORY_BENCHMARK === "1") console.info("[asset-history] transform ms", elapsed);
    expect(elapsed).toBeLessThan(100);
    expect(sampled.length).toBeLessThanOrEqual(500);
    expect(sampled[0]).toBe(full.points[0]);
    expect(sampled.at(-1)).toBe(full.points.at(-1));
  });

  it("does not double-count transactions represented by an imported measured balance", () => {
    const result = buildAssetHistory({ asset, entry: entry(), openingPositions: [{ ...opening, date: "2020-01-01", measuredAsOf: "2026-01-02" }], trades: [trade("buy", "2025-12-01", 10), trade("buy", "2026-01-02", 10), trade("sell", "2026-01-03", 2)] });
    expect(result.points.map((point) => point.holdingValue)).toEqual([null, 1100, 960]);
  });
});
