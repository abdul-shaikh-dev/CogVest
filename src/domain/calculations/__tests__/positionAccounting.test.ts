import { calculateHolding, calculatePositionAccounting, calculateRecordedSaleGains } from "../holdings";
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
});
