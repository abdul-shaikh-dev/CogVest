import { calculateHolding, calculateHoldings, calculatePositionAccounting, calculateRecordedSaleGains } from "../holdings";
import type { DemergerAdjustment } from "../../demergerEvents";
import type { Asset, OpeningPosition, Trade } from "@/src/types";

const asset: Asset = { id: "a", name: "Example", symbol: "EX", ticker: "EX.NS", assetClass: "stock", currency: "INR" };
const buy: Trade = { id: "buy", assetId: "a", type: "buy", date: "2026-01-02", quantity: 10, pricePerUnit: 100, fees: 10, totalValue: 1010 };
const sell: Trade = { id: "sell", assetId: "a", type: "sell", date: "2026-01-03", quantity: 4, pricePerUnit: 150, fees: 5, totalValue: 595 };
const opening: OpeningPosition = { id: "o", assetId: "a", date: "2026-01-01", quantity: 10, averageCostPrice: 50 };

describe("core position accounting", () => {
  it("recovers known basis only after a verified closure, not after invalid chronology", () => {
    const incoming: Trade = { id: "t", assetId: "a", type: "transferIn", date: "2025-01-01", quantity: 10 };
    const outgoing: Trade = { id: "out", assetId: "a", type: "transferOut", date: "2025-02-01", quantity: 10 };
    const trades = [incoming, outgoing, buy, sell];
    expect(calculatePositionAccounting({ trades }).saleGains.sell).toBe(191);
    expect(calculatePositionAccounting({ trades: [{ ...incoming, date: "bad" }, outgoing, buy, sell] }).saleGains.sell).toBeNull();
    expect(calculatePositionAccounting({ trades: [incoming, { ...outgoing, quantity: 11 }, buy, sell] }).saleGains.sell).toBeNull();
  });
  it("does not convert unsupported foreign gains into INR or include future sales", () => {
    const now = new Date("2026-01-04T12:00:00Z");
    expect(calculateRecordedSaleGains({ assets: [{ ...asset, currency: "USD" }], openingPositions: [], trades: [buy, sell], now })).toEqual({});
    expect(calculateRecordedSaleGains({ assets: [asset], openingPositions: [], trades: [buy, { ...sell, date: "2026-01-05" }], now })).toEqual({});
    expect(calculateRecordedSaleGains({ assets: [asset], openingPositions: [], trades: [{ ...buy, date: "invalid" }, sell], now }).sell).toBeNull();
  });
  it("conserves weighted-average basis and separates net realized from unrealized gains", () => {
    const trades = [buy, sell];
    const result = calculatePositionAccounting({ openingPositions: [opening], trades });
    const holding = calculateHolding({ asset, currentPrice: 150, openingPositions: [opening], trades });
    expect(result.saleGains.sell).toBe(293);
    expect(holding.totalUnits).toBe(16);
    expect(holding.totalInvested).toBe(1208);
    expect(holding.unrealisedPnL).toBe(1192);
    expect(holding.totalInvested + (sell.totalValue - result.saleGains.sell!)).toBe(1510);
  });

  it("rebuilds gains after corrections and deletions without retaining matches", () => {
    expect(calculatePositionAccounting({ trades: [buy, sell] }).saleGains.sell).toBe(191);
    expect(calculatePositionAccounting({ trades: [{ ...buy, pricePerUnit: 120, totalValue: 1210 }, sell] }).saleGains.sell).toBe(111);
    expect(calculatePositionAccounting({ trades: [buy] }).saleGains).toEqual({});
    expect(calculatePositionAccounting({ trades: [sell] }).saleGains.sell).toBeNull();
  });

  it("preserves deterministic same-day purchase-before-sale ordering", () => {
    const sameDaySale = { ...sell, date: buy.date };
    expect(calculatePositionAccounting({ trades: [sameDaySale, buy] }).saleGains).toEqual(
      calculatePositionAccounting({ trades: [buy, sameDaySale] }).saleGains,
    );
  });

  it("supports aggregate basis after cutover but does not invent prior gains or lot dates", () => {
    const result = calculatePositionAccounting({
      openingPositions: [{ ...opening, date: null, measuredAsOf: "2026-01-02" }],
      trades: [buy, sell, { ...sell, id: "old", date: "2026-01-01" }],
    });
    expect(result.totalUnits.toNumber()).toBe(6);
    expect(result.saleGains).toEqual({ sell: 395 });
  });

  it("does not guess gains with uncosted transfers, invalid dates, or oversells", () => {
    const uncosted: Trade = { id: "t", assetId: "a", type: "transferIn", date: "2026-01-01", quantity: 10 };
    expect(calculatePositionAccounting({ trades: [uncosted, sell] }).saleGains.sell).toBeNull();
    expect(calculatePositionAccounting({ trades: [{ ...buy, date: "bad" }, sell] }).saleGains.sell).toBeNull();
    expect(calculatePositionAccounting({ trades: [buy, { ...sell, quantity: 11 }] }).saleGains.sell).toBeNull();
  });

  it("closes fractional quantities without a residual basis and excludes transfers from gains", () => {
    const fractional = { ...buy, quantity: 0.00000003, pricePerUnit: 100000000, fees: 0, totalValue: 3 };
    const sales = [0, 1, 2].map((index): Trade => ({ ...sell, id: `s${index}`, quantity: 0.00000001, pricePerUnit: 200000000, fees: 0, totalValue: 2 }));
    const result = calculatePositionAccounting({ trades: [fractional, ...sales] });
    expect(result.totalUnits.toNumber()).toBe(0);
    expect(result.averageCostPrice.toNumber()).toBe(0);
    expect(Object.values(result.saleGains)).toEqual([1, 1, 1]);
    expect(calculatePositionAccounting({ trades: [buy, { id: "out", assetId: "a", date: sell.date, type: "transferOut", quantity: 4 }] }).saleGains).toEqual({});
  });

  it("allocates a synthetic 10k basis exactly across retained and child positions", () => {
    const retained: DemergerAdjustment = { eventId: "synthetic", assetId: "parent", date: "2026-01-02", kind: "retainedCost", retainedFraction: "0.4" };
    const entitlement: DemergerAdjustment = { eventId: "synthetic", assetId: "child", date: "2026-01-02", kind: "entitlement", quantity: 100, cost: "6000", sourceAssetId: "parent", sourceRecordIds: ["parent-buy"], firstAcquisitionDate: "2025-01-01" };
    const parent = calculatePositionAccounting({ trades: [{ ...buy, id: "parent-buy", assetId: "parent", date: "2025-01-01", quantity: 100, fees: 0, totalValue: 10000 }], demergerAdjustments: [retained] });
    const child = calculatePositionAccounting({ trades: [], demergerAdjustments: [entitlement] });

    expect(parent.totalUnits.toString()).toBe("100");
    expect(parent.totalUnits.times(parent.averageCostPrice).toString()).toBe("4000");
    expect(child.totalUnits.toString()).toBe("100");
    expect(child.totalUnits.times(child.averageCostPrice).toString()).toBe("6000");
  });

  it("projects catalog children with no raw child trades into holdings and sale gains", () => {
    const parent: Asset = { ...asset, id: "ril", isin: "INE002A01018", demerger: { eventId: "RELIANCE-JIOFIN-2023-v1", childAssetId: "jio" } };
    const child: Asset = { ...asset, id: "jio", isin: "INE758E01017", symbol: "JIOFIN", ticker: "JIOFIN.NS" };
    const parentBuy: Trade = { ...buy, id: "ril-buy", assetId: parent.id, date: "2023-01-01", quantity: 100, fees: 0, totalValue: 10000 };
    const childSale: Trade = { ...sell, id: "jio-sale", assetId: child.id, date: "2023-09-01", quantity: 10, fees: 0, totalValue: 1000 };
    const holdings = calculateHoldings({
      assets: [parent, child],
      openingPositions: [],
      trades: [parentBuy],
      quoteCache: {
        ril: { assetId: "ril", asOf: "2023-07-19T12:00:00Z", currency: "INR", price: 100, source: "yahoo" },
        jio: { assetId: "jio", asOf: "2023-08-20T12:00:00Z", currency: "INR", price: 100, source: "yahoo" },
      },
      now: new Date("2023-09-01T12:00:00Z"),
    });

    expect(holdings.map((holding) => [holding.asset.id, holding.totalUnits, holding.totalInvested])).toEqual([
      ["ril", 100, 9532],
      ["jio", 100, 468],
    ]);
    expect(holdings.every((holding) => holding.valuation.status === "pending")).toBe(true);
    expect(calculateRecordedSaleGains({ assets: [parent, child], openingPositions: [], trades: [parentBuy, childSale], now: new Date("2023-09-02T12:00:00Z") })[childSale.id]).toBe(953.2);
  });

  it("does not use stale manual or legacy opening prices across demerger boundaries", () => {
    const parent: Asset = { ...asset, id: "ril", isin: "INE002A01018", demerger: { eventId: "RELIANCE-JIOFIN-2023-v1", childAssetId: "jio" } };
    const child: Asset = { ...asset, id: "jio", isin: "INE758E01017", symbol: "JIOFIN", ticker: "JIOFIN.NS" };
    const parentOpening: OpeningPosition = {
      ...opening,
      id: "ril-opening",
      assetId: parent.id,
      date: "2023-01-01",
      measuredAsOf: "2023-01-01",
      currentPrice: 120,
      manualValuation: { asOf: "2023-07-19", currency: "INR", price: 125, provenance: "user", source: "manual" },
    };
    const childOpening: OpeningPosition = {
      ...opening,
      id: "jio-opening",
      assetId: child.id,
      date: "2023-07-20",
      measuredAsOf: "2023-07-20",
      averageCostPrice: 2.34,
      manualValuation: { asOf: "2023-08-20", currency: "INR", price: 50, provenance: "user", source: "manual" },
    };

    const holdings = calculateHoldings({ assets: [parent, child], openingPositions: [parentOpening, childOpening], trades: [], quoteCache: {}, now: new Date("2023-09-01T12:00:00Z") });
    expect(holdings.every((holding) => holding.valuation.status === "pending")).toBe(true);
  });

  it.each([
    ["RELIANCE-JIOFIN-2023-v1", "0.9532", "47.268"],
    ["TATAMOTORS-TMCV-2025-v1", "0.6885", "314.615"],
  ])("retains exact catalog allocation for %s", (_eventId, retainedFraction, childCost) => {
    const retained = calculatePositionAccounting({ trades: [buy], demergerAdjustments: [{ eventId: _eventId, assetId: "a", date: "2026-01-03", kind: "retainedCost", retainedFraction }] });
    const child = calculatePositionAccounting({ trades: [], demergerAdjustments: [{ eventId: _eventId, assetId: "child", date: "2026-01-03", kind: "entitlement", quantity: 10, cost: childCost, sourceAssetId: "a", sourceRecordIds: ["buy"], firstAcquisitionDate: buy.date }] });
    expect(retained.totalUnits.times(retained.averageCostPrice).plus(child.totalUnits.times(child.averageCostPrice)).toNumber()).toBe(1010);
  });
});
