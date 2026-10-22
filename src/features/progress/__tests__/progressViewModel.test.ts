import {
  formatChartAxisLabel,
  formatChartYLabel,
  formatMonth,
  formatOptionalSignedCompactINR,
  formatShortMonth,
  formatSignedCompactINR,
  getChartMaxValue,
  getChartPointRadius,
  getChartSpacing,
  getSelectedChange,
  getSeriesValue,
  getSingleEpfAccountId,
  shouldShowAxisLabel,
  snapshotStatusMessage,
} from "@/src/features/progress/progressViewModel";
import type { ProgressSnapshotAutomationStatus } from "@/src/features/progress";
import { MASKED_INR_VALUE } from "@/src/components/common";
import type { PortfolioStoreState } from "@/src/store";

function status(
  overrides: Partial<ProgressSnapshotAutomationStatus>,
): ProgressSnapshotAutomationStatus {
  return {
    availableThroughMonth: null,
    kind: "complete",
    message: "Monthly history is saved.",
    pendingMonths: [],
    progress: null,
    provisionalMonths: [],
    snapshot: null,
    status: "idle",
    targetMonth: "2026-09",
    warnings: [],
    ...overrides,
  };
}

describe("progress month labels", () => {
  it("formats stored months without shifting across time zones", () => {
    expect(formatMonth("2026-01")).toBe("January 2026");
    expect(formatShortMonth("2026-12")).toBe("Dec");
    expect(formatChartAxisLabel("Mar 2026")).toBe("Mar");
  });
});

describe("progress amounts", () => {
  it("signs changes explicitly and reports missing changes", () => {
    expect(formatSignedCompactINR(1500)).toMatch(/^\+/);
    expect(formatSignedCompactINR(-1500)).toMatch(/^-/);
    expect(formatSignedCompactINR(0)).not.toMatch(/^[+-]/);
    expect(formatOptionalSignedCompactINR(null)).toBe("Unavailable");
  });

  it("masks chart axis values", () => {
    expect(formatChartYLabel(250000, true)).toBe(MASKED_INR_VALUE);
    expect(formatChartYLabel("250000", false)).not.toBe(MASKED_INR_VALUE);
  });

  it("returns month-over-month change only when a prior value exists", () => {
    expect(getSelectedChange([100, 110], 0)).toBeNull();
    expect(getSelectedChange([0, 110], 1)).toBeNull();
    expect(getSelectedChange([200, 150], 1)).toBe(-25);
    expect(getSeriesValue([{ label: "Debt", values: [5, 7] }], "Debt", 1)).toBe(7);
    expect(getSeriesValue([], "Debt", 1)).toBe(0);
  });
});

describe("progress chart geometry", () => {
  it("rounds the axis maximum up to a readable step", () => {
    expect(getChartMaxValue([{ label: "Portfolio", values: [130] }])).toBe(200);
    expect(getChartMaxValue([{ label: "Portfolio", values: [4200] }])).toBe(5000);
    expect(getChartMaxValue([{ label: "Portfolio", values: [7000] }])).toBe(10000);
    expect(getChartMaxValue([{ label: "Portfolio", values: [] }])).toBe(2);
  });

  it("labels the ends and middle of longer ranges", () => {
    expect([0, 1, 2].map((i) => shouldShowAxisLabel(i, 3))).toEqual([true, true, true]);
    expect([0, 1, 2, 3, 4].map((i) => shouldShowAxisLabel(i, 5))).toEqual([
      true, false, true, false, true,
    ]);
  });

  it("shrinks points as ranges grow and emphasises the selected month", () => {
    expect(getChartPointRadius(6, 1)).toBe(3);
    expect(getChartPointRadius(20, 1)).toBe(2);
    expect(getChartPointRadius(36, 1)).toBe(0);
    expect(getChartPointRadius(36, 1, 1)).toBe(6);
  });

  it("centres a single point and spaces several across the width", () => {
    expect(getChartSpacing(1, 228)).toBe(114);
    expect(getChartSpacing(3, 228)).toBe((228 - 18 - 36) / 2);
    expect(getChartSpacing(500, 10)).toBe(0);
  });
});

describe("snapshot status copy", () => {
  it("reports month-by-month progress while history builds", () => {
    expect(
      snapshotStatusMessage(
        status({
          availableThroughMonth: "2026-07",
          kind: "generating",
          progress: { checkedCount: 2, currentMonth: "2026-08", totalCount: 5 },
        } as Partial<ProgressSnapshotAutomationStatus>),
      ),
    ).toBe(
      "2 of 5 months checked. Checking August 2026. Latest stored: July 2026. Keep CogVest open to continue.",
    );
  });

  it("explains missing PPF balances with the pending month count", () => {
    expect(
      snapshotStatusMessage(status({ kind: "incomplete-ppf", pendingMonths: ["2026-08"] })),
    ).toBe(
      "Full portfolio history cannot be completed without earlier confirmed PPF balances for 1 month.",
    );
  });

  it("adds the latest full snapshot when history is complete", () => {
    expect(
      snapshotStatusMessage(status({ availableThroughMonth: "2026-09" })),
    ).toBe("Monthly history is saved. Latest full snapshot: September 2026.");
    expect(snapshotStatusMessage(status({}))).toBe("Monthly history is saved.");
  });
});

describe("EPF shortcut", () => {
  it("opens an account directly only when there is exactly one", () => {
    const withAccounts = (ids: string[]) =>
      ({ epf: { accounts: ids.map((id) => ({ id })) } }) as unknown as PortfolioStoreState;
    expect(getSingleEpfAccountId(withAccounts(["epf-1"]))).toBe("epf-1");
    expect(getSingleEpfAccountId(withAccounts(["epf-1", "epf-2"]))).toBeUndefined();
    expect(getSingleEpfAccountId(withAccounts([]))).toBeUndefined();
  });
});
