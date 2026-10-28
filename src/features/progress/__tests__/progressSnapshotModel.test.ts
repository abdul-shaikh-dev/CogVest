import {
  automationMessage,
  automationStatusFromResult,
  emptyProgressFormValues,
  getCompletedMonthState,
  getDefaultCustomChartRange,
  getIncompletePpfHistoryMonths,
  getSnapshotStatusKind,
  normalizeCustomChartRange,
  presentSnapshotAutomationStatus,
  summarizeMonthlyWarnings,
  validateProgressSnapshotForm,
  type MonthEndSnapshotAutomationRunResult,
  type SnapshotAutomationStatusState,
} from "@/src/features/progress/progressSnapshotModel";
import type { PortfolioStoreState } from "@/src/store";
import type { MonthlySnapshot, PpfAccount } from "@/src/types";

function monthSnapshot(month: string): MonthlySnapshot {
  return {
    cashValue: 0,
    cryptoValue: 0,
    debtValue: 0,
    equityValue: 1000,
    id: `snapshot-${month}`,
    investedValue: 900,
    month,
    monthlyInvestment: 0,
    portfolioValue: 1000,
  };
}

const ppfAccount: PpfAccount = {
  balanceAsOf: "2026-04-01",
  confirmedBalance: 50000,
  createdAt: "2026-04-01T10:00:00.000Z",
  id: "ppf",
  nickname: "PPF",
  opening: { kind: "date", openedOn: "2026-01-10" },
  provider: "Bank",
  status: "active",
};

function automationState(
  overrides: Partial<SnapshotAutomationStatusState> = {},
): SnapshotAutomationStatusState {
  return {
    message: "",
    pendingMonths: [],
    progress: null,
    provisionalMonths: [],
    snapshot: null,
    status: "already-exists",
    targetMonth: "2026-05",
    warnings: [],
    ...overrides,
  };
}

function runResult(
  overrides: Partial<MonthEndSnapshotAutomationRunResult> = {},
): MonthEndSnapshotAutomationRunResult {
  return {
    createdCount: 0,
    lastCompletedMonth: "2026-05",
    pendingMonths: [],
    provisionalCount: 0,
    provisionalMonths: [],
    refreshedCount: 0,
    snapshot: null,
    status: "already-exists",
    targetMonths: [],
    warnings: [],
    ...overrides,
  };
}

describe("snapshot status kind", () => {
  const base = {
    hasData: true,
    hasIncompletePpfHistory: false,
    hasReconstructedHistory: false,
    hasStoredHistory: true,
  };

  it("ranks generation, empty and history states first", () => {
    const progress = { checkedCount: 0, currentMonth: "2026-05", totalCount: 1 };

    expect(getSnapshotStatusKind({ ...base, status: automationState({ progress }) })).toBe("generating");
    expect(getSnapshotStatusKind({ ...base, hasData: false, status: automationState() })).toBe("empty");
    expect(
      getSnapshotStatusKind({ ...base, hasReconstructedHistory: true, status: automationState() }),
    ).toBe("reconstructed-history");
    expect(
      getSnapshotStatusKind({ ...base, hasIncompletePpfHistory: true, status: automationState() }),
    ).toBe("incomplete-ppf");
  });

  it("separates price gaps from other record warnings", () => {
    const priced = automationState({ warnings: ["2026-05: Refresh prices for 1 holding."] });
    const other = automationState({ warnings: ["2026-05: A cash entry needs review."] });

    expect(getSnapshotStatusKind({ ...base, status: priced })).toBe("missing-price");
    expect(getSnapshotStatusKind({ ...base, status: other })).toBe("records-incomplete");
  });

  it("reports estimated, checking, waiting and complete states", () => {
    expect(
      getSnapshotStatusKind({ ...base, status: automationState({ provisionalMonths: ["2026-04"] }) }),
    ).toBe("estimated");
    expect(getSnapshotStatusKind({ ...base, status: automationState({ status: "idle" }) })).toBe("checking");
    expect(
      getSnapshotStatusKind({
        ...base,
        hasStoredHistory: false,
        status: automationState({ status: "insufficient-data" }),
      }),
    ).toBe("waiting-for-first-month");
    expect(getSnapshotStatusKind({ ...base, status: automationState() })).toBe("complete");
  });
});

describe("PPF history gaps", () => {
  it("lists months from opening until the first confirmed balance", () => {
    expect(getIncompletePpfHistoryMonths([ppfAccount], "2026-05")).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
    expect(getIncompletePpfHistoryMonths([ppfAccount], "2026-02")).toEqual(["2026-01", "2026-02"]);
  });

  it("ignores accounts linked to a legacy asset", () => {
    expect(
      getIncompletePpfHistoryMonths([{ ...ppfAccount, legacyAssetId: "asset-ppf" }], "2026-05"),
    ).toEqual([]);
  });
});

describe("custom chart range", () => {
  const snapshots = ["2026-03", "2026-01", "2026-02"].map(monthSnapshot);

  it("defaults to the full stored range", () => {
    expect(getDefaultCustomChartRange(snapshots)).toEqual({
      endMonth: "2026-03",
      startMonth: "2026-01",
    });
    expect(getDefaultCustomChartRange([])).toEqual({ endMonth: "", startMonth: "" });
  });

  it("keeps a valid range and resets one that no longer fits", () => {
    expect(
      normalizeCustomChartRange({ endMonth: "2026-03", startMonth: "2026-02" }, snapshots),
    ).toEqual({ endMonth: "2026-03", startMonth: "2026-02" });
    expect(
      normalizeCustomChartRange({ endMonth: "2026-02", startMonth: "2026-02" }, snapshots),
    ).toEqual({ endMonth: "2026-03", startMonth: "2026-01" });
    expect(
      normalizeCustomChartRange({ endMonth: "2025-12", startMonth: "2026-02" }, snapshots),
    ).toEqual({ endMonth: "2026-03", startMonth: "2026-02" });
  });
});

describe("manual snapshot form", () => {
  it("rejects a bad month and empty amounts", () => {
    const result = validateProgressSnapshotForm({ ...emptyProgressFormValues(), month: "May 2026" });

    expect(result.snapshot).toBeNull();
    expect(result.errors.month).toBe("Use YYYY-MM.");
    expect(result.errors.portfolioValue).toBe("Enter a valid amount.");
  });

  it("builds a manual snapshot without a performance basis", () => {
    const result = validateProgressSnapshotForm({
      cashValue: "100",
      cryptoValue: "0",
      debtValue: "200",
      equityValue: "700",
      investedValue: "800",
      month: " 2026-05 ",
      monthlyInvestment: "50",
      notes: "  ",
      portfolioValue: "1000",
    });

    expect(result.errors).toEqual({});
    expect(result.snapshot).toMatchObject({
      month: "2026-05",
      notes: undefined,
      performanceBasis: { reason: "manual-snapshot", status: "unavailable" },
      portfolioValue: 1000,
    });
  });
});

describe("automation messages", () => {
  it("explains created, refreshed and pending months", () => {
    expect(automationMessage({ ...runResult(), createdCount: 2, status: "created" })).toBe(
      "2 missing month snapshots generated automatically.",
    );
    expect(automationMessage({ ...runResult(), refreshedCount: 1 })).toBe(
      "1 estimated snapshot updated with better month-end values.",
    );
    expect(
      automationMessage({
        ...runResult(),
        pendingMonths: ["2026-04", "2026-05"],
        warnings: ["2026-05: Refresh prices for 1 holding."],
      }),
    ).toBe("2 months are waiting for historical prices.");
    expect(automationMessage({ ...runResult(), pendingMonths: ["2026-05"] })).toBe(
      "1 month could not be completed from the recorded portfolio data.",
    );
  });

  it("turns a finished run into the shown status", () => {
    const snapshot = monthSnapshot("2026-05");

    expect(automationStatusFromResult(runResult({ provisionalCount: 1, provisionalMonths: ["2026-04"], snapshot }))).toEqual({
      message: "Some completed months still use estimated values.",
      pendingMonths: [],
      progress: null,
      provisionalMonths: ["2026-04"],
      snapshot,
      status: "already-exists",
      targetMonth: "2026-05",
      warnings: [],
    });
  });

  it("groups the same warning across months", () => {
    expect(
      summarizeMonthlyWarnings([
        "Price missing for 2026-03: ABC",
        "Price missing for 2026-01: ABC",
        "Price missing for 2026-01: ABC",
        "Price missing for 2026-02: XYZ",
        "Ungrouped warning",
      ]),
    ).toEqual([
      "Ungrouped warning",
      "Price missing across 2 months (2026-01 to 2026-03): ABC",
      "Price missing for 2026-02: XYZ",
    ]);
  });
});

describe("completed month state", () => {
  function state(overrides: Partial<PortfolioStoreState>) {
    return {
      cashEntries: [],
      monthlySnapshots: [],
      openingPositions: [],
      ppfAccounts: [],
      trades: [],
      ...overrides,
    } as unknown as PortfolioStoreState;
  }

  it("finds the latest snapshot and whether records exist by month end", () => {
    const result = getCompletedMonthState(
      state({
        cashEntries: [{ date: "2026-05-31T10:00:00.000Z" }] as PortfolioStoreState["cashEntries"],
        monthlySnapshots: ["2026-04", "2026-06", "2026-05"].map(monthSnapshot),
      }),
      "2026-05",
    );

    expect(result.latestCompletedSnapshot?.month).toBe("2026-05");
    expect(result.hasCompletedPortfolioRecord).toBe(true);
    expect(result.provisionalMonths).toEqual([]);
  });

  it("ignores records after the completed month", () => {
    const result = getCompletedMonthState(
      state({ trades: [{ date: "2026-06-01T00:00:00.000Z" }] as PortfolioStoreState["trades"] }),
      "2026-05",
    );

    expect(result).toEqual({
      hasCompletedPortfolioRecord: false,
      latestCompletedSnapshot: null,
      provisionalMonths: [],
    });
  });
});

describe("presented automation status", () => {
  const input = {
    activeProgress: null,
    automationStatus: automationState({ snapshot: monthSnapshot("2026-04") }),
    hasData: true,
    latestStoredSnapshot: monthSnapshot("2026-04"),
    now: new Date("2026-06-15T12:00:00.000Z"),
    ppfAccounts: [],
    reconstructedSnapshots: null,
  };

  it("shows stored history through its latest month", () => {
    expect(presentSnapshotAutomationStatus(input)).toMatchObject({
      availableThroughMonth: "2026-04",
      kind: "complete",
    });
  });

  it("shows a running build while progress is published", () => {
    const status = presentSnapshotAutomationStatus({
      ...input,
      activeProgress: { checkedCount: 1, currentMonth: "2026-05", totalCount: 2 },
    });

    expect(status).toMatchObject({
      kind: "generating",
      message: "Building monthly history.",
      targetMonth: "2026-05",
    });
  });

  it("prefers reconstructed history and lists PPF gaps as pending", () => {
    const status = presentSnapshotAutomationStatus({
      ...input,
      ppfAccounts: [ppfAccount],
      reconstructedSnapshots: ["2026-05", "2026-03"].map(monthSnapshot),
    });

    expect(status).toMatchObject({
      availableThroughMonth: "2026-05",
      kind: "reconstructed-history",
      pendingMonths: ["2026-01", "2026-02", "2026-03"],
    });
  });
});
