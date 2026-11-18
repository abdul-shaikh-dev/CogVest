import { calculateHoldings } from "@/src/domain/calculations";
import { inventoryRejectionMessage } from "@/src/features/trades/inventoryRejection";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset, OpeningPosition } from "@/src/types";

// #713: corrections must keep each holding's dated units valid.
const now = () => new Date("2026-06-30T12:00:00.000Z");
const stock = {
  assetClass: "stock", currency: "INR", exchange: "NSE", id: "asset-1", instrumentType: "stock",
  name: "Stock", sectorType: "other", symbol: "STK", ticker: "STK.NS",
} as Asset;
const other = { ...stock, id: "asset-2", name: "Other", symbol: "OTH", ticker: "OTH.NS" } as Asset;
const opening = (overrides: Partial<OpeningPosition> = {}) => ({
  assetId: stock.id, averageCostPrice: 100, date: "2026-01-01", id: "op", quantity: 10, ...overrides,
}) as OpeningPosition;

function storeWithSale() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ now, storage });
  store.getState().addAsset(stock);
  store.getState().addAsset(other);
  store.getState().addOpeningPosition(opening());
  store.getState().addOpeningPosition(opening({ assetId: other.id, id: "op2" }));
  store.getState().recordSaleWithProceeds({ cashLabel: "Sale", trade: {
    assetId: stock.id, date: "2026-02-01", id: "s1", pricePerUnit: 150, quantity: 8, totalValue: 1200, type: "sell",
  } } as never);
  store.getState().recordSaleWithProceeds({ cashLabel: "Sale", trade: {
    assetId: other.id, date: "2026-02-01", id: "s2", pricePerUnit: 150, quantity: 1, totalValue: 150, type: "sell",
  } } as never);
  return { storage, store };
}

function expectStillHealthy(store: ReturnType<typeof storeWithSale>["store"]) {
  expect(store.getState().openingPositions.find((item) => item.id === "op")).toMatchObject({ date: "2026-01-01", quantity: 10 });
  expect(() => store.getState().captureBackup()).not.toThrow();
  expect(store.getState().deleteTrades(["s2"]).status).toBe("applied");
}

describe("opening-position corrections (#713)", () => {
  it("refuses to delete an opening that a later sale depends on", () => {
    const { store } = storeWithSale();

    expect(store.getState().deleteOpeningPosition("op"))
      .toEqual({ dependentTradeIds: ["s1"], reason: "oversold", status: "rejected" });
    expectStillHealthy(store);
  });

  it("refuses to shrink an opening below what was later sold", () => {
    const { store } = storeWithSale();

    expect(store.getState().correctOpeningPosition(opening({ quantity: 2 })))
      .toEqual({ dependentTradeIds: ["s1"], reason: "oversold", status: "rejected" });
    expectStillHealthy(store);
  });

  it("refuses to re-date an opening after a sale it funds", () => {
    const { store } = storeWithSale();

    expect(store.getState().correctOpeningPosition(opening({ date: "2026-05-01" })))
      .toEqual({ dependentTradeIds: ["s1"], reason: "oversold", status: "rejected" });
    expectStillHealthy(store);
  });

  it("still applies a correction that keeps enough units", () => {
    const { store } = storeWithSale();

    expect(store.getState().correctOpeningPosition(opening({ quantity: 8 })).status).toBe("applied");
    expect(() => store.getState().captureBackup()).not.toThrow();
  });

  it("refuses an acquisition date after the measured date", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ now, storage });
    store.getState().addAsset(stock);
    store.getState().addOpeningPosition(opening({ measuredAsOf: "2026-03-01" }));

    expect(store.getState().correctOpeningPosition(opening({ date: "2026-04-01", measuredAsOf: "2026-03-01" })))
      .toEqual({ reason: "invalidEntry", status: "rejected" });
    store.getState().addAsset(other);
    expect(() => store.getState().addOpeningPosition(opening({ assetId: other.id, date: "2026-04-01", id: "op3", measuredAsOf: "2026-03-01" })))
      .toThrow();
    expect(() => store.getState().captureBackup()).not.toThrow();
  });

  it("refuses to move the measured date past a counted transaction", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ now, storage });
    store.getState().addAsset(stock);
    store.getState().addOpeningPosition(opening({ measuredAsOf: "2026-03-01" }));
    store.getState().addCashEntry({ amount: 10000, date: "2026-01-01", id: "dep", label: "Dep", purpose: "capitalContribution", type: "addition" });
    store.getState().recordFundedBuy({ cashLabel: "Buy", trade: {
      assetId: stock.id, date: "2026-04-02", id: "t1", pricePerUnit: 100, quantity: 5, totalValue: 500, type: "buy",
    } } as never);

    expect(store.getState().correctOpeningPosition(opening({ measuredAsOf: "2026-05-01" })))
      .toEqual({ dependentTradeIds: ["t1"], reason: "hidesTrades", status: "rejected" });
  });
});

describe("trade corrections and the opening cutover (#713)", () => {
  it("refuses to date a counted trade on or before the cutover", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ now, storage });
    store.getState().addAsset(stock);
    store.getState().addOpeningPosition(opening({ measuredAsOf: "2026-03-01" }));
    store.getState().addCashEntry({ amount: 10000, date: "2026-01-01", id: "dep", label: "Dep", purpose: "capitalContribution", type: "addition" });
    store.getState().recordFundedBuy({ cashLabel: "Buy", trade: {
      assetId: stock.id, date: "2026-04-02", id: "t1", pricePerUnit: 100, quantity: 5, totalValue: 500, type: "buy",
    } } as never);
    const correction = { assetId: stock.id, id: "t1", pricePerUnit: 100, quantity: 5, type: "buy" } as const;

    for (const date of ["2026-02-01", "2026-03-01"]) {
      expect(store.getState().correctTrade({ ...correction, date }))
        .toEqual({ dependentTradeIds: ["t1"], reason: "hidesTrades", status: "rejected" });
    }
    const state = store.getState();
    expect(calculateHoldings({ assets: state.assets, now: now(), openingPositions: state.openingPositions,
      quoteCache: {}, trades: state.trades })[0].totalUnits).toBe(15);
    expect(store.getState().correctTrade({ ...correction, date: "2026-03-02" }).status).toBe("applied");
  });
});

describe("inventoryRejectionMessage (#713)", () => {
  const trades = [{ assetId: stock.id, date: "2026-02-01", id: "s1", pricePerUnit: 150, quantity: 8, totalValue: 1200, type: "sell" as const }];

  it("names the sale that would be oversold", () => {
    expect(inventoryRejectionMessage({ dependentTradeIds: ["s1"], reason: "oversold" }, trades, "openingPosition"))
      .toMatch(/sale on 01 Feb 2026 selling more units than were held/);
  });

  it("explains hidden transactions for both screens", () => {
    expect(inventoryRejectionMessage({ dependentTradeIds: ["s1"], reason: "hidesTrades" }, trades, "openingPosition"))
      .toMatch(/past the sale on 01 Feb 2026/);
    expect(inventoryRejectionMessage({ dependentTradeIds: ["s1"], reason: "hidesTrades" }, trades, "transaction"))
      .toMatch(/on or before the date the holding was measured from/);
  });
});
