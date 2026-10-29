import type { EpfAccount, EpfEvent } from "@/src/domain/epf";
import type { UsdmFuturesAccount } from "@/src/domain/usdmFutures";
import { buildInvestmentsXirrInput, type InvestmentsXirrInput } from "@/src/domain/xirrInputs";
import { summariseXirr } from "@/src/domain/xirrSummary";
import type { Asset, CashEntry, PpfAccount, PpfLedgerEntry } from "@/src/types";

// Each account turns -10,000 on 1 Jan 2025 into 11,000 on 1 Jan 2026: exactly 10% a year.
const endDate = "2026-01-01";
const empty: InvestmentsXirrInput = {
  assets: [], trades: [], openingPositions: [], quotes: {}, distributions: [], distributionCoverage: [],
  ppfAccounts: [], ppfLedgerEntries: [], epf: { accounts: [], events: [] }, futuresAccounts: [], cashEntries: [],
  endDate, today: endDate, valuationTime: "2026-01-01T12:00:00Z",
};
const input = (overrides: Partial<InvestmentsXirrInput>) => ({ ...empty, ...overrides });
const reasons = (overrides: Partial<InvestmentsXirrInput>) => {
  const result = buildInvestmentsXirrInput(input(overrides));
  return result.status === "unavailable" ? result.reasons.map((item) => item.reason) : [];
};
const rate = (overrides: Partial<InvestmentsXirrInput>) => {
  const summary = summariseXirr(buildInvestmentsXirrInput(input(overrides)));
  if (summary.status !== "rate") throw new Error(JSON.stringify(summary));
  return summary;
};

const ppf: PpfAccount = { id: "ppf", nickname: "PPF", provider: "Post office", status: "active", balanceAsOf: "2024-12-31",
  confirmedBalance: 0, createdAt: "2024-12-31T00:00:00Z", opening: { kind: "date", openedOn: "2024-12-31" } };
const ppfEntry = (id: string, date: string, type: "contribution" | "interestCredit" | "withdrawal", amount: number): PpfLedgerEntry =>
  ({ id, accountId: "ppf", date, recordedAt: `${date}T00:00:00Z`, type, amount, ...(type === "interestCredit" ? { financialYearStart: 2024 } : {}) } as PpfLedgerEntry);

const epfAccount: EpfAccount = { id: "epf", nickname: "Acme", provider: "epfo", status: "active", currency: "INR",
  historyCompleteThrough: endDate, checkpoint: { date: "2024-12-31", balance: { total: 0, components: { employee: 0, employer: 0 } },
    capital: 0, source: "epfoStatement", recordedAt: "2024-12-31T00:00:00Z" } };
const epfBase = (id: string, date: string) => ({ id, accountId: "epf", effectiveDate: date, postedDate: date, evidence: "Statement", recordedAt: `${date}T00:00:00Z` });
const epfEvents: EpfEvent[] = [
  { ...epfBase("ee", "2025-01-01"), type: "contribution", party: "employee", amount: 6000 },
  { ...epfBase("er", "2025-01-01"), type: "contribution", party: "employer", amount: 4000 },
  { ...epfBase("int", "2025-12-31"), type: "interest", amount: { total: 1000, components: { employee: 600, employer: 400 } } },
];

const stock: Asset = { id: "stock", name: "Synthetic", symbol: "SYN", ticker: "SYN.NS", currency: "INR", assetClass: "stock", exchange: "NSE" };

describe("Investments XIRR across accounts (D8)", () => {
  it("measures PPF from its deposits to its confirmed balance, noting the uncredited interest", () => {
    const summary = rate({ ppfAccounts: [ppf], ppfLedgerEntries: [ppfEntry("dep", "2025-01-01", "contribution", 10000),
      ppfEntry("int", "2025-03-31", "interestCredit", 1000)] });
    expect(summary.rate).toBeCloseTo(0.1, 9);
    expect(summary.notes).toEqual(["PPF uses its confirmed balance, without interest earned since the last credit."]);
  });

  it("measures EPF from employee and employer contributions, with interest as return", () => {
    const summary = rate({ epf: { accounts: [epfAccount], events: epfEvents } });
    expect(summary.rate).toBeCloseTo(0.1, 9);
    expect(summary.flows.map((flow) => [flow.date, flow.amountInr])).toEqual([
      ["2025-01-01", "-6000"], ["2025-01-01", "-4000"], [endDate, "11000"],
    ]);
  });

  it("counts a withdrawal once and a reversed contribution as returned", () => {
    const summary = rate({ epf: { accounts: [epfAccount], events: [...epfEvents,
      { ...epfBase("extra", "2025-06-01"), type: "contribution", party: "employee", amount: 500 },
      { ...epfBase("undo", "2025-06-02"), type: "reversal", reversesId: "extra", reason: "Posted twice" },
    ] } });
    expect(summary.rate).toBeCloseTo(0.1, 2);
    expect(summary.flows.filter((flow) => flow.id === "extra" || flow.id === "undo").map((flow) => flow.amountInr)).toEqual(["-500", "500"]);
  });

  it.each([
    ["an EPF history not confirmed to today", { epf: { accounts: [{ ...epfAccount, historyCompleteThrough: null }], events: epfEvents } }, "epf-history-incomplete"],
    ["an unexplained EPF balance update", { epf: { accounts: [epfAccount], events: [...epfEvents, { ...epfBase("rec", "2025-12-31"), type: "reconciliation",
      balance: { total: 11000, components: { employee: 6600, employer: 4400 } }, capital: null, reason: "Passbook" } as EpfEvent] } }, "epf-reconciliation"],
    ["an unexplained PPF correction", { ppfAccounts: [ppf], ppfLedgerEntries: [ppfEntry("dep", "2025-01-01", "contribution", 10000),
      { id: "rec", accountId: "ppf", date: "2025-06-01", recordedAt: "x", type: "reconciliation", confirmedBalance: 10500, reason: "Passbook" }] }, "ppf-reconciliation"],
  ])("blocks %s", (_name, overrides, reason) => {
    expect(reasons(overrides as Partial<InvestmentsXirrInput>)).toContain(reason);
  });

  it("blocks an account whose starting balance comes after the period start", () => {
    const lateEpf = { ...epfAccount, checkpoint: { ...epfAccount.checkpoint, date: "2025-06-30",
      balance: { total: 5000, components: { employee: 3000, employer: 2000 } }, capital: null } };
    expect(reasons({ epf: { accounts: [lateEpf], events: [] }, ppfAccounts: [ppf],
      ppfLedgerEntries: [ppfEntry("dep", "2025-01-01", "contribution", 10000)] })).toEqual(["account-history-after-start"]);
    // The same balance is a valid opening value when nothing starts earlier.
    expect(reasons({ epf: { accounts: [lateEpf], events: [] } })).toEqual([]);
  });

  it("leaves Cash holdings outside the boundary instead of blocking", () => {
    const cash: Asset = { ...stock, id: "cash", assetClass: "cash", ticker: "CASH" };
    expect(reasons({ assets: [cash], openingPositions: [{ id: "o", assetId: "cash", quantity: 1, averageCostPrice: 1, date: null }],
      ppfAccounts: [ppf], ppfLedgerEntries: [ppfEntry("dep", "2025-01-01", "contribution", 10000)] })).toEqual([]);
    expect(reasons({})).toEqual(["no-assets"]);
  });

  describe("Futures", () => {
    const account: UsdmFuturesAccount = {
      id: "wallet", settlementAsset: "USDT", marginMode: "cross", positionMode: "one-way",
      openingAt: "2025-01-01T00:00:00Z", openingWalletUsdt: "100", openingRate: { inrPerUsdt: "100", observedAt: "2025-01-01T00:00:00Z", source: "Receipt" },
      events: [{ type: "funding", id: "fund", at: "2025-06-01T00:00:00Z", amountUsdt: "10", contract: "BTCUSDT" }],
      eventRates: [{ eventId: "fund", inrPerUsdt: "100", observedAt: "2025-06-01T00:00:00Z", source: "Receipt" }],
      valuation: { asOf: "2026-01-01T00:00:00Z", marks: [], inrRate: { inrPerUsdt: "100", observedAt: "2026-01-01T00:00:00Z", source: "Receipt" },
        reconciliation: { observedWalletUsdt: "110", observedAt: "2026-01-01T00:00:00Z", source: "Wallet", allOpenPositionsConfirmed: true,
          allWalletEventsConfirmed: true, portfolioBoundaryConfirmed: true } },
    };

    it("uses the starting wallet at its rate and reconciled equity at the end; funding is return", () => {
      const summary = rate({ futuresAccounts: [account] });
      expect(summary.rate).toBeCloseTo(0.1, 9);
      expect(summary.flows.map((flow) => flow.amountInr)).toEqual(["-10000", "11000"]);
    });

    it("counts a Cash-funded transfer at its Cash amount", () => {
      const cash: CashEntry = { id: "c1", amount: 5000, date: "2025-07-01", label: "To Futures", purpose: "futuresTransfer",
        type: "withdrawal", linkedFutures: { accountId: "wallet", eventId: "t1" } } as CashEntry;
      const funded: UsdmFuturesAccount = { ...account,
        events: [...account.events, { type: "transfer", id: "t1", at: "2025-07-01T00:00:00Z", amountUsdt: "50", transferBoundary: "internal", linkedCashEntryId: "c1" }],
        eventRates: [...account.eventRates!, { eventId: "t1", inrPerUsdt: "100", observedAt: "2025-07-01T00:00:00Z", source: "Receipt" }],
        valuation: { ...account.valuation!, reconciliation: { ...account.valuation!.reconciliation, observedWalletUsdt: "160" } } };
      const summary = rate({ futuresAccounts: [funded], cashEntries: [cash] });
      expect(summary.flows.find((flow) => flow.id === "t1")).toMatchObject({ date: "2025-07-01", amountInr: "-5000" });
    });

    it("blocks without a current reconciled valuation", () => {
      expect(reasons({ futuresAccounts: [{ ...account, valuation: undefined }] })).toEqual(["futures-not-valued"]);
      expect(reasons({ futuresAccounts: [account], endDate: "2026-01-20", today: "2026-01-20", valuationTime: "2026-01-01T00:00:00Z" }))
        .toEqual(["futures-stale-valuation"]);
    });
  });
});
