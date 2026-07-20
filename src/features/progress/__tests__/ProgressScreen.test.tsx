import { fireEvent, render } from "@testing-library/react-native";

import { ProgressScreen, ReviewSnapshotScreen } from "@/src/features/progress";
import { useReducedMotionPreference } from "@/src/hooks";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { colors } from "@/src/theme";
import type { Asset, CashEntry, MonthlySnapshot, OpeningPosition } from "@/src/types";

jest.mock("@/src/hooks", () => ({
  useReducedMotionPreference: jest.fn(() => false),
}));

const aprilSnapshot: MonthlySnapshot = {
  cashValue: 120000,
  cryptoValue: 40000,
  debtValue: 300000,
  equityValue: 800000,
  id: "snapshot-2026-04",
  investedValue: 1000000,
  month: "2026-04",
  monthlyExpense: 30000,
  monthlyInvestment: 50000,
  portfolioValue: 1260000,
  salary: 150000,
};

const maySnapshot: MonthlySnapshot = {
  cashValue: 140000,
  cryptoValue: 45000,
  debtValue: 320000,
  equityValue: 880000,
  id: "snapshot-2026-05",
  investedValue: 1060000,
  month: "2026-05",
  monthlyExpense: 40000,
  monthlyInvestment: 60000,
  notes: "May close",
  performanceBasis: {
    netExternalFlow: 60000,
    status: "complete",
    warnings: [],
    weightedExternalFlow: 60000,
  },
  portfolioValue: 1385000,
  salary: 160000,
};

const marchSnapshot: MonthlySnapshot = {
  cashValue: 150000,
  cryptoValue: 110000,
  debtValue: 305000,
  equityValue: 910000,
  id: "snapshot-2026-03",
  investedValue: 1295000,
  month: "2026-03",
  monthlyExpense: 54000,
  monthlyInvestment: 50000,
  portfolioValue: 1475000,
  salary: 170000,
};

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

describe("ProgressScreen", () => {
  beforeEach(() => {
    jest.mocked(useReducedMotionPreference).mockReturnValue(false);
  });

  it("shows the no-snapshot state before monthly records exist", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    const { getByText } = render(<ProgressScreen store={store} />);

    expect(getByText("No monthly snapshots yet")).toBeTruthy();
    expect(
      getByText("Snapshots are created automatically once your portfolio has data. Review a snapshot only when a correction is needed."),
    ).toBeTruthy();
  });

  it("shows compact snapshot automation status instead of the manual form", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    seedHoldingAndCash(store);

    const { findByText, queryByTestId } = render(
      <ProgressScreen
        now={new Date("2026-08-02T10:00:00.000Z")}
        store={store}
      />,
    );

    expect(await findByText("Month-end snapshot")).toBeTruthy();
    expect(queryByTestId("month-end-snapshot-status-card")).toBeTruthy();
    expect(queryByTestId("snapshot-portfolio-input")).toBeNull();
  });

  it("opens the dedicated snapshot review flow", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onReviewSnapshot = jest.fn();
    const { getByText, queryByTestId } = render(
      <ProgressScreen onReviewSnapshot={onReviewSnapshot} store={store} />,
    );

    fireEvent.press(getByText("Review snapshot"));

    expect(onReviewSnapshot).toHaveBeenCalledTimes(1);
    expect(queryByTestId("snapshot-portfolio-input")).toBeNull();
  });
  it("prefills the latest generated snapshot for optional correction", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addMonthlySnapshot(maySnapshot);

    const { getByTestId, getByText } = render(
      <ReviewSnapshotScreen
        onCancel={jest.fn()}
        onComplete={jest.fn()}
        store={store}
      />,
    );

    expect(getByText("Review Snapshot")).toBeTruthy();
    expect(getByTestId("snapshot-month-input").props.value).toBe("2026-05");
    expect(getByTestId("snapshot-portfolio-input").props.value).toBe("1385000");
    expect(getByTestId("snapshot-notes-input").props.value).toBe("May close");
  });

  it("cancels a review without persisting field changes", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addMonthlySnapshot(maySnapshot);
    const onCancel = jest.fn();
    const { getByTestId } = render(
      <ReviewSnapshotScreen
        onCancel={onCancel}
        onComplete={jest.fn()}
        store={store}
      />,
    );

    fireEvent.changeText(getByTestId("snapshot-portfolio-input"), "1400000");
    fireEvent.press(getByTestId("cancel-snapshot-review-button"));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(store.getState().monthlySnapshots[0]?.portfolioValue).toBe(1385000);
  });
  it("saves snapshot changes from the dedicated review screen", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onComplete = jest.fn();
    const { getByTestId, getByText } = render(
      <ReviewSnapshotScreen
        onCancel={jest.fn()}
        onComplete={onComplete}
        store={store}
      />,
    );

    fireEvent.changeText(getByTestId("snapshot-month-input"), "2026-05");
    fireEvent.changeText(getByTestId("snapshot-portfolio-input"), "1385000");
    fireEvent.changeText(getByTestId("snapshot-invested-input"), "1060000");
    fireEvent.changeText(getByTestId("snapshot-equity-input"), "880000");
    fireEvent.changeText(getByTestId("snapshot-debt-input"), "320000");
    fireEvent.changeText(getByTestId("snapshot-crypto-input"), "45000");
    fireEvent.changeText(getByTestId("snapshot-cash-input"), "140000");
    fireEvent.changeText(getByTestId("snapshot-investment-input"), "60000");
    fireEvent.changeText(getByTestId("snapshot-salary-input"), "160000");
    fireEvent.changeText(getByTestId("snapshot-expense-input"), "40000");
    fireEvent.press(getByText("Save snapshot changes"));

    expect(store.getState().monthlySnapshots).toHaveLength(1);
    expect(store.getState().monthlySnapshots[0]).toMatchObject({
      cashValue: 140000,
      cryptoValue: 45000,
      debtValue: 320000,
      equityValue: 880000,
      investedValue: 1060000,
      month: "2026-05",
      monthlyExpense: 40000,
      monthlyInvestment: 60000,
      performanceBasis: {
        reason: "manual-snapshot",
        status: "unavailable",
      },
      portfolioValue: 1385000,
      salary: 160000,
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
  it("renders contribution-adjusted performance and asset snapshot", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addMonthlySnapshot(aprilSnapshot);
    store.getState().addMonthlySnapshot(maySnapshot);

    const { getAllByText, getByText } = render(<ProgressScreen store={store} />);

    expect(getAllByText("₹13,85,000.00").length).toBeGreaterThan(0);
    expect(getByText("₹13.85L")).toBeTruthy();
    expect(getByText("+₹65K")).toBeTruthy();
    expect(getByText("+₹60K")).toBeTruthy();
    expect(getByText("₹60K")).toBeTruthy();
    expect(
      getByText("Market +₹65,000.00 · total +₹1,25,000.00"),
    ).toBeTruthy();
    expect(getAllByText("Equity").length).toBeGreaterThan(0);
    expect(getByText("₹8,80,000.00")).toBeTruthy();
    expect(getByText("May close")).toBeTruthy();
  });

  it("labels legacy snapshot performance unavailable instead of guessing", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addMonthlySnapshot(aprilSnapshot);
    store.getState().addMonthlySnapshot({
      ...maySnapshot,
      performanceBasis: undefined,
    });

    const { getAllByText, getByText } = render(
      <ProgressScreen store={store} />,
    );

    expect(getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(
      getByText("Performance unavailable · total +₹1,25,000.00"),
    ).toBeTruthy();
  });

  it("shows an insufficient chart-history state until two snapshots exist", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addMonthlySnapshot(maySnapshot);

    const { getByText } = render(<ProgressScreen store={store} />);

    expect(getByText("Trend history is still building")).toBeTruthy();
    expect(
      getByText("Record at least 2 monthly snapshots to compare portfolio and asset trends."),
    ).toBeTruthy();
  });

  it("renders value gap and asset momentum charts without cash in asset trends", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addMonthlySnapshot(maySnapshot);
    store.getState().addMonthlySnapshot(aprilSnapshot);

    const {
      getAllByTestId,
      getByTestId,
      getByText,
      queryByTestId,
      queryByText,
    } = render(<ProgressScreen store={store} />);

    expect(getByText("Value Gap")).toBeTruthy();
    expect(getByText("Portfolio value against invested capital")).toBeTruthy();
    expect(getByText("Asset Momentum")).toBeTruthy();
    expect(getByText("Absolute value trend - cash excluded")).toBeTruthy();
    expect(queryByText("Apr 2026")).toBeNull();
    expect(getByText("+30.66%")).toBeTruthy();
    expect(getByText("Crypto +12.50%")).toBeTruthy();
    expect(getByTestId("portfolio-trend-Portfolio")).toBeTruthy();
    expect(getByTestId("portfolio-trend-Invested")).toBeTruthy();
    const [portfolioChart] = getAllByTestId("gifted-line-chart");

    expect(portfolioChart.props.color1).toBe(
      colors.primary,
    );
    expect(portfolioChart.props.color2).toBe(
      colors.text.primary,
    );
    expect(getByTestId("asset-trend-Equity")).toBeTruthy();
    expect(getByTestId("asset-trend-Debt")).toBeTruthy();
    expect(getByTestId("asset-trend-Crypto")).toBeTruthy();
    expect(queryByTestId("asset-trend-Cash")).toBeNull();
  });

  it("masks chart axis and chart-native y labels when wealth masking is enabled", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addMonthlySnapshot(maySnapshot);
    store.getState().addMonthlySnapshot(aprilSnapshot);
    store.getState().updatePreferences({ maskWealthValues: true });

    const {
      getAllByTestId,
      getByTestId,
      getAllByText,
      queryByText,
    } = render(
      <ProgressScreen store={store} />,
    );
    const [portfolioChart] = getAllByTestId("gifted-line-chart");

    expect(getByTestId("portfolio-trend-y-axis-0")).toHaveTextContent("₹••••");
    expect(getAllByText("₹••••").length).toBeGreaterThanOrEqual(3);
    expect(queryByText("₹20L")).toBeNull();
    expect(queryByText("₹13,85,000.00")).toBeNull();
    expect(getAllByText("Performance values hidden").length).toBeGreaterThan(0);
    expect(portfolioChart.props.formatYLabel("2000000")).toBe("₹••••");
  });

  it("disables chart animation when reduced motion is enabled", () => {
    jest.mocked(useReducedMotionPreference).mockReturnValue(true);

    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addMonthlySnapshot(maySnapshot);
    store.getState().addMonthlySnapshot(aprilSnapshot);

    const { getAllByTestId } = render(<ProgressScreen store={store} />);
    const [portfolioChart, assetChart] = getAllByTestId("gifted-line-chart");

    expect(portfolioChart.props.isAnimated).toBe(false);
    expect(assetChart.props.isAnimated).toBe(false);
  });

  it("renders chart-local timeframe chips and updates selected range", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addMonthlySnapshot(marchSnapshot);
    store.getState().addMonthlySnapshot(aprilSnapshot);
    store.getState().addMonthlySnapshot(maySnapshot);

    const { getByTestId, queryByText } = render(
      <ProgressScreen store={store} />,
    );

    expect(getByTestId("portfolio-monthly-chart-range-3M")).toBeTruthy();
    expect(getByTestId("portfolio-monthly-chart-range-6M")).toBeTruthy();
    expect(getByTestId("portfolio-monthly-chart-range-1Y")).toBeTruthy();
    expect(getByTestId("portfolio-monthly-chart-range-All")).toBeTruthy();
    expect(getByTestId("asset-monthly-chart-range-3M")).toBeTruthy();
    expect(getByTestId("asset-monthly-chart-range-6M")).toBeTruthy();
    expect(getByTestId("asset-monthly-chart-range-1Y")).toBeTruthy();
    expect(getByTestId("asset-monthly-chart-range-All")).toBeTruthy();

    fireEvent.press(getByTestId("portfolio-monthly-chart-range-3M"));
    fireEvent.press(getByTestId("asset-monthly-chart-range-3M"));

    expect(queryByText("Mar 2026")).toBeNull();
  });

  it("updates an existing month instead of creating duplicate snapshots", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addMonthlySnapshot(maySnapshot);
    const onComplete = jest.fn();
    const { getByTestId, getByText } = render(
      <ReviewSnapshotScreen
        onCancel={jest.fn()}
        onComplete={onComplete}
        store={store}
      />,
    );

    fireEvent.changeText(getByTestId("snapshot-month-input"), "2026-05");
    fireEvent.changeText(getByTestId("snapshot-portfolio-input"), "1400000");
    fireEvent.changeText(getByTestId("snapshot-invested-input"), "1070000");
    fireEvent.changeText(getByTestId("snapshot-equity-input"), "890000");
    fireEvent.changeText(getByTestId("snapshot-debt-input"), "320000");
    fireEvent.changeText(getByTestId("snapshot-crypto-input"), "50000");
    fireEvent.changeText(getByTestId("snapshot-cash-input"), "140000");
    fireEvent.changeText(getByTestId("snapshot-investment-input"), "70000");
    fireEvent.changeText(getByTestId("snapshot-salary-input"), "160000");
    fireEvent.press(getByText("Save snapshot changes"));

    expect(store.getState().monthlySnapshots).toHaveLength(1);
    expect(store.getState().monthlySnapshots[0]).toMatchObject({
      id: maySnapshot.id,
      investedValue: 1070000,
      monthlyInvestment: 70000,
      performanceBasis: maySnapshot.performanceBasis,
      portfolioValue: 1400000,
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
