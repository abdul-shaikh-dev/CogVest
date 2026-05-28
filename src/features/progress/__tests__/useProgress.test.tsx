import { act, renderHook } from "@testing-library/react-native";

import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

import { useProgress } from "../useProgress";

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
});
