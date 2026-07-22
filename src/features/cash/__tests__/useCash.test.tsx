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
      purpose: "capitalContribution",
      type: "addition",
    });
    store.getState().addCashEntry({
      amount: 250,
      date: "2026-04-22",
      id: "cash-withdraw",
      label: "Withdrawal",
      purpose: "withdrawal",
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
        purpose: "capitalContribution",
        type: "addition",
      });
      result.current.addEntry({
        amount: 300,
        date: "2026-04-21",
        label: "Withdrawal",
        purpose: "withdrawal",
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
        purpose: "capitalContribution",
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

  it("recalculates balance and monthly metrics after correction and deletion", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const entry = {
      amount: 1000,
      date: "2026-05-02",
      id: "cash-correction",
      label: "Broker cash",
      purpose: "capitalContribution" as const,
      type: "addition" as const,
    };
    store.getState().addCashEntry(entry);
    const { result } = renderHook(() =>
      useCash({ now: new Date("2026-05-16T00:00:00.000Z"), store }),
    );

    act(() => {
      store.getState().correctManualCashEntry({ ...entry, amount: 1500 });
    });

    expect(result.current.balance).toBe(1500);
    expect(result.current.monthlyMetrics).toMatchObject({
      added: 1500,
      contributions: 1500,
    });

    act(() => {
      store.getState().deleteManualCashEntry(entry.id);
    });

    expect(result.current.balance).toBe(0);
    expect(result.current.monthlyMetrics).toMatchObject({
      added: 0,
      contributions: 0,
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
      purpose: "income",
      type: "addition",
    });
    store.getState().addCashEntry({
      amount: 20000,
      date: "2026-05-10",
      id: "cash-transfer",
      label: "SIP transfer",
      linkedTradeId: "trade-buy",
      purpose: "purchaseFunding",
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
      contributions: 0,
      income: 100000,
      incomeStatus: "available",
      investmentRate: 20,
      invested: 20000,
    });
  });

  it("keeps manual cash actions to deposit and withdrawal while deriving invested from investment records", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset({
      assetClass: "stock",
      currency: "INR",
      id: "asset-hdfc",
      name: "HDFC Bank",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    });
    store.getState().addCashEntry({
      amount: 70000,
      date: "2026-05-03",
      id: "cash-salary",
      label: "Salary added",
      purpose: "income",
      type: "addition",
    });
    store.getState().recordFundedBuy({
      cashLabel: "HDFC Bank purchase",
      trade: {
        assetId: "asset-hdfc",
        date: "2026-05-05",
        id: "trade-buy",
        pricePerUnit: 1500,
        quantity: 10,
        totalValue: 15000,
        type: "buy",
      },
    });

    const { result } = renderHook(() =>
      useCash({ now: new Date("2026-05-16T00:00:00.000Z"), store }),
    );

    expect(result.current.manualEntryModes).toEqual(["addition", "withdrawal"]);
    expect(result.current.monthlyMetrics).toMatchObject({
      added: 70000,
      available: 55000,
      income: 70000,
      invested: 15000,
    });
    expect(result.current.monthlyMovementSummary).toBe(
      "₹15K moved into investments this month",
    );
  });

  it("marks the investment rate unavailable when typed income is missing", () => {
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
      amount: 20000,
      date: "2026-05-01",
      id: "cash-contribution",
      label: "Capital contribution",
      purpose: "capitalContribution",
      type: "addition",
    });
    store.getState().recordFundedBuy({
      cashLabel: "Reliance Industries purchase",
      trade: {
        assetId: "asset-reliance",
        date: "2026-05-10",
        id: "trade-buy",
        pricePerUnit: 100,
        quantity: 200,
        totalValue: 20000,
        type: "buy",
      },
    });

    const { result } = renderHook(() =>
      useCash({ now: new Date("2026-05-16T00:00:00.000Z"), store }),
    );

    expect(result.current.monthlyMetrics).toMatchObject({
      added: 20000,
      available: 0,
      contributions: 20000,
      income: 0,
      incomeStatus: "unavailable",
      investmentRate: null,
      invested: 20000,
    });
  });
});
