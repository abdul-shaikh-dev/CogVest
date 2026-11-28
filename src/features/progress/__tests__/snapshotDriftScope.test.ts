import {
  recalculateSavedSnapshot,
  type SnapshotDriftCheckRecords,
} from "@/src/domain/calculations";
import { createRealShapedFixture, realShapedIds } from "@/src/testing/realShapedFixture";
import { historicalQuoteCacheKey, type HistoricalQuoteCache, type MonthlySnapshot, type QuoteCache } from "@/src/types";

import { createDriftRecordFingerprints } from "../snapshotDriftCache";

// #852: a month whose records fingerprint is unchanged reuses its cached drift
// answer. This checks, on a long realistic history, that such a month really
// works out the same from the edited records as from the original ones.
const fixture = createRealShapedFixture(new Date("2026-11-15T06:00:00.000Z"));
const { portfolio } = fixture.payload;
const base: SnapshotDriftCheckRecords = {
  assets: portfolio.assets,
  cashEntries: portfolio.cashEntries,
  distributions: portfolio.distributions,
  now: new Date("2026-11-15T12:00:00Z"),
  openingPositions: portfolio.openingPositions,
  ppfAccounts: portfolio.ppfAccounts,
  ppfLedgerEntries: portfolio.ppfLedgerEntries,
  trades: portfolio.trades,
};

/** The month as the drift check works it out: from records, at neutral prices. */
function recalculate(records: SnapshotDriftCheckRecords, saved: MonthlySnapshot) {
  const quoteCache: QuoteCache = Object.fromEntries(records.assets.map((asset) => [asset.id, {
    asOf: records.now.toISOString(), assetId: asset.id, currency: asset.currency, price: 1, source: "manual" as const,
  }]));
  const historicalQuotes: HistoricalQuoteCache = Object.fromEntries(records.assets.map((asset) => [
    historicalQuoteCacheKey(asset.id, saved.month), {
      asOfMonth: saved.month, assetId: asset.id, basis: "reconciled-historical-close" as const, currency: asset.currency,
      fetchedAt: records.now.toISOString(), price: 1, source: "manual" as const,
    },
  ]));
  const result = recalculateSavedSnapshot({ ...records, historicalQuotes, quoteCache }, saved);
  if (!result.ok) return result;
  const { generated: _generated, ...values } = result.snapshot;
  return values;
}

const sip = portfolio.trades.find((item) => item.assetId === realShapedIds.fund("cedar-nifty"))!;
const midTrade = portfolio.trades.find((item) => item.type === "buy" && item.date.startsWith("2022-03"))!;
const edits: { name: string; firstChangedMonth: string; records: SnapshotDriftCheckRecords }[] = [
  {
    firstChangedMonth: "2026-10",
    name: "this month's SIP added",
    records: { ...base, trades: [...base.trades, { ...sip, date: "2026-10-20", id: "edit-new-sip" }] },
  },
  {
    firstChangedMonth: "2022-06",
    name: "a back-dated cash addition",
    records: { ...base, cashEntries: [...base.cashEntries, { ...base.cashEntries[0], date: "2022-06-10", id: "edit-cash" }] },
  },
  {
    firstChangedMonth: "2022-03",
    name: "an older trade corrected",
    records: { ...base, trades: base.trades.map((item) => item.id === midTrade.id && item.type === "buy"
      ? { ...item, quantity: item.quantity * 2, totalValue: Math.round(item.totalValue * 200) / 100 }
      : item) },
  },
];

describe.each(edits)("after $name", ({ firstChangedMonth, records }) => {
  const before = createDriftRecordFingerprints(base);
  const after = createDriftRecordFingerprints(records);
  const months = portfolio.monthlySnapshots;

  it("keeps earlier months' fingerprints and changes the rest", () => {
    for (const saved of months) {
      expect([saved.month, after(saved.month) === before(saved.month)])
        .toEqual([saved.month, saved.month < firstChangedMonth]);
    }
  });

  it("works out every month whose fingerprint held exactly as before", () => {
    const kept = months.filter((saved) => after(saved.month) === before(saved.month));
    // The three months nearest the edit, and a spread of earlier ones.
    const sample = kept.filter((_, index) => index % 6 === 0 || index >= kept.length - 3);
    expect(sample.length).toBeGreaterThan(3);
    for (const saved of sample) {
      expect([saved.month, recalculate(records, saved)]).toEqual([saved.month, recalculate(base, saved)]);
    }
  });

  it("changes the result for the edited month, so the scope is not trivially wide", () => {
    const edited = months.find((saved) => saved.month === firstChangedMonth)!;
    expect(recalculate(records, edited)).not.toEqual(recalculate(base, edited));
  });
});
