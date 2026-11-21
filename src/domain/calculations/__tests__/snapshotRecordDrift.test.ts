import { historicalQuoteCacheKey } from "@/src/types";
import type { Asset, HistoricalQuoteCache, MonthlySnapshot, PpfAccount, PpfLedgerEntry } from "@/src/types";

import { buildGeneratedMonthEndSnapshot } from "../monthEndSnapshots";
import {
  findSnapshotRecordDrift,
  recalculateSavedSnapshot,
  snapshotSourceLabel,
  type SnapshotDriftRecords,
} from "../snapshotRecordDrift";
import { calculateMonthlyProgressSummaries } from "../holdings";

const stock: Asset = {
  assetClass: "stock", currency: "INR", id: "stock", instrumentType: "stock",
  name: "Stock", sectorType: "other", symbol: "STOCK", ticker: "STOCK.NS",
};

const ppf: PpfAccount = {
  balanceAsOf: "2024-04-01", confirmedBalance: 30_000, createdAt: "2026-06-01T00:00:00.000Z",
  id: "ppf", nickname: "PPF", opening: { kind: "financialYear", financialYearStart: 2024 }, provider: "Bank", status: "active",
};

const backfilled: PpfLedgerEntry = {
  accountId: ppf.id, amount: 50_000, date: "2025-06-10", fundingSource: "external",
  id: "ppf-june", recordedAt: "2026-06-01T00:00:00.000Z", type: "contribution",
};

function close(month: string, price: number): HistoricalQuoteCache {
  return {
    [historicalQuoteCacheKey(stock.id, month)]: {
      assetId: stock.id, asOfMonth: month, basis: "historical-close", currency: "INR",
      fetchedAt: "2026-04-01T00:00:00.000Z", price, source: "yahoo",
    },
  };
}

function records(overrides: Partial<SnapshotDriftRecords> = {}): SnapshotDriftRecords {
  return {
    assets: [stock],
    cashEntries: [],
    historicalQuotes: { ...close("2026-01", 110), ...close("2026-02", 120) },
    now: new Date("2026-11-21T10:00:00.000Z"),
    openingPositions: [{ assetId: stock.id, averageCostPrice: 100, currentPrice: 100, date: "2024-09-01", id: "open", quantity: 10 }],
    ppfAccounts: [ppf],
    ppfLedgerEntries: [],
    quoteCache: {},
    trades: [],
    ...overrides,
  };
}

/** A month as CogVest would have saved it from these records. */
function savedMonth(month: string, from: SnapshotDriftRecords, change: Partial<MonthlySnapshot> = {}): MonthlySnapshot {
  const result = buildGeneratedMonthEndSnapshot({ ...from, existingSnapshots: [], targetMonth: month });
  if (!result.snapshot) throw new Error(result.warnings.join(" "));
  return { ...result.snapshot, ...change };
}

describe("saved months that no longer match records (#747)", () => {
  test("a month saved before back-dated PPF entries were added is flagged, with what records give now", () => {
    const before = records();
    const now = records({ ppfLedgerEntries: [backfilled] });
    const february = savedMonth("2026-02", before, { id: "kept-id" });
    const drift = findSnapshotRecordDrift({ ...now, monthlySnapshots: [february] }).get("2026-02");
    expect(drift?.fields).toEqual(["investedValue"]);
    const recalculated = recalculateSavedSnapshot(now, february);
    expect(recalculated).toMatchObject({ ok: true, snapshot: { id: "kept-id", month: "2026-02",
      debtValue: february.debtValue + 50_000, equityValue: february.equityValue,
      investedValue: february.investedValue + 50_000 } });
    expect(recalculated.ok && recalculated.snapshot.generated?.source).toBe("auto");
  });

  test("a reviewed month is flagged the same way, and a month that still matches is not", () => {
    const now = records({ ppfLedgerEntries: [backfilled] });
    const reviewed = savedMonth("2026-02", records(), {
      generated: { ...savedMonth("2026-02", records()).generated!, source: "manual" },
    });
    const matching = savedMonth("2026-01", now, {
      generated: { ...savedMonth("2026-01", now).generated!, source: "manual" },
    });
    const drift = findSnapshotRecordDrift({ ...now, monthlySnapshots: [matching, reviewed] });
    expect([...drift.keys()]).toEqual(["2026-02"]);
    expect(snapshotSourceLabel(reviewed)).toBe("Saved by you");
    expect(snapshotSourceLabel(savedMonth("2026-01", now))).toBe("Automatic");
  });

  test("a price moving is never a mismatch: only record-based values are compared", () => {
    const february = savedMonth("2026-02", records());
    const repriced = records({ historicalQuotes: { ...close("2026-01", 110), ...close("2026-02", 999) } });
    expect(findSnapshotRecordDrift({ ...repriced, monthlySnapshots: [february] }).size).toBe(0);
  });

  test("estimated months and months that can't be recalculated are left alone", () => {
    const now = records({ ppfLedgerEntries: [backfilled] });
    const february = savedMonth("2026-02", records());
    const estimated = { ...february, generated: { ...february.generated!, confidence: "provisional" as const,
      priceBasis: "manual-fallback" as const, priceEvidence: [{ assetId: stock.id, basis: "manual-fallback" as const, price: 120 }] } };
    expect(findSnapshotRecordDrift({ ...now, monthlySnapshots: [estimated] }).size).toBe(0);
    // Without the holding's asset details the month can't be valued at all.
    const unvalued = { ...now, assets: [] };
    expect(findSnapshotRecordDrift({ ...unvalued, monthlySnapshots: [february] }).size).toBe(0);
    expect(recalculateSavedSnapshot(unvalued, february)).toEqual({ ok: false, reason: expect.any(String) });
  });

  test("Month gain is unavailable for an out-of-date month and the month after it, never counting the gap as gain", () => {
    const now = records({ ppfLedgerEntries: [backfilled] });
    const january = savedMonth("2026-01", now);
    const february = savedMonth("2026-02", records());
    const march = savedMonth("2026-03", { ...now, historicalQuotes: { ...now.historicalQuotes, ...close("2026-03", 120) } });
    const summaries = calculateMonthlyProgressSummaries([january, february, march], new Set(["2026-02"]));
    expect(summaries.map((summary) => [summary.snapshot.month, summary.performance.reason])).toEqual([
      ["2026-03", "out-of-date-snapshot"],
      ["2026-02", "out-of-date-snapshot"],
      ["2026-01", "missing-previous-snapshot"],
    ]);
    expect(summaries[0].performance.marketMovement).toBeNull();
    expect(summaries[0].performance.totalValueChange).toBe(march.portfolioValue - february.portfolioValue);
    expect(calculateMonthlyProgressSummaries([january, february, march])[0].performance.marketMovement)
      .toBe(march.portfolioValue - february.portfolioValue);
  });
});
