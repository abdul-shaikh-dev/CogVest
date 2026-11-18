import { calculateMonthlyPerformance } from "@/src/domain/calculations";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset, MonthlySnapshot } from "@/src/types";

// #714: backdated records must reach saved automatic month-end snapshots.
const now = () => new Date("2026-06-30T12:00:00.000Z");
const stock = {
  assetClass: "stock", currency: "INR", exchange: "NSE", id: "asset-1", instrumentType: "stock",
  name: "Stock", sectorType: "other", symbol: "STK", ticker: "STK.NS",
} as Asset;
const opening = {
  assetId: stock.id, averageCostPrice: 100, date: "2026-01-05", id: "op", quantity: 10,
  manualValuation: { asOf: "2026-01-05T10:00:00.000Z", currency: "INR", price: 100, provenance: "user", source: "manual" },
};

/** A store whose January-May automatic snapshots already exist. */
function storeWithSnapshots() {
  const store = createPortfolioStore({ now, storage: createMemoryJsonStorage() });
  store.getState().addAsset(stock);
  store.getState().addOpeningPosition(opening as never);
  // Correcting an opening position rebuilds the automatic history.
  store.getState().correctOpeningPosition({ ...opening, quantity: 11 } as never);
  expect(months(store)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"]);
  expect(snapshot(store, "2026-03").cashValue).toBe(0);
  return store;
}
type Store = ReturnType<typeof storeWithSnapshots>;
const months = (store: Store) => store.getState().monthlySnapshots.map((item) => item.month);
const snapshot = (store: Store, month: string) =>
  store.getState().monthlySnapshots.find((item) => item.month === month) as MonthlySnapshot;
const deposit = { amount: 500000, date: "2026-02-10", id: "dep", label: "Dep", purpose: "capitalContribution", type: "addition" } as const;

describe("automatic snapshots after backdated records (#714)", () => {
  it("refreshes snapshots from the month of a backdated deposit", () => {
    const store = storeWithSnapshots();

    store.getState().addCashEntry(deposit);

    expect(snapshot(store, "2026-01").cashValue).toBe(0);
    for (const month of ["2026-02", "2026-03", "2026-05"]) expect(snapshot(store, month).cashValue).toBe(500000);
    expect(snapshot(store, "2026-02").performanceBasis).toMatchObject({ netExternalFlow: 500000 });
  });

  it("refreshes after correcting and deleting a manual Cash entry", () => {
    const store = storeWithSnapshots();
    store.getState().addCashEntry(deposit);

    expect(store.getState().correctManualCashEntry({ ...deposit, amount: 1000 }).status).toBe("applied");
    expect(snapshot(store, "2026-04").cashValue).toBe(1000);
    expect(store.getState().deleteManualCashEntry(deposit.id).status).toBe("applied");
    expect(snapshot(store, "2026-04").cashValue).toBe(0);
  });

  it("refreshes after a backdated withdrawal", () => {
    const store = storeWithSnapshots();
    store.getState().addCashEntry(deposit);

    store.getState().addCashEntry({ amount: 2000, date: "2026-03-15", id: "wd", label: "Out", purpose: "withdrawal", type: "withdrawal" });

    expect(snapshot(store, "2026-02").cashValue).toBe(500000);
    expect(snapshot(store, "2026-03").cashValue).toBe(498000);
  });

  it("refreshes after a backdated funded buy and sale", () => {
    const store = storeWithSnapshots();
    store.getState().addCashEntry(deposit);

    expect(store.getState().recordFundedBuy({ cashLabel: "Buy", trade: {
      assetId: stock.id, date: "2026-03-02", id: "t1", pricePerUnit: 100, quantity: 100, totalValue: 10000, type: "buy",
    } } as never)).toMatchObject({ isValid: true });
    expect(snapshot(store, "2026-03").cashValue).toBe(490000);
    expect(snapshot(store, "2026-03").investedValue).toBe(11100);

    expect(store.getState().recordSaleWithProceeds({ cashLabel: "Sale", trade: {
      assetId: stock.id, date: "2026-04-02", id: "s1", pricePerUnit: 100, quantity: 50, totalValue: 5000, type: "sell",
    } } as never)).toMatchObject({ isValid: true });
    expect(snapshot(store, "2026-03").cashValue).toBe(490000);
    expect(snapshot(store, "2026-04").cashValue).toBe(495000);
  });

  it("refreshes after a backdated payout and its deletion", () => {
    const store = storeWithSnapshots();

    const saved = store.getState().saveDistribution({
      assetId: stock.id, grossAmount: 300, id: "div", paidOn: "2026-03-10", taxWithheld: 0, treatment: "paidToCash",
    });
    expect(saved.status).toBe("applied");
    expect(snapshot(store, "2026-03").cashValue).toBe(300);

    expect(store.getState().deleteDistribution("div").status).toBe("applied");
    expect(snapshot(store, "2026-03").cashValue).toBe(0);
  });

  it("leaves saved snapshots alone for a current-month record", () => {
    const store = storeWithSnapshots();
    const before = store.getState().monthlySnapshots;

    store.getState().addCashEntry({ ...deposit, date: "2026-06-10" });

    expect(store.getState().monthlySnapshots).toBe(before);
  });
});

describe("monthly performance across a snapshot gap (#714)", () => {
  const base = { cryptoValue: 0, debtValue: 0, equityValue: 0, investedValue: 0, monthlyInvestment: 0 };
  const basis = { netExternalFlow: 0, status: "complete", warnings: [], weightedExternalFlow: 0 } as const;
  const july = { ...base, cashValue: 100000, id: "a", month: "2026-07", portfolioValue: 100000, performanceBasis: basis } as unknown as MonthlySnapshot;

  it("is unavailable when the previous saved snapshot is not the previous month", () => {
    const october = { ...july, cashValue: 150000, id: "b", month: "2026-10", portfolioValue: 150000 } as MonthlySnapshot;

    expect(calculateMonthlyPerformance(july, october)).toMatchObject({
      marketMovement: null,
      reason: "non-consecutive-snapshot",
      status: "unavailable",
      totalValueChange: 50000,
    });
  });

  it("still measures consecutive months, including across a year end", () => {
    const august = { ...july, id: "b", month: "2026-08", portfolioValue: 110000 } as MonthlySnapshot;
    expect(calculateMonthlyPerformance(july, august)).toMatchObject({ marketMovement: 10000, status: "available" });

    const december = { ...july, month: "2026-12" } as MonthlySnapshot;
    const january = { ...july, id: "c", month: "2027-01", portfolioValue: 101000 } as MonthlySnapshot;
    expect(calculateMonthlyPerformance(december, january)).toMatchObject({ marketMovement: 1000, status: "available" });
  });
});
