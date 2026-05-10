import { fireEvent, render } from "@testing-library/react-native";

import { ProgressScreen } from "@/src/features/progress";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { MonthlySnapshot } from "@/src/types";

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
  portfolioValue: 1385000,
  salary: 160000,
};

describe("ProgressScreen", () => {
  it("shows the no-snapshot state before monthly records exist", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    const { getByText } = render(<ProgressScreen store={store} />);

    expect(getByText("No monthly snapshots yet")).toBeTruthy();
    expect(
      getByText("Record a month-end snapshot to track progress without Excel."),
    ).toBeTruthy();
  });

  it("saves a monthly snapshot from the screen form", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByTestId, getByText } = render(<ProgressScreen store={store} />);

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
    fireEvent.press(getByText("Save Monthly Snapshot"));

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
      portfolioValue: 1385000,
      salary: 160000,
    });
    expect(getByText("May 2026")).toBeTruthy();
  });

  it("renders persisted monthly gain, rates, and asset snapshot", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addMonthlySnapshot(aprilSnapshot);
    store.getState().addMonthlySnapshot(maySnapshot);

    const { getAllByText, getByText } = render(<ProgressScreen store={store} />);

    expect(getAllByText("₹13,85,000.00").length).toBeGreaterThan(0);
    expect(getByText("+₹1,25,000.00 (+9.92%)")).toBeTruthy();
    expect(getByText("₹60,000.00")).toBeTruthy();
    expect(getByText("+37.50%")).toBeTruthy();
    expect(getByText("+25.00%")).toBeTruthy();
    expect(getAllByText("Equity").length).toBeGreaterThan(0);
    expect(getByText("₹8,80,000.00")).toBeTruthy();
    expect(getByText("May close")).toBeTruthy();
  });

  it("updates an existing month instead of creating duplicate snapshots", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addMonthlySnapshot(maySnapshot);
    const { getByTestId, getByText } = render(<ProgressScreen store={store} />);

    fireEvent.changeText(getByTestId("snapshot-month-input"), "2026-05");
    fireEvent.changeText(getByTestId("snapshot-portfolio-input"), "1400000");
    fireEvent.changeText(getByTestId("snapshot-invested-input"), "1070000");
    fireEvent.changeText(getByTestId("snapshot-equity-input"), "890000");
    fireEvent.changeText(getByTestId("snapshot-debt-input"), "320000");
    fireEvent.changeText(getByTestId("snapshot-crypto-input"), "50000");
    fireEvent.changeText(getByTestId("snapshot-cash-input"), "140000");
    fireEvent.changeText(getByTestId("snapshot-investment-input"), "70000");
    fireEvent.changeText(getByTestId("snapshot-salary-input"), "160000");
    fireEvent.press(getByText("Save Monthly Snapshot"));

    expect(store.getState().monthlySnapshots).toHaveLength(1);
    expect(store.getState().monthlySnapshots[0]).toMatchObject({
      id: maySnapshot.id,
      investedValue: 1070000,
      monthlyInvestment: 70000,
      portfolioValue: 1400000,
    });
  });
});
