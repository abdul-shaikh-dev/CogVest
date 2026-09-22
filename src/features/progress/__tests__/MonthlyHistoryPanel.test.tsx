import { act, cleanup, fireEvent, render, within } from "@testing-library/react-native";
import { Modal, ScrollView } from "react-native";

import { MASKED_INR_VALUE } from "@/src/components/common";
import { MonthlyHistoryPanel } from "@/src/features/progress/MonthlyHistoryPanel";
import type { MonthlyProgressSummary } from "@/src/domain/calculations";
import { colors } from "@/src/theme";
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

  it("keeps signed monthly changes semantic in Minimal mode", () => {
    const { getByTestId, getByText } = render(
      <MonthlyHistoryPanel
        maskWealthValues={false}
        minimal
        summaries={summaries}
      />,
    );

    fireEvent.press(getByTestId("open-monthly-history"));

    expect(getByText("+10.00%")).toHaveStyle({ color: colors.profit });
    expect(getByTestId("snapshot-month-2026-01").props.accessibilityLabel).toContain(
      "Monthly change +10.00% compared with December 2025",
    );
  });

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
    expect(getByText("Monthly change")).toBeTruthy();
    expect(getByText("Includes deposits and withdrawals")).toBeTruthy();
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

  it("keeps eleven years on one scrollable selector and selects an older year", () => {
    const longHistory = Array.from({ length: 11 }, (_, index) =>
      createSummary(`${2016 + index}-01`),
    );
    const screen = render(
      <MonthlyHistoryPanel maskWealthValues={false} minimal={false} summaries={longHistory} />,
    );

    fireEvent.press(screen.getByTestId("open-monthly-history"));

    expect(screen.getByTestId("history-year-scroll").props.horizontal).toBe(true);
    expect(screen.getByTestId("history-year-2026").props.accessibilityState).toEqual({ selected: true });
    fireEvent.press(screen.getByTestId("history-year-2016"));
    expect(screen.getByTestId("history-year-2016").props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId("snapshot-month-2016-01")).toBeTruthy();
  });

  it("shows only actual monthly changes and explains gaps, first months, and zero baselines", () => {
    const screen = render(
      <MonthlyHistoryPanel maskWealthValues={false} minimal={false} summaries={summaries} />,
    );

    fireEvent.press(screen.getByTestId("open-monthly-history"));

    const january = screen.getByTestId("snapshot-month-2026-01");
    expect(within(january).getByText("+10.00%")).toBeTruthy();
    expect(within(january).queryByText(/vs December/u)).toBeNull();
    const march = screen.getByTestId("snapshot-month-2026-03");
    expect(within(march).getByText("—")).toBeTruthy();
    expect(march.props.accessibilityLabel).toContain("No snapshot for February 2026");
    const may = screen.getByTestId("snapshot-month-2026-05");
    expect(within(may).getByText("—")).toBeTruthy();
    expect(may.props.accessibilityLabel).toContain("April 2026 portfolio value was zero");

    fireEvent.press(screen.getByTestId("history-year-2025"));
    const first = screen.getByTestId("snapshot-month-2025-12");
    expect(within(first).getByText("—")).toBeTruthy();
    expect(first.props.accessibilityLabel).toContain("First stored month; monthly change unavailable");
  });

  it("marks estimated comparisons and keeps full context in details", () => {
    const april = createSummary("2026-04", { portfolioValue: 100_000 });
    april.snapshot.generated = {
      confidence: "provisional",
      generatedAt: "2026-05-01T00:00:00.000Z",
      priceBasis: "manual-fallback",
      source: "auto",
      warnings: [],
    };
    const may = createSummary("2026-05", { portfolioValue: 110_000 });
    const screen = render(
      <MonthlyHistoryPanel maskWealthValues={false} minimal={false} summaries={[april, may]} />,
    );

    fireEvent.press(screen.getByTestId("open-monthly-history"));
    const mayRow = screen.getByTestId("snapshot-month-2026-05");
    expect(within(mayRow).getByText("Estimated")).toBeTruthy();
    expect(mayRow.props.accessibilityLabel).toContain("Comparison uses estimated prices");
    fireEvent.press(mayRow);
    expect(screen.getByText("This comparison uses estimated prices.")).toBeTruthy();
    expect(screen.getByText("Portfolio change includes deposits and withdrawals; it is not investment return.")).toBeTruthy();
  });

  it("masks the portfolio amount in the row label while keeping signed change context", () => {
    const screen = render(
      <MonthlyHistoryPanel maskWealthValues minimal={false} summaries={summaries} />,
    );

    fireEvent.press(screen.getByTestId("open-monthly-history"));
    const january = screen.getByTestId("snapshot-month-2026-01");
    expect(within(january).getByText(MASKED_INR_VALUE)).toBeTruthy();
    expect(within(january).getByText("+10.00%")).toBeTruthy();
    expect(january.props.accessibilityLabel).toContain("Portfolio hidden");
    expect(january.props.accessibilityLabel).not.toContain("₹1,10,000.00");
  });

  it("opens a dedicated month page and compares only with the immediate calendar month", () => {
    const { getByTestId, getByText, queryByText } = render(
      <MonthlyHistoryPanel maskWealthValues={false} minimal={false} summaries={summaries} />,
    );

    fireEvent.press(getByTestId("open-monthly-history"));

    expect(getByTestId("snapshot-month-2026-03").props.accessibilityLabel).toContain(
      "No snapshot for February 2026",
    );
    fireEvent.press(getByTestId("snapshot-month-2026-01"));
    expect(getByTestId("selected-snapshot-summary")).toBeTruthy();
    expect(getByText("January 2026")).toBeTruthy();
    expect(getByText("+10.00% vs December 2025 portfolio value change")).toBeTruthy();

    fireEvent.press(getByTestId("history-back"));
    fireEvent.press(getByTestId("snapshot-month-2026-05"));
    expect(getByText("Percentage unavailable · prior value was zero portfolio value change")).toBeTruthy();
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

  it("masks financial amounts while retaining percentages and unavailable states", () => {
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

    expect(getAllByText(MASKED_INR_VALUE).length).toBeGreaterThan(1);
    expect(getAllByText("+717.28% vs May 2026 portfolio value change")).toHaveLength(1);
    expect(getAllByText("60.00% allocation")).toHaveLength(1);
    expect(queryByText("Hidden")).toBeNull();
    expect(queryByText("Financial note for 2026-06: ₹123456")).toBeNull();
    expect(queryByText("₹1.23L")).toBeNull();

    expect(getAllByText("Unavailable").length).toBeGreaterThan(1);
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
