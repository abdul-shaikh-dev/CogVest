import { summarizeEpfForReporting, includeEpfInPortfolioTotals, epfContributionsForMonth } from "../reporting";
import { emptyEpfState } from "../persistence";
import { calculatePortfolioRollupTotals } from "@/src/domain/calculations/holdings";
import { calculateReportingAllocation } from "@/src/domain/calculations/reportingAllocation";
import type { EpfState } from "../persistence";

const fixture = (capital: number | null = null): EpfState => ({ ...emptyEpfState(), accounts: [{
  id: "epf", nickname: "EPF", provider: "epfo", status: "active", currency: "INR", historyCompleteThrough: null,
  checkpoint: { date: "2026-01-01", balance: { total: 140000, components: null }, capital,
    source: "epfoStatement", recordedAt: "2026-01-02T00:00:00Z" },
}] });
const date = "2026-10-05";
const base = calculatePortfolioRollupTotals([], 10000, [], { confirmedBalance: 50000, investedBasis: 40000 });

test("includes recorded value while preserving unknown capital and evidence dates", () => {
  const epf = fixture();
  const before = JSON.stringify(epf);
  const summary = summarizeEpfForReporting(epf, date);
  const result = includeEpfInPortfolioTotals(base, summary);
  expect(result.capitalComplete).toBe(false);
  expect(result.totals).toMatchObject({ totalCurrentValue: 200000, pnl: null, pnlPct: null });
  expect(summary.accounts[0]).toMatchObject({ lastEvidenceDate: "2026-01-01", historyComplete: false });
  expect(JSON.stringify(epf)).toBe(before);
  expect(summarizeEpfForReporting(epf, "2025-12-31").value).toBeNull();
});

test("adds confirmed basis and value, but not Cash to holdings P&L", () => {
  const result = includeEpfInPortfolioTotals(base, summarizeEpfForReporting(fixture(120000), date));
  expect(result.capitalComplete).toBe(true);
  expect(result.totals).toMatchObject({ totalCurrentValue: 200000, totalInvested: 160000, pnl: 30000, pnlPct: 18.75 });
});

test("missing EPF evidence never becomes a zero balance or a complete allocation", () => {
  const epf = fixture();
  epf.accounts.push(epf.accounts[0]);
  const summary = summarizeEpfForReporting(epf, date);
  expect(summary.value).toBeNull();
  expect(includeEpfInPortfolioTotals(base, summary).totals.totalCurrentValue).toBeNull();
  expect(calculateReportingAllocation({ holdings: [], cashBalance: 0, ppfConfirmedBalance: 50000,
    futuresEquityInr: 0, epfRecordedBalance: summary.value })).toEqual([]);
});

test("empty EPF preserves every existing rollup value", () => {
  expect(includeEpfInPortfolioTotals(base, summarizeEpfForReporting(emptyEpfState(), date)).totals).toEqual(base);
});

test("transfer in transit preserves combined EPF wealth without creating capital", () => {
  const epf = fixture(120000);
  epf.accounts.push({ ...epf.accounts[0], id: "new", checkpoint: { ...epf.accounts[0].checkpoint,
    balance: { total: 0, components: null }, capital: 0 } });
  epf.events.push({ id: "transfer", type: "transfer", sourceId: "epf", destinationId: "new",
    status: "inTransit", amount: { total: 140000, components: null }, capital: 120000,
    effectiveDate: "2026-02-01", postedDate: "2026-02-01", recordedAt: "2026-02-02T00:00:00Z",
    creditDate: null, evidence: "Transfer statement" });
  expect(summarizeEpfForReporting(epf, date)).toMatchObject({ value: 140000, capital: 120000, inTransit: 140000 });
});

test("employer contributions count as capital, linked Cash and interest do not count again", () => {
  const epf = fixture(120000);
  const evidence = { accountId: "epf", effectiveDate: "2026-10-01", postedDate: "2026-10-01",
    recordedAt: "2026-10-02T00:00:00Z", evidence: "Statement" };
  epf.events.push({ ...evidence, id: "employer", type: "contribution", party: "employer", amount: 5000 },
    { ...evidence, id: "employee", type: "contribution", party: "employee", amount: 2000 },
    { ...evidence, id: "interest", type: "interest", amount: { total: 1000, components: null } });
  epf.cashLinks.push({ eventId: "employee", cashEntryId: "cash" });
  expect(epfContributionsForMonth(epf, date)).toBe(5000);
  expect(summarizeEpfForReporting(epf, date)).toMatchObject({ value: 148000, capital: 127000 });
  epf.events.push({ ...evidence, id: "reverse", type: "reversal", reversesId: "employer",
    effectiveDate: "2026-10-03", postedDate: "2026-10-03", recordedAt: "2026-10-04T00:00:00Z", reason: "Correction" });
  expect(epfContributionsForMonth(epf, date)).toBe(0);
});
