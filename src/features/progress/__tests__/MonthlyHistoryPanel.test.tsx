import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import { Modal, ScrollView } from "react-native";

import { MonthlyHistoryPanel } from "@/src/features/progress/MonthlyHistoryPanel";
import type { MonthlyProgressSummary } from "@/src/domain/calculations";
import type { MonthlySnapshot } from "@/src/types";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0 }),
}));

function createSummary(
  month: string,
  {
    cashValue = 10_000,
    expenseRate = 25,
    monthlyExpense = 20_000,
    monthlyInvestment = 30_000,
    performance = {},
    portfolioValue = 100_000,
    salary = 80_000,
    savingsRate = 37.5,
  }: Partial<{
    cashValue: number;
    expenseRate: number | null;
    monthlyExpense: number | undefined;
    monthlyInvestment: number;
    performance: Partial<MonthlyProgressSummary["performance"]>;
    portfolioValue: number;
    salary: number | undefined;
    savingsRate: number | null;
  }> = {},
): MonthlyProgressSummary {
  const snapshot: MonthlySnapshot = {
    cashValue,
    cryptoValue: 5_000,
    debtValue: 25_000,
    equityValue: portfolioValue - cashValue - 30_000,
    id: `snapshot-${month}`,
    investedValue: 75_000,
    month,
    monthlyExpense,
    monthlyInvestment,
    notes: `Financial note for ${month}: ₹${portfolioValue}`,
    portfolioValue,
    salary,
  };

  return {
    assetSnapshot: [
      { assetClass: "stock", percentage: 60, value: snapshot.equityValue },
      { assetClass: "debt", percentage: 25, value: snapshot.debtValue },
      { assetClass: "crypto", percentage: 5, value: snapshot.cryptoValue },
      { assetClass: "cash", percentage: 10, value: snapshot.cashValue },
    ],
    expenseRate,
    performance: {
      denominator: 100_000,
      marketMovement: 4_000,
      marketMovementPct: 4,
      netExternalFlow: 5_000,
      reason: null,
      status: "available",
      totalValueChange: 9_000,
      ...performance,
    },
    savingsRate,
    snapshot,
  };
}

describe("MonthlyHistoryPanel", () => {
  const summaries = [
    createSummary("2025-12", { portfolioValue: 100_000 }),
    createSummary("2026-01", { portfolioValue: 110_000 }),
    createSummary("2026-03", { portfolioValue: 90_000 }),
    createSummary("2026-04", { portfolioValue: 0 }),
    createSummary("2026-05", { portfolioValue: -20_000 }),
  ];

  describe("animation frame ownership", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
      cleanup();
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it.each(["close", "unmount"])("cancels the detail scroll on %s", (action) => {
      const { getByTestId, unmount } = render(
        <MonthlyHistoryPanel maskWealthValues={false} minimal={false} summaries={summaries} />,
      );
      fireEvent.press(getByTestId("open-monthly-history"));
      fireEvent.press(getByTestId("snapshot-month-2026-04"));
      expect(jest.getTimerCount()).toBe(1);

      if (action === "close") fireEvent.press(getByTestId("close-monthly-history"));
      else unmount();

      expect(jest.getTimerCount()).toBe(0);
    });

    it.each([
      ["close", 0], ["close", 1], ["close", 2],
      ["unmount", 0], ["unmount", 1], ["unmount", 2],
    ] as const)("cancels overview restoration on %s after %i frames", (action, frames) => {
      const { getByTestId, unmount } = render(
        <MonthlyHistoryPanel maskWealthValues={false} minimal={false} summaries={summaries} />,
      );
      fireEvent.press(getByTestId("open-monthly-history"));
      fireEvent.press(getByTestId("snapshot-month-2026-04"));
      act(() => jest.runAllTimers());
      fireEvent.press(getByTestId("history-back"));
      for (let index = 0; index < frames; index += 1) {
        act(() => jest.advanceTimersToNextTimer());
      }
      expect(jest.getTimerCount()).toBe(1);
      if (action === "close") fireEvent.press(getByTestId("close-monthly-history"));
      else unmount();
      expect(jest.getTimerCount()).toBe(0);
    });

    it("does not restore an old overview offset after reopening a month", () => {
      const scrollTo = jest.spyOn(ScrollView.prototype, "scrollTo");
      const { getByTestId } = render(
        <MonthlyHistoryPanel maskWealthValues={false} minimal={false} summaries={summaries} />,
      );
      fireEvent.press(getByTestId("open-monthly-history"));
      fireEvent.scroll(getByTestId("monthly-history-scroll"), {
        nativeEvent: { contentOffset: { x: 0, y: 300 } },
      });
      fireEvent.press(getByTestId("snapshot-month-2026-04"));
      act(() => jest.runAllTimers());
      fireEvent.press(getByTestId("history-back"));
      fireEvent.press(getByTestId("snapshot-month-2026-05"));
      scrollTo.mockClear();
      act(() => jest.runAllTimers());

      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ animated: false, y: 0 });
    });
  });

  it("opens newest year first and lists only stored months newest first", () => {
    const { getByTestId, getByText } = render(
      <MonthlyHistoryPanel maskWealthValues={false} minimal={false} summaries={summaries} />,
    );

    fireEvent.press(getByTestId("open-monthly-history"));

    expect(getByTestId("history-year-2026").props.accessibilityState).toEqual({ selected: true });
    expect(getByText("May")).toBeTruthy();
    expect(getByText("Apr")).toBeTruthy();
    expect(getByText("Mar")).toBeTruthy();
    expect(getByText("Change")).toBeTruthy();
    expect(() => getByTestId("snapshot-month-2026-02")).toThrow();

    fireEvent.press(getByTestId("history-year-2025"));
    expect(getByTestId("snapshot-month-2025-12")).toBeTruthy();
    expect(() => getByTestId("snapshot-month-2026-05")).toThrow();
  });

  it("lists all twelve stored months in reverse calendar order", () => {
    const completeYear = Array.from({ length: 12 }, (_, index) =>
      createSummary(`2026-${String(index + 1).padStart(2, "0")}`, {
        portfolioValue: 100_000 + index,
      }),
    );
    const { getAllByTestId, getByTestId } = render(
      <MonthlyHistoryPanel maskWealthValues={false} minimal={false} summaries={completeYear} />,
    );

    fireEvent.press(getByTestId("open-monthly-history"));

    expect(
      getAllByTestId(/^snapshot-month-2026-/).map((row) => row.props.testID),
    ).toEqual([
      "snapshot-month-2026-12",
      "snapshot-month-2026-11",
      "snapshot-month-2026-10",
      "snapshot-month-2026-09",
      "snapshot-month-2026-08",
      "snapshot-month-2026-07",
      "snapshot-month-2026-06",
      "snapshot-month-2026-05",
      "snapshot-month-2026-04",
      "snapshot-month-2026-03",
      "snapshot-month-2026-02",
      "snapshot-month-2026-01",
    ]);
  });

  it("opens a dedicated month page and compares only with the immediate calendar month", () => {
    const { getByTestId, getByText, queryByText } = render(
      <MonthlyHistoryPanel maskWealthValues={false} minimal={false} summaries={summaries} />,
    );

    fireEvent.press(getByTestId("open-monthly-history"));

    expect(getByText("No prior month")).toBeTruthy();
    fireEvent.press(getByTestId("snapshot-month-2026-01"));
    expect(getByTestId("selected-snapshot-summary")).toBeTruthy();
    expect(getByText("January 2026")).toBeTruthy();
    expect(getByText("+10.00% vs December 2025")).toBeTruthy();

    fireEvent.press(getByTestId("history-back"));
    fireEvent.press(getByTestId("snapshot-month-2026-05"));
    expect(getByText("No % baseline vs April 2026")).toBeTruthy();
    expect(queryByText("Financial note for 2026-05: ₹-20000")).toBeTruthy();
  });

  it("withholds non-null performance movement when the prior calendar month is missing", () => {
    const gapSummaries = [
      createSummary("2026-01", { portfolioValue: 100_000 }),
      createSummary("2026-03", {
        performance: { marketMovement: 4_000, totalValueChange: 9_000 },
        portfolioValue: 120_000,
      }),
    ];
    const { getAllByText, getByTestId, queryByText } = render(
      <MonthlyHistoryPanel maskWealthValues={false} minimal={false} summaries={gapSummaries} />,
    );

    fireEvent.press(getByTestId("open-monthly-history"));
    fireEvent.press(getByTestId("snapshot-month-2026-03"));

    expect(getAllByText("Unavailable")).toHaveLength(2);
    expect(queryByText("+₹9K")).toBeNull();
    expect(queryByText("+₹4K")).toBeNull();
  });

  it("restores the captured overview scroll offset after detail scrolling", () => {
    const scrollToSpy = jest.spyOn(ScrollView.prototype, "scrollTo");
    const animationFrameSpy = jest
      .spyOn(global, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 0;
      });
    const { getByTestId } = render(
      <MonthlyHistoryPanel maskWealthValues={false} minimal={false} summaries={summaries} />,
    );

    fireEvent.press(getByTestId("open-monthly-history"));
    fireEvent.scroll(getByTestId("monthly-history-scroll"), {
      nativeEvent: { contentOffset: { x: 0, y: 300 } },
    });
    fireEvent.press(getByTestId("snapshot-month-2026-04"));
    fireEvent.scroll(getByTestId("monthly-history-scroll"), {
      nativeEvent: { contentOffset: { x: 0, y: 900 } },
    });
    scrollToSpy.mockClear();

    fireEvent.press(getByTestId("history-back"));

    expect(scrollToSpy).toHaveBeenCalledWith({ animated: false, y: 300 });
    animationFrameSpy.mockRestore();
    scrollToSpy.mockRestore();
  });

  it("uses the modal Android back path to return from details before closing", () => {
    const { getByTestId, queryByTestId, UNSAFE_getByType } = render(
      <MonthlyHistoryPanel maskWealthValues={false} minimal={false} summaries={summaries} />,
    );

    fireEvent.press(getByTestId("open-monthly-history"));
    fireEvent.press(getByTestId("snapshot-month-2026-04"));
    expect(queryByTestId("selected-snapshot-summary")).toBeTruthy();

    act(() => {
      UNSAFE_getByType(Modal).props.onRequestClose();
    });
    expect(queryByTestId("selected-snapshot-summary")).toBeNull();

    act(() => {
      UNSAFE_getByType(Modal).props.onRequestClose();
    });
    expect(UNSAFE_getByType(Modal).props.visible).toBe(false);
  });

  it("masks financial values and omits financial notes", () => {
    const unavailableSummary = createSummary("2026-06", {
      expenseRate: null,
      monthlyExpense: undefined,
      performance: {
        marketMovement: null,
        netExternalFlow: null,
        status: "unavailable",
        totalValueChange: null,
      },
      portfolioValue: 123_456,
      salary: undefined,
      savingsRate: null,
    });
    const { getAllByText, getByTestId, queryByText } = render(
      <MonthlyHistoryPanel
        maskWealthValues
        minimal
        summaries={[...summaries, unavailableSummary]}
      />,
    );

    fireEvent.press(getByTestId("open-monthly-history"));
    fireEvent.press(getByTestId("snapshot-month-2026-06"));

    expect(getAllByText("₹••••").length).toBeGreaterThan(1);
    expect(getAllByText("Hidden").length).toBeGreaterThan(1);
    expect(queryByText("Financial note for 2026-06: ₹123456")).toBeNull();
    expect(queryByText("₹1.23L")).toBeNull();

    expect(queryByText("Unavailable")).toBeNull();
  });

  it("labels nullable snapshot and performance values as unavailable when unmasked", () => {
    const unavailableSummary = createSummary("2026-06", {
      expenseRate: null,
      monthlyExpense: undefined,
      performance: {
        marketMovement: null,
        netExternalFlow: null,
        status: "unavailable",
        totalValueChange: null,
      },
      salary: undefined,
      savingsRate: null,
    });
    const { getAllByText, getByTestId } = render(
      <MonthlyHistoryPanel maskWealthValues={false} minimal summaries={[...summaries, unavailableSummary]} />,
    );

    fireEvent.press(getByTestId("open-monthly-history"));
    fireEvent.press(getByTestId("snapshot-month-2026-06"));

    expect(getAllByText("Unavailable").length).toBeGreaterThanOrEqual(5);
  });
});
