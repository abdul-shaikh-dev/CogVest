import { act, renderHook } from "@testing-library/react-native";

import { useCash } from "@/src/features/cash/useCash";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

describe("useCash", () => {
  it("derives cash balance from additions minus withdrawals and sorts history newest first", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addCashEntry({
      amount: 1000,
      date: "2026-04-20",
      id: "cash-add",
      label: "Broker cash",
      type: "addition",
    });
    store.getState().addCashEntry({
      amount: 250,
      date: "2026-04-22",
      id: "cash-withdraw",
      label: "Withdrawal",
      type: "withdrawal",
    });

    const { result } = renderHook(() => useCash({ store }));

    expect(result.current.balance).toBe(750);
    expect(result.current.entries.map((entry) => entry.id)).toEqual([
      "cash-withdraw",
      "cash-add",
    ]);
  });

  it("adds and withdraws cash through the store-backed action", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { result } = renderHook(() => useCash({ store }));

    act(() => {
      result.current.addEntry({
        amount: 1000,
        date: "2026-04-20",
        label: "Broker cash",
        type: "addition",
      });
      result.current.addEntry({
        amount: 300,
        date: "2026-04-21",
        label: "Withdrawal",
        type: "withdrawal",
      });
    });

    expect(result.current.balance).toBe(700);
    expect(store.getState().cashEntries).toHaveLength(2);
  });

  it("persists cash entries in the portfolio snapshot storage", () => {
    const storage = createMemoryJsonStorage();
    const firstStore = createPortfolioStore({ storage });
    const { result } = renderHook(() => useCash({ store: firstStore }));

    act(() => {
      result.current.addEntry({
        amount: 500,
        date: "2026-04-20",
        label: "Opening cash",
        type: "addition",
      });
    });

    const secondStore = createPortfolioStore({ storage });

    expect(secondStore.getState().cashEntries).toHaveLength(1);
    expect(secondStore.getState().cashEntries[0]).toMatchObject({
      amount: 500,
      label: "Opening cash",
      type: "addition",
    });
  });

  it("derives monthly cash metrics from stored cash and investment records", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset({
      assetClass: "stock",
      currency: "INR",
      id: "asset-reliance",
      name: "Reliance Industries",
      symbol: "RELIANCE",
      ticker: "RELIANCE.NS",
    });
    store.getState().addCashEntry({
      amount: 100000,
      date: "2026-05-01",
      id: "cash-salary",
      label: "Salary",
      type: "addition",
    });
    store.getState().addCashEntry({
      amount: 20000,
      date: "2026-05-10",
      id: "cash-transfer",
      label: "SIP transfer",
      type: "withdrawal",
    });
    store.getState().addTrade({
      assetId: "asset-reliance",
      date: "2026-05-10",
      id: "trade-buy",
      pricePerUnit: 100,
      quantity: 200,
      totalValue: 20000,
      type: "buy",
    });

    const { result } = renderHook(() =>
      useCash({ now: new Date("2026-05-16T00:00:00.000Z"), store }),
    );

    expect(result.current.monthlyMetrics).toEqual({
      added: 100000,
      available: 80000,
      invested: 20000,
      savingsRate: 20,
    });
  });

  it("marks savings rate unavailable when current-month added cash is missing", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset({
      assetClass: "stock",
      currency: "INR",
      id: "asset-reliance",
      name: "Reliance Industries",
      symbol: "RELIANCE",
      ticker: "RELIANCE.NS",
    });
    store.getState().addTrade({
      assetId: "asset-reliance",
      date: "2026-05-10",
      id: "trade-buy",
      pricePerUnit: 100,
      quantity: 200,
      totalValue: 20000,
      type: "buy",
    });

    const { result } = renderHook(() =>
      useCash({ now: new Date("2026-05-16T00:00:00.000Z"), store }),
    );

    expect(result.current.monthlyMetrics).toMatchObject({
      added: 0,
      invested: 20000,
      savingsRate: null,
    });
  });
});
