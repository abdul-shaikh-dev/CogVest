import { act, renderHook } from "@testing-library/react-native";

import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset, CashEntry, OpeningPosition } from "@/src/types";

import { useMonthEndSnapshotAutomation } from "../useMonthEndSnapshotAutomation";
import { useProgress } from "../useProgress";

const stockAsset: Asset = {
  assetClass: "stock",
  currency: "INR",
  id: "asset-hdfc",
  name: "HDFC Bank",
  symbol: "HDFCBANK",
  ticker: "HDFCBANK.NS",
};

function seedHoldingAndCash(store: ReturnType<typeof createPortfolioStore>) {
  const openingPosition: OpeningPosition = {
    assetId: stockAsset.id,
    averageCostPrice: 1450,
    currentPrice: 1678.25,
    date: "2026-07-15T00:00:00.000Z",
    id: "opening-hdfc",
    quantity: 10,
  };
  const cashEntry: CashEntry = {
    amount: 70000,
    date: "2026-07-01T00:00:00.000Z",
    id: "cash-salary",
    label: "Salary added",
    purpose: "income",
    type: "addition",
  };

  store.getState().addAsset(stockAsset);
  store.getState().addOpeningPosition(openingPosition);
  store.getState().addCashEntry(cashEntry);
}

describe("useProgress", () => {
  it("saves and updates monthly snapshots through the feature controller", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { result } = renderHook(() => useProgress({ store }));

    act(() => {
      result.current.setField("month", "2026-05");
      result.current.setField("portfolioValue", "1385000");
      result.current.setField("investedValue", "1060000");
      result.current.setField("equityValue", "880000");
      result.current.setField("debtValue", "320000");
      result.current.setField("cryptoValue", "45000");
      result.current.setField("cashValue", "140000");
      result.current.setField("monthlyInvestment", "60000");
      result.current.setField("salary", "160000");
    });
    act(() => {
      result.current.setField("monthlyExpense", "40000");
    });
    act(() => {
      result.current.saveSnapshot();
    });

    expect(store.getState().monthlySnapshots).toHaveLength(1);
    expect(store.getState().monthlySnapshots[0]).toMatchObject({
      month: "2026-05",
      portfolioValue: 1385000,
    });

    act(() => {
      result.current.setField("month", "2026-05");
      result.current.setField("portfolioValue", "1400000");
      result.current.setField("investedValue", "1070000");
      result.current.setField("equityValue", "890000");
      result.current.setField("debtValue", "320000");
      result.current.setField("cryptoValue", "50000");
      result.current.setField("cashValue", "140000");
      result.current.setField("monthlyInvestment", "70000");
    });
    act(() => {
      result.current.setField("salary", "160000");
    });
    act(() => {
      result.current.saveSnapshot();
    });

    expect(store.getState().monthlySnapshots).toHaveLength(1);
    expect(store.getState().monthlySnapshots[0]).toMatchObject({
      month: "2026-05",
      portfolioValue: 1400000,
    });
  });

  it("auto-generates the previous completed month snapshot once", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    seedHoldingAndCash(store);

    const { result } = renderHook(() =>
      useProgress({
        now: new Date("2026-08-02T10:00:00.000Z"),
        store,
      }),
    );

    await act(async () => {
      await result.current.ensureMonthEndSnapshot();
    });

    expect(store.getState().monthlySnapshots).toHaveLength(1);
    expect(store.getState().monthlySnapshots[0]).toMatchObject({
      generated: {
        source: "auto",
      },
      month: "2026-07",
    });
    expect(result.current.snapshotAutomationStatus).toMatchObject({
      status: "created",
      targetMonth: "2026-07",
    });

    await act(async () => {
      await result.current.ensureMonthEndSnapshot();
    });

    expect(store.getState().monthlySnapshots).toHaveLength(1);
    expect(result.current.snapshotAutomationStatus).toMatchObject({
      status: "already-exists",
      targetMonth: "2026-07",
    });
  });

  it("runs month-end snapshot automation once from the reusable hook", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    seedHoldingAndCash(store);
    const historicalPriceFetcher = jest.fn().mockResolvedValue({
      ok: true,
      quote: {
        assetId: stockAsset.id,
        asOfMonth: "2026-07",
        basis: "historical-close",
        currency: "INR",
        fetchedAt: "2026-08-02T10:00:00.000Z",
        price: 1600,
        source: "yahoo",
      },
    });

    renderHook(() =>
      useMonthEndSnapshotAutomation({
        historicalPriceFetcher,
        now: new Date("2026-08-02T10:00:00.000Z"),
        store,
      }),
    );

    await act(async () => {});

    expect(store.getState().monthlySnapshots).toHaveLength(1);
    expect(store.getState().monthlySnapshots[0]?.month).toBe("2026-07");
  });

  it("uses fetched historical prices before latest local quote fallback", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    seedHoldingAndCash(store);
    store.getState().upsertQuote({
      assetId: stockAsset.id,
      asOf: "2026-08-02T10:00:00.000Z",
      currency: "INR",
      price: 1800,
      source: "yahoo",
    });
    const historicalPriceFetcher = jest.fn().mockResolvedValue({
      ok: true,
      quote: {
        assetId: stockAsset.id,
        asOfMonth: "2026-07",
        basis: "historical-close",
        currency: "INR",
        fetchedAt: "2026-08-02T10:00:00.000Z",
        price: 1600,
        source: "yahoo",
      },
    });

    const { result } = renderHook(() =>
      useProgress({
        historicalPriceFetcher,
        now: new Date("2026-08-02T10:00:00.000Z"),
        store,
      }),
    );

    await act(async () => {
      await result.current.ensureMonthEndSnapshot();
    });

    expect(historicalPriceFetcher).toHaveBeenCalledTimes(1);
    expect(store.getState().monthlySnapshots[0]?.equityValue).toBe(1600 * 10);
  });
});
