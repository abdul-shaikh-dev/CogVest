import { getAvailableQuantity } from "@/src/domain/validators/trade";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset, BuyTrade, OpeningPosition, SellTrade } from "@/src/types";

const now = () => new Date("2026-06-30T12:00:00.000Z");

const asset: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "asset-1",
  name: "Accounting Asset",
  symbol: "ACCOUNT",
  ticker: "ACCOUNT.NS",
};

function buy(id: string, date: string, quantity: number): BuyTrade {
  return {
    assetId: asset.id,
    date,
    id,
    pricePerUnit: 100,
    quantity,
    totalValue: quantity * 100,
    type: "buy",
  };
}

function sale(id: string, date: string, quantity: number, fees = 0): SellTrade {
  return {
    assetId: asset.id,
    date,
    fees,
    id,
    pricePerUnit: 120,
    quantity,
    totalValue: quantity * 120 - fees,
    type: "sell",
  };
}

function opening(quantity: number, measuredAsOf?: string): OpeningPosition {
  return {
    assetId: asset.id,
    averageCostPrice: 100,
    date: "2026-01-01",
    id: "opening-1",
    measuredAsOf,
    quantity,
  };
}

function storeWithAsset() {
  const store = createPortfolioStore({ now, storage: createMemoryJsonStorage() });
  store.getState().addAsset(asset);
  return store;
}

describe("core accounting invariants", () => {
  it("tracks partial and full INR disposals with net-of-fee proceeds", () => {
    const store = storeWithAsset();
    store.getState().addTrade(buy("buy-1", "2026-01-02", 10));

    const partial = store.getState().recordSaleWithProceeds({
      cashLabel: "Partial sale",
      trade: sale("sale-1", "2026-01-03", 4, 10),
    });
    expect(partial).toMatchObject({ isValid: true, trade: { totalValue: 470 } });
    expect(store.getState().cashEntries.at(-1)).toMatchObject({
      amount: 470,
      purpose: "saleProceeds",
      type: "addition",
    });
    expect(getAvailableQuantity(store.getState().trades, [], now())).toBe(6);

    expect(
      store.getState().recordSaleWithProceeds({
        cashLabel: "Full sale",
        trade: sale("sale-2", "2026-01-04", 6),
      }),
    ).toMatchObject({ isValid: true });
    expect(getAvailableQuantity(store.getState().trades, [], now())).toBe(0);
  });

  it("rejects oversells, including a sale before a later acquisition", () => {
    const store = storeWithAsset();
    store.getState().addTrade(buy("later-buy", "2026-01-10", 10));

    expect(
      store.getState().recordSaleWithProceeds({
        cashLabel: "Chronological oversell",
        trade: sale("early-sale", "2026-01-05", 1),
      }),
    ).toMatchObject({ isValid: false, reason: "insufficientUnits" });

    const absoluteStore = storeWithAsset();
    absoluteStore.getState().addTrade(buy("buy-1", "2026-01-02", 2));
    expect(
      absoluteStore.getState().recordSaleWithProceeds({
        cashLabel: "Absolute oversell",
        trade: sale("oversell", "2026-01-11", 3),
      }),
    ).toMatchObject({ isValid: false, reason: "insufficientUnits", requiredUnits: 3 });
  });

  it("rejects invalid linked-sale dates before persistence", () => {
    const store = storeWithAsset();
    store.getState().addTrade(buy("buy-1", "2026-01-02", 1));

    expect(
      store.getState().recordSaleWithProceeds({
        cashLabel: "Invalid date",
        trade: sale("invalid-sale", "not-a-date", 1),
      }),
    ).toEqual({ isValid: false, reason: "invalidTrade" });
    expect(store.getState().trades).toHaveLength(1);
  });

  it("does not double-count activity at a measured aggregate cutover", () => {
    const store = storeWithAsset();
    store.getState().addTrade(buy("pre-cutover-buy", "2026-01-02", 10));
    store.getState().addOpeningPosition(opening(10, "2026-01-31"));

    expect(
      store.getState().recordSaleWithProceeds({
        cashLabel: "Cutover sale",
        trade: sale("cutover-oversell", "2026-02-01", 11),
      }),
    ).toMatchObject({ isValid: false, reason: "insufficientUnits", availableUnits: 10 });
  });

  it("rejects cash-backed trades at or before a measured cutover", () => {
    const store = storeWithAsset();
    store.getState().addOpeningPosition(opening(10, "2026-01-31"));
    store.getState().addCashEntry({
      amount: 1_000,
      date: "2026-01-01",
      id: "cash-1",
      label: "Cash",
      purpose: "capitalContribution",
      type: "addition",
    });

    expect(
      store.getState().recordSaleWithProceeds({
        cashLabel: "Pre-cutover sale",
        trade: sale("pre-cutover-sale", "2026-01-31", 1),
      }),
    ).toEqual({ isValid: false, reason: "invalidTrade" });
    expect(
      store.getState().recordFundedBuy({
        cashLabel: "Pre-cutover buy",
        trade: buy("pre-cutover-buy", "2026-01-31", 1),
      }),
    ).toEqual({ isValid: false, reason: "invalidTrade" });
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().cashEntries).toHaveLength(1);
  });

  it("rejects corrections and deletions that would make inventory negative", () => {
    const store = storeWithAsset();
    store.getState().addTrade(buy("buy-1", "2026-01-02", 10));
    expect(
      store.getState().recordSaleWithProceeds({
        cashLabel: "Initial sale",
        trade: sale("sale-1", "2026-01-03", 8),
      }),
    ).toMatchObject({ isValid: true });

    expect(
      store.getState().correctTrade({ ...buy("buy-1", "2026-01-02", 7) }),
    ).toEqual({ reason: "oversold", status: "rejected" });
    expect(store.getState().deleteTrade("buy-1")).toEqual({
      reason: "oversold",
      status: "rejected",
    });
    expect(store.getState().trades).toHaveLength(2);
  });

  it("does not permit non-INR holdings through the linked sale command", () => {
    const store = createPortfolioStore({ now, storage: createMemoryJsonStorage() });
    const usdAsset = { ...asset, currency: "USD" as const, id: "usd-asset" };

    expect(
      store.getState().recordSaleWithProceeds({
        asset: usdAsset,
        cashLabel: "USD sale",
        trade: { ...sale("usd-sale", "2026-01-03", 1), assetId: usdAsset.id },
      }),
    ).toEqual({ isValid: false, reason: "invalidTrade" });
  });
});
