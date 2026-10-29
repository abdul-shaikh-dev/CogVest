import type { EpfAccount, EpfEvent } from "@/src/domain/epf";
import { ppfCashLeg } from "@/src/domain/ppfCashLinks";
import {
  buildWholePortfolioXirrInput, measurementBasisProblems, measurementEvidenceDigest, type WholePortfolioXirrInput,
} from "@/src/domain/wholePortfolioXirr";
import { summariseXirr } from "@/src/domain/xirrSummary";
import type { Asset, BuyTrade, CashEntry, Distribution, MeasurementBasis, PpfAccount, PpfLedgerEntry } from "@/src/types";

// Every scenario turns 10,000 put in on 1 Jan 2025 into 11,000 on 1 Jan 2026: exactly 10% a year.
const endDate = "2026-01-01";
const stock: Asset = { id: "stock", name: "Synthetic", symbol: "SYN", ticker: "SYN.NS", currency: "INR", assetClass: "stock", exchange: "NSE" };
const quote = { asOf: "2026-01-01T10:00:00.000Z", assetId: "stock", currency: "INR" as const, price: 110, source: "yahoo" as const };
const inception: MeasurementBasis = { startDate: "2025-01-01", kind: "inception", openingValueInr: null, openingBreakdown: [],
  confirmedAt: "2025-01-01T00:00:00Z", evidenceDigest: null };
const empty: WholePortfolioXirrInput = {
  assets: [], trades: [], openingPositions: [], quotes: {}, distributions: [], distributionCoverage: [],
  ppfAccounts: [], ppfLedgerEntries: [], epf: { accounts: [], events: [] }, futuresAccounts: [], cashEntries: [],
  endDate, today: endDate, valuationTime: "2026-01-01T12:00:00Z", basis: inception,
};
const deposit: CashEntry = { id: "dep", amount: 10000, date: "2025-01-01", label: "Deposit", purpose: "capitalContribution", type: "addition" };
const buy: BuyTrade = { id: "buy", assetId: "stock", type: "buy", date: "2025-01-01", quantity: 100, pricePerUnit: 100, totalValue: 10000 };
const funding: CashEntry = { id: "fund", amount: 10000, date: "2025-01-01", label: "Buy", purpose: "purchaseFunding", type: "withdrawal", linkedTradeId: "buy" };
const market: Partial<WholePortfolioXirrInput> = {
  assets: [stock], trades: [buy], cashEntries: [deposit, funding], quotes: { stock: quote },
  distributionCoverage: [{ assetId: "stock", from: "2025-01-01", confirmedAt: "2025-01-01T00:00:00Z" }],
};

const input = (overrides: Partial<WholePortfolioXirrInput>) => ({ ...empty, ...overrides });
const reasons = (overrides: Partial<WholePortfolioXirrInput>) => {
  const result = buildWholePortfolioXirrInput(input(overrides));
  return result.status === "unavailable" ? result.reasons.map((item) => item.reason) : [];
};
const rate = (overrides: Partial<WholePortfolioXirrInput>) => {
  const summary = summariseXirr(buildWholePortfolioXirrInput(input(overrides)));
  if (summary.status !== "rate") throw new Error(JSON.stringify(summary));
  return summary;
};
function openingBasis(records: Partial<WholePortfolioXirrInput>, startDate = "2025-01-01", value = 10000): MeasurementBasis {
  return { startDate, kind: "openingValue", openingValueInr: value, openingBreakdown: [{ label: "Holdings", valueInr: value }],
    confirmedAt: `${startDate}T00:00:00Z`, evidenceDigest: measurementEvidenceDigest(input(records), startDate) };
}

describe("whole-portfolio XIRR (D9-D11)", () => {
  it("counts the Cash deposit, not the Cash-funded buy, and values holdings plus Cash at the end", () => {
    const summary = rate(market);
    expect(summary.rate).toBeCloseTo(0.1, 9);
    expect(summary.flows.map((flow) => [flow.source, flow.amountInr])).toEqual([["cash", "-10000"], ["terminal", "11000"]]);
  });

  it("includes idle Cash in the end value", () => {
    const summary = rate({ cashEntries: [deposit, { ...deposit, id: "dep2", date: "2025-12-31" }] });
    expect(summary.flows.at(-1)).toMatchObject({ source: "terminal", amountInr: "20000" });
  });

  it("measures from a confirmed opening value, ignoring history before the start", () => {
    const earlyBuy: BuyTrade = { ...buy, id: "early", date: "2024-06-01" };
    const records = { assets: [stock], trades: [earlyBuy], quotes: { stock: quote }, distributionCoverage: market.distributionCoverage };
    const summary = rate({ ...records, basis: openingBasis(records) });
    expect(summary.rate).toBeCloseTo(0.1, 9);
    expect(summary.startDate).toBe("2025-01-01");
    expect(summary.flows[0]).toMatchObject({ source: "opening", date: "2025-01-01", amountInr: "-10000" });
  });

  it("asks for the opening value again when a record on or before the start changes", () => {
    const earlyBuy: BuyTrade = { ...buy, id: "early", date: "2024-06-01" };
    const records = { assets: [stock], trades: [earlyBuy], quotes: { stock: quote }, distributionCoverage: market.distributionCoverage };
    const basis = openingBasis(records);
    expect(reasons({ ...records, trades: [{ ...earlyBuy, quantity: 101 }], basis })).toEqual(["basis-needs-reconfirming"]);
    // A later record doesn't touch the evidence; field order (say, after a restore) doesn't either.
    const reordered = Object.fromEntries(Object.entries(earlyBuy).reverse()) as BuyTrade;
    expect(measurementEvidenceDigest(input({ trades: [reordered, { ...buy, id: "later", date: "2025-02-01" }] }), "2025-01-01"))
      .toBe(basis.evidenceDigest);
  });

  it.each<[string, Partial<WholePortfolioXirrInput>, string]>([
    ["no basis", { ...market, basis: null }, "no-measurement-basis"],
    ["a lifetime start after earlier records", { ...market, basis: { ...inception, startDate: "2025-02-01" } }, "records-before-start"],
    ["an uncategorised Cash entry", { ...market, cashEntries: [deposit, funding, { ...deposit, id: "old", purpose: "legacyUncategorized" }] }, "cash-uncategorized"],
    ["a trade with no Cash link or funding source", { ...market, cashEntries: [deposit] }, "trade-funding-unknown"],
    ["a transfer of holdings", { ...market, trades: [buy, { id: "in", assetId: "stock", type: "transferIn", date: "2025-03-01", quantity: 1 }] }, "transfer-without-value"],
    ["payouts not recorded", { ...market, distributionCoverage: [] }, "distributions-not-recorded"],
    ["a stale price", { ...market, quotes: { stock: { ...quote, asOf: "2025-12-01T10:00:00.000Z" } } }, "stale-quote"],
  ])("blocks %s", (_name, overrides, reason) => {
    expect(reasons(overrides)).toContain(reason);
  });

  it("fingerprints every stored record when the flows leave some out", () => {
    const earlyBuy: BuyTrade = { ...buy, id: "early", date: "2024-06-01" };
    const replaced: BuyTrade = { ...buy, id: "legacy", assetId: "legacy-ppf", date: "2024-01-01" };
    const records = { assets: [stock], trades: [earlyBuy], quotes: { stock: quote }, distributionCoverage: market.distributionCoverage };
    const evidence = input({ ...records, trades: [earlyBuy, replaced] });
    const basis = openingBasis({ ...records, trades: [earlyBuy, replaced] });
    expect(reasons({ ...records, basis })).toEqual(["basis-needs-reconfirming"]);
    expect(rate({ ...records, basis, evidence }).rate).toBeCloseTo(0.1, 9);
  });

  it("counts a trade paid from outside CogVest at its own amount", () => {
    const summary = rate({ ...market, trades: [{ ...buy, fundingSource: "external" }], cashEntries: [] });
    expect(summary.rate).toBeCloseTo(0.1, 9);
    expect(summary.flows[0]).toMatchObject({ source: "trade", amountInr: "-10000" });
  });

  it("counts payouts paid outside as money out, and keeps payouts to Cash inside", () => {
    const outside: Distribution = { id: "div", assetId: "stock", paidOn: "2025-07-01", grossAmount: 500, taxWithheld: 0,
      treatment: "paidOutside", recordedAt: "2025-07-01T00:00:00Z" };
    expect(rate({ ...market, distributions: [outside] }).flows.find((flow) => flow.id === "div")).toMatchObject({ amountInr: "500" });
    const toCash = { ...outside, treatment: "paidToCash" as const, linkedCashEntryId: "div:cash" };
    const cash: CashEntry = { id: "div:cash", amount: 500, date: "2025-07-01", label: "Payout", purpose: "distribution",
      type: "addition", linkedDistributionId: "div" };
    const summary = rate({ ...market, distributions: [toCash], cashEntries: [deposit, funding, cash] });
    expect(summary.flows.some((flow) => flow.id === "div" || flow.id === "div:cash")).toBe(false);
    expect(summary.flows.at(-1)).toMatchObject({ amountInr: "11500" });
  });

  describe("PPF funding (D11)", () => {
    const ppf: PpfAccount = { id: "ppf", nickname: "PPF", provider: "Post office", status: "active", balanceAsOf: "2024-12-31",
      confirmedBalance: 0, createdAt: "2024-12-31T00:00:00Z", opening: { kind: "date", openedOn: "2024-12-31" } };
    const interest: PpfLedgerEntry = { id: "int", accountId: "ppf", date: "2025-03-31", recordedAt: "x", type: "interestCredit", amount: 1000, financialYearStart: 2024 };
    const contribution = (fundingSource?: "cash" | "external"): PpfLedgerEntry =>
      ({ id: "ppf-dep", accountId: "ppf", date: "2025-01-01", recordedAt: "x", type: "contribution", amount: 10000, ...(fundingSource ? { fundingSource } : {}) });

    it("blocks a deposit until its source is known", () => {
      expect(reasons({ ppfAccounts: [ppf], ppfLedgerEntries: [contribution(), interest] })).toEqual(["ppf-funding-unknown"]);
    });

    it("treats a deposit from Cash and its Cash leg as moving inside the portfolio", () => {
      const entry = contribution("cash");
      const summary = rate({ ppfAccounts: [ppf], ppfLedgerEntries: [entry, interest],
        cashEntries: [deposit, ppfCashLeg(entry as Extract<PpfLedgerEntry, { type: "contribution" }>, "PPF")] });
      expect(summary.rate).toBeCloseTo(0.1, 9);
      expect(summary.flows.map((flow) => flow.source)).toEqual(["cash", "terminal"]);
    });

    it("counts a deposit from outside as money in", () => {
      expect(rate({ ppfAccounts: [ppf], ppfLedgerEntries: [contribution("external"), interest] }).rate).toBeCloseTo(0.1, 9);
    });
  });

  describe("EPF", () => {
    const account: EpfAccount = { id: "epf", nickname: "Acme", provider: "epfo", status: "active", currency: "INR",
      historyCompleteThrough: endDate, checkpoint: { date: "2024-12-31", balance: { total: 0, components: { employee: 0, employer: 0 } },
        capital: 0, source: "epfoStatement", recordedAt: "2024-12-31T00:00:00Z" } };
    const base = (id: string, date: string) => ({ id, accountId: "epf", effectiveDate: date, postedDate: date, evidence: "Statement", recordedAt: `${date}T00:00:00Z` });
    const events: EpfEvent[] = [
      { ...base("ee", "2025-01-01"), type: "contribution", party: "employee", amount: 6000 },
      { ...base("er", "2025-01-01"), type: "contribution", party: "employer", amount: 4000 },
      { ...base("int", "2025-12-31"), type: "interest", amount: { total: 1000, components: { employee: 600, employer: 400 } } },
    ];

    it("counts salary contributions, employee and employer, as money in", () => {
      expect(rate({ epf: { accounts: [account], events } }).rate).toBeCloseTo(0.1, 9);
    });

    it("blocks a withdrawal whose destination is unknown", () => {
      const withdrawal: EpfEvent = { ...base("out", "2025-12-31"), type: "withdrawal", amount: { total: 100, components: { employee: 100, employer: 0 } },
        capitalReduction: null, destination: "unknown" };
      expect(reasons({ epf: { accounts: [account], events: [...events, withdrawal] } })).toEqual(["epf-withdrawal-destination"]);
    });
  });

  it("validates a basis before it is saved", () => {
    expect(measurementBasisProblems({ startDate: "2025-01-01", kind: "openingValue", openingBreakdown: [] }, endDate))
      .toEqual(["Add at least one opening value."]);
    expect(measurementBasisProblems({ startDate: "2026-02-01", kind: "inception", openingBreakdown: [] }, endDate))
      .toEqual(["Start date can't be in the future."]);
    expect(measurementBasisProblems({ startDate: "2025-01-01", kind: "openingValue",
      openingBreakdown: [{ label: " ", valueInr: 1.005 }] }, endDate)).toEqual(["Each opening value needs a name.", "Opening values must be zero or more, to the paisa."]);
    expect(measurementBasisProblems({ startDate: "2025-01-01", kind: "openingValue", openingBreakdown: [{ label: "Bank", valueInr: 100 }] }, endDate)).toEqual([]);
  });
});
