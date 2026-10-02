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
    investedValue = 75_000,
    monthlyInvestment = 30_000,
    performance = {},
    portfolioValue = 100_000,
  }: Partial<{
    cashValue: number;
    investedValue: number;
    monthlyInvestment: number;
    performance: Partial<MonthlyProgressSummary["performance"]>;
    portfolioValue: number;
  }> = {},
): MonthlyProgressSummary {
  const snapshot: MonthlySnapshot = {
    cashValue,
    cryptoValue: 5_000,
    debtValue: 25_000,
    equityValue: portfolioValue - cashValue - 30_000,
    id: `snapshot-${month}`,
    investedValue,
    month,
    monthlyInvestment,
    notes: `Financial note for ${month}: ₹${portfolioValue}`,
    portfolioValue,
  };

  return {
    assetSnapshot: [
      { assetClass: "stock", percentage: 60, value: snapshot.equityValue },
      { assetClass: "debt", percentage: 25, value: snapshot.debtValue },
      { assetClass: "crypto", percentage: 5, value: snapshot.cryptoValue },
      { assetClass: "cash", percentage: 10, value: snapshot.cashValue },
    ],
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
    snapshot,
  };
}

describe("MonthlyHistoryPanel", () => {
  it("uses the selected month's remaining basis and shows exact non-cash detail", () => {
    const screen = render(<MonthlyHistoryPanel maskWealthValues={false} minimal={false} summaries={[
      createSummary("2026-01", { portfolioValue: 170000, cashValue: 50000, investedValue: 100000 }),
      createSummary("2026-02", { portfolioValue: 400000, cashValue: 200000, investedValue: 300000 }),
    ]} />);
    fireEvent.press(screen.getByTestId("open-monthly-history"));
    expect(screen.getByTestId("snapshot-invested-comparison-2026-01")).toHaveTextContent("+20.00%");
    expect(screen.getByTestId("snapshot-invested-comparison-2026-02")).toHaveTextContent("-33.33%");
    fireEvent.press(screen.getByTestId("snapshot-month-2026-01"));
    expect(screen.getByTestId("snapshot-invested-percentage")).toHaveTextContent("+20.00%");
    expect(screen.getByText("₹1,20,000.00")).toBeTruthy();
    expect(screen.getByText("₹1,00,000.00")).toBeTruthy();
    expect(screen.getByText("+₹20,000.00")).toBeTruthy();
  });

  it("uses neutral zero and unavailable states, and hides comparison signs/colors when masked", () => {
    const summaries = [
      createSummary("2026-01", { portfolioValue: 100000, cashValue: 25000 }),
      createSummary("2026-02", { investedValue: 0 }),
      createSummary("2026-03", { investedValue: 200000 }),
    ];
    const screen = render(<MonthlyHistoryPanel maskWealthValues={false} minimal={false} summaries={summaries} />);
    fireEvent.press(screen.getByTestId("open-monthly-history"));
    const zero = screen.getByTestId("snapshot-invested-comparison-2026-01");
    expect(zero).toHaveTextContent("0.00%");
    expect(zero).not.toHaveStyle({ color: colors.profit });
    expect(screen.getByTestId("snapshot-invested-comparison-2026-02")).toHaveTextContent("—");
    screen.rerender(<MonthlyHistoryPanel maskWealthValues minimal={false} summaries={summaries} />);
    expect(screen.getByTestId("snapshot-invested-comparison-2026-03")).not.toHaveStyle({ color: colors.loss });
    expect(screen.getByTestId("snapshot-invested-comparison-2026-03")).toHaveTextContent("••••");
    fireEvent.press(screen.getByTestId("snapshot-month-2026-03"));
    expect(screen.getByTestId("snapshot-invested-percentage")).toHaveTextContent("••••");
    expect(screen.queryByText("-55.00%")).toBeNull();
  });

  it("scales portfolio value bars within the selected year independently of the invested comparison", () => {
    const screen = render(<MonthlyHistoryPanel maskWealthValues={false} minimal={false} summaries={[
      createSummary("2025-12", { portfolioValue: 400_000 }),
      createSummary("2026-01", { portfolioValue: 100_000 }),
      createSummary("2026-02", { portfolioValue: 200_000 }),
      createSummary("2026-03", { portfolioValue: 0 }),
    ]} />);
    fireEvent.press(screen.getByTestId("open-monthly-history"));
    expect(screen.getByTestId("snapshot-value-bar-2026-01", { includeHiddenElements: true })).toHaveStyle({ width: "50%" });
    expect(screen.getByTestId("history-bar-scale")).toHaveTextContent("Bars: portfolio value relative to 2026's highest month");
    expect(screen.getByTestId("snapshot-value-bar-2026-02", { includeHiddenElements: true })).toHaveStyle({ width: "100%" });
    expect(screen.getByTestId("snapshot-value-bar-2026-03", { includeHiddenElements: true })).toHaveStyle({ width: "0%" });
    expect(screen.getByTestId("snapshot-month-2026-01").props.accessibilityLabel).toContain("+20.00%");
    fireEvent.press(screen.getByText("2025"));
    expect(screen.getByTestId("history-bar-scale")).toHaveTextContent("Bars: portfolio value relative to 2025's highest month");
    expect(screen.getByTestId("snapshot-value-bar-2025-12", { includeHiddenElements: true })).toHaveStyle({ width: "100%" });
  });

  it.each([
    { masked: true, values: [100_000, 200_000] },
    { masked: false, values: [-100, 200_000] },
    { masked: false, values: [0, 0] },
  ])("omits value bars for masked, signed or zero-only histories: %j", ({ masked, values }) => {
    const screen = render(<MonthlyHistoryPanel maskWealthValues={masked} minimal={false} summaries={
      values.map((portfolioValue, index) => createSummary(`2026-0${index + 1}`, { portfolioValue }))
    } />);
    fireEvent.press(screen.getByTestId("open-monthly-history"));
    expect(screen.queryByTestId("snapshot-value-bar-2026-01", { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId("history-bar-scale")).toBeNull();
    expect(screen.queryByTestId("snapshot-value-bar-2026-02", { includeHiddenElements: true })).toBeNull();
  });

  const summaries = [
    createSummary("2025-12", { portfolioValue: 100_000 }),
    createSummary("2026-01", { portfolioValue: 110_000 }),
    createSummary("2026-03", { portfolioValue: 90_000 }),
    createSummary("2026-04", { portfolioValue: 0 }),
    createSummary("2026-05", { portfolioValue: -20_000 }),
  ];

  it("keeps signed invested comparisons semantic in Minimal mode", () => {
    const { getByTestId, getByText } = render(
      <MonthlyHistoryPanel
        maskWealthValues={false}
        minimal
        summaries={summaries}
      />,
    );

    fireEvent.press(getByTestId("open-monthly-history"));

    expect(getByText("+33.33%")).toHaveStyle({ color: colors.profit });
    expect(getByTestId("snapshot-month-2026-01").props.accessibilityLabel).toContain(
      "+33.33% versus this month's recorded invested basis, excluding cash",
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
    expect(getByText("Vs invested")).toBeTruthy();
    expect(getByText("Vs invested excludes cash")).toBeTruthy();
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

  it("compares each month's own basis independently of prior months or gaps", () => {
    const screen = render(
      <MonthlyHistoryPanel maskWealthValues={false} minimal={false} summaries={summaries} />,
    );

    fireEvent.press(screen.getByTestId("open-monthly-history"));

    const january = screen.getByTestId("snapshot-month-2026-01");
    expect(within(january).getByText("+33.33%")).toBeTruthy();
    expect(within(january).queryByText(/vs December/u)).toBeNull();
    const march = screen.getByTestId("snapshot-month-2026-03");
    expect(march.props.accessibilityLabel).toContain("versus this month's recorded invested basis, excluding cash");
    const may = screen.getByTestId("snapshot-month-2026-05");
    expect(within(may).getByText("—")).toBeTruthy();

    fireEvent.press(screen.getByTestId("history-year-2025"));
    const first = screen.getByTestId("snapshot-month-2025-12");
    expect(within(first).getByText("+20.00%")).toBeTruthy();
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
    expect(within(mayRow).queryByText("Estimated")).toBeNull();
    expect(within(screen.getByTestId("snapshot-month-2026-04")).getByText("Estimated")).toBeTruthy();
    fireEvent.press(mayRow);
    expect(screen.getByText("This comparison uses estimated prices.")).toBeTruthy();
    expect(screen.getByText("Portfolio change includes deposits and withdrawals; it is not investment return.")).toBeTruthy();
  });

  it("masks the invested percentage and its accessibility label along with the portfolio", () => {
    const screen = render(
      <MonthlyHistoryPanel maskWealthValues minimal={false} summaries={summaries} />,
    );

    fireEvent.press(screen.getByTestId("open-monthly-history"));
    const january = screen.getByTestId("snapshot-month-2026-01");
    expect(within(january).getByText(MASKED_INR_VALUE)).toBeTruthy();
    expect(within(january).getByText("••••")).toBeTruthy();
    expect(january.props.accessibilityLabel).toContain("Comparison hidden");
    expect(january.props.accessibilityLabel).not.toContain("33.33");
    expect(january.props.accessibilityLabel).toContain("Portfolio hidden");
    expect(january.props.accessibilityLabel).not.toContain("₹1,10,000.00");
  });

  it("opens a dedicated month page and compares only with the immediate calendar month", () => {
    const { getByTestId, getByText, queryByText } = render(
      <MonthlyHistoryPanel maskWealthValues={false} minimal={false} summaries={summaries} />,
    );

    fireEvent.press(getByTestId("open-monthly-history"));

    fireEvent.press(getByTestId("snapshot-month-2026-03"));
    expect(getByText("Previous month unavailable portfolio value change")).toBeTruthy();
    fireEvent.press(getByTestId("history-back"));
    fireEvent.press(getByTestId("snapshot-month-2026-01"));
    expect(getByTestId("selected-snapshot-summary")).toBeTruthy();
    expect(getByText("January 2026")).toBeTruthy();
    expect(getByText("+10.00% portfolio value change")).toBeTruthy();
    expect(getByText("Dec 2025")).toBeTruthy();
    expect(getByText("Jan 2026")).toBeTruthy();

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
      performance: {
        marketMovement: null,
        netExternalFlow: null,
        status: "unavailable",
        totalValueChange: null,
      },
      portfolioValue: 123_456,
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
    expect(getAllByText("+717.28% portfolio value change")).toHaveLength(1);
    expect(getAllByText("60.00% allocation")).toHaveLength(1);
    expect(queryByText("Hidden")).toBeNull();
    expect(queryByText("Financial note for 2026-06: ₹123456")).toBeNull();
    expect(queryByText("₹1.23L")).toBeNull();

    expect(getAllByText("Unavailable").length).toBeGreaterThan(1);
  });

  it("labels nullable snapshot and performance values as unavailable when unmasked", () => {
    const unavailableSummary = createSummary("2026-06", {
      performance: {
        marketMovement: null,
        netExternalFlow: null,
        status: "unavailable",
        totalValueChange: null,
      },
    });
    const { getAllByText, getByTestId } = render(
      <MonthlyHistoryPanel maskWealthValues={false} minimal summaries={[...summaries, unavailableSummary]} />,
    );

    fireEvent.press(getByTestId("open-monthly-history"));
    fireEvent.press(getByTestId("snapshot-month-2026-06"));

    expect(getAllByText("Unavailable").length).toBeGreaterThanOrEqual(3);
  });
});
