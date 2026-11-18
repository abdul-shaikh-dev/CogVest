import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, describeSaveFailure } from "@/src/store";
import type { Asset, CashEntry } from "@/src/types";

// #715: manual Cash changes must keep the dated Cash balance at or above zero.
const now = () => new Date("2026-06-30T12:00:00.000Z");
const stock = {
  assetClass: "stock", currency: "INR", exchange: "NSE", id: "asset-1", instrumentType: "stock",
  name: "Stock", sectorType: "other", symbol: "STK", ticker: "STK.NS",
} as Asset;
const deposit = {
  amount: 1000, date: "2026-01-01", id: "dep", label: "Dep", purpose: "capitalContribution", type: "addition",
} as const satisfies CashEntry;
const withdrawal = (amount: number, date = "2026-03-01", id = "wd"): CashEntry =>
  ({ amount, date, id, label: "Out", purpose: "withdrawal", type: "withdrawal" });
const buy = (id: string, date: string, totalValue: number) => ({
  cashLabel: "Buy",
  trade: { assetId: stock.id, date, id, pricePerUnit: totalValue / 10, quantity: 10, totalValue, type: "buy" },
}) as never;

/** Deposit 1,000 on 1 Jan, then a funded buy of 900 on 2 Jan (the review's scenario). */
function fundedStore() {
  const store = createPortfolioStore({ now, storage: createMemoryJsonStorage() });
  store.getState().addAsset(stock);
  store.getState().addCashEntry(deposit);
  expect(store.getState().recordFundedBuy(buy("t1", "2026-01-02", 900))).toMatchObject({ isValid: true });
  return store;
}
type Store = ReturnType<typeof fundedStore>;
const cashIds = (store: Store) => store.getState().cashEntries.map((entry) => entry.id);

describe("manual Cash changes keep the dated balance nonnegative (#715)", () => {
  it("refuses to delete the deposit that funds a later purchase", () => {
    const store = fundedStore();
    const before = store.getState().cashEntries;

    expect(store.getState().deleteManualCashEntry(deposit.id)).toEqual({
      reason: "insufficientCash", shortfallDate: "2026-01-02", status: "rejected",
    });
    expect(store.getState().cashEntries).toBe(before);
  });

  it("refuses a correction that underfunds a later purchase", () => {
    const store = fundedStore();

    expect(store.getState().correctManualCashEntry({ ...deposit, amount: 800 })).toEqual({
      reason: "insufficientCash", shortfallDate: "2026-01-02", status: "rejected",
    });
    expect(store.getState().correctManualCashEntry({ ...deposit, date: "2026-01-05" })).toMatchObject({
      reason: "insufficientCash", shortfallDate: "2026-01-02",
    });
    expect(store.getState().cashEntries.find((entry) => entry.id === deposit.id)).toMatchObject({ amount: 1000 });
  });

  it("refuses a withdrawal larger than the dated balance and names the date", () => {
    const store = fundedStore();

    let thrown: unknown;
    try {
      store.getState().addCashEntry(withdrawal(5000));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ name: "CashShortfallError", shortfallDate: "2026-03-01" });
    expect(describeSaveFailure(thrown, "fallback")).toBe(
      "This would leave Cash below zero on 01 Mar 2026. Record the Cash that funds it first, or change the date or amount.",
    );
    expect(cashIds(store)).not.toContain("wd");
  });

  it("refuses a backdated withdrawal that leaves an earlier date negative", () => {
    const store = fundedStore();
    store.getState().addCashEntry({ ...deposit, amount: 100000, date: "2026-06-01", id: "dep2" });

    // Today's balance is ample, but 1 Jan only holds 1,000 before the purchase.
    expect(() => store.getState().addCashEntry(withdrawal(500, "2026-01-01"))).toThrow(
      expect.objectContaining({ shortfallDate: "2026-01-02" }),
    );
  });

  it("still allows changes that keep every date covered", () => {
    const store = fundedStore();

    store.getState().addCashEntry(withdrawal(100));
    expect(cashIds(store)).toContain("wd");
    expect(store.getState().correctManualCashEntry({ ...deposit, amount: 1000.01 }).status).toBe("applied");
    expect(store.getState().deleteManualCashEntry("wd").status).toBe("applied");
  });
});

describe("existing negative timelines (#715)", () => {
  /** A store whose saved records were already negative on 2 Jan before this rule. */
  function legacyNegativeStore() {
    const storage = createMemoryJsonStorage();
    const seeded = fundedStore();
    const linked = seeded.getState().cashEntries.filter((entry) => entry.id !== deposit.id);
    const state = seeded.getState();
    const store = createPortfolioStore({ now, storage });
    store.setState({ assets: state.assets, cashEntries: linked, trades: state.trades });
    return store;
  }

  it("names the first shortfall date when a later funded buy is refused", () => {
    const store = legacyNegativeStore();
    store.getState().addCashEntry({ ...deposit, amount: 100000, date: "2026-06-01", id: "dep2" });

    expect(store.getState().recordFundedBuy(buy("t2", "2026-06-02", 100))).toMatchObject({
      isValid: false, reason: "insufficientCash", requiredCash: 100, shortfallDate: "2026-01-02",
    });
  });

  it("allows the repair that records the missing funding", () => {
    const store = legacyNegativeStore();

    store.getState().addCashEntry(deposit);

    expect(cashIds(store)).toContain(deposit.id);
    expect(store.getState().recordFundedBuy(buy("t2", "2026-06-02", 50))).toMatchObject({ isValid: true });
  });

  it("refuses a change that moves the first shortfall earlier", () => {
    const store = legacyNegativeStore();
    store.getState().addCashEntry({ ...deposit, amount: 50, date: "2025-12-01", id: "early" });

    expect(store.getState().correctManualCashEntry({ ...deposit, amount: 50, date: "2025-12-01", id: "early", type: "withdrawal", purpose: "withdrawal" })).toEqual({
      reason: "insufficientCash", shortfallDate: "2025-12-01", status: "rejected",
    });
  });
});
