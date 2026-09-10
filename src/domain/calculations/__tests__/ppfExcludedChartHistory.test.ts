import { historicalQuoteCacheKey } from "@/src/types";
import type {
  Asset,
  HistoricalQuoteCache,
  MonthlySnapshot,
  OpeningPosition,
  PpfAccount,
} from "@/src/types";

import { buildPpfExcludedChartHistory } from "../ppfExcludedChartHistory";

const stock: Asset = {
  assetClass: "stock",
  currency: "INR",
  id: "stock",
  instrumentType: "stock",
  name: "Stock",
  sectorType: "other",
  symbol: "STOCK",
  ticker: "STOCK.NS",
};

const linkedLegacyPpf: Asset = {
  assetClass: "debt",
  currency: "INR",
  id: "legacy-ppf",
  instrumentType: "ppf",
  name: "Legacy PPF",
  sectorType: "fixedIncome",
  symbol: "PPF",
  ticker: "PPF",
};

const ppfBlocker: PpfAccount = {
  balanceAsOf: "2026-09-30",
  confirmedBalance: 100_000,
  createdAt: "2026-10-01T00:00:00.000Z",
  id: "ppf-blocker",
  nickname: "Primary PPF",
  opening: { kind: "date", openedOn: "2024-01-01" },
  provider: "India Post",
  status: "active",
};

function openingPosition(
  overrides: Partial<OpeningPosition> = {},
): OpeningPosition {
  return {
    assetId: stock.id,
    averageCostPrice: 100,
    currentPrice: 100,
    date: "2024-09-01",
    id: "stock-opening",
    quantity: 10,
    ...overrides,
  };
}

function buildInput(overrides: {
  assets?: Asset[];
  existingSnapshots?: MonthlySnapshot[];
  historicalQuotes?: HistoricalQuoteCache;
  now?: Date;
  openingPositions?: OpeningPosition[];
  ppfAccounts?: PpfAccount[];
} = {}) {
  return {
    assets: overrides.assets ?? [stock],
    cashEntries: [],
    existingSnapshots: overrides.existingSnapshots ?? [],
    historicalQuotes: overrides.historicalQuotes ?? {},
    now: overrides.now ?? new Date("2026-10-15T10:00:00.000Z"),
    openingPositions: overrides.openingPositions ?? [openingPosition()],
    ppfAccounts: overrides.ppfAccounts ?? [ppfBlocker],
    ppfLedgerEntries: [],
    quoteCache: {},
    trades: [],
  };
}

describe("PPF-excluded chart history", () => {
  it("builds uniform market history for the Sept 2024 stock and Sept 2026 PPF checkpoint scenario", () => {
    const result = buildPpfExcludedChartHistory(buildInput());

    expect(result).not.toBeNull();
    expect(result?.excludedPpfAccountCount).toBe(1);
    expect(result?.snapshots.map((snapshot) => snapshot.month)).toEqual(
      expect.arrayContaining(["2024-09", "2025-06", "2026-09"]),
    );
    expect(result?.snapshots).toHaveLength(25);
    expect(result?.snapshots.every((snapshot) => snapshot.debtValue === 0)).toBe(true);
    expect(result?.snapshots.find((snapshot) => snapshot.month === "2026-09")).toMatchObject({
      debtValue: 0,
      equityValue: 1000,
      portfolioValue: 1000,
    });
    expect(result?.estimatedMonths).toEqual(
      result?.snapshots.map((snapshot) => snapshot.month),
    );
    expect(result?.missingMonths).toEqual([]);
  });

  it("does not mix existing full snapshots into the regenerated series", () => {
    const existing: MonthlySnapshot = {
      cashValue: 10,
      cryptoValue: 0,
      debtValue: 100_000,
      equityValue: 10,
      id: "stored-full-snapshot",
      investedValue: 100_010,
      month: "2025-06",
      monthlyInvestment: 0,
      portfolioValue: 100_020,
    };
    const result = buildPpfExcludedChartHistory(
      buildInput({ existingSnapshots: [existing] }),
    );

    expect(result?.snapshots.find((snapshot) => snapshot.month === "2025-06")).toMatchObject({
      debtValue: 0,
      id: "snapshot-2025-06",
      portfolioValue: 1000,
    });
    expect(existing).toMatchObject({
      debtValue: 100_000,
      id: "stored-full-snapshot",
      portfolioValue: 100_020,
    });
  });

  it("skips months with unknown prices instead of guessing a balance", () => {
    const result = buildPpfExcludedChartHistory(
      buildInput({
        openingPositions: [openingPosition({ currentPrice: undefined })],
      }),
    );

    expect(result).toMatchObject({
      estimatedMonths: [],
      excludedPpfAccountCount: 1,
      missingMonths: expect.arrayContaining(["2024-09", "2026-09"]),
      snapshots: [],
    });
  });

  it("keeps only the latest contiguous valued run and reports gaps", () => {
    const account: PpfAccount = {
      ...ppfBlocker,
      balanceAsOf: "2026-04-01",
      opening: { kind: "date", openedOn: "2026-01-01" },
    };
    const result = buildPpfExcludedChartHistory(
      buildInput({
        historicalQuotes: {
          [historicalQuoteCacheKey(stock.id, "2026-01")]: {
            assetId: stock.id,
            asOfMonth: "2026-01",
            basis: "historical-close",
            currency: "INR",
            fetchedAt: "2026-04-01T00:00:00.000Z",
            price: 110,
            source: "yahoo",
          },
          [historicalQuoteCacheKey(stock.id, "2026-03")]: {
            assetId: stock.id,
            asOfMonth: "2026-03",
            basis: "historical-close",
            currency: "INR",
            fetchedAt: "2026-04-01T00:00:00.000Z",
            price: 130,
            source: "yahoo",
          },
        },
        now: new Date("2026-04-15T10:00:00.000Z"),
        openingPositions: [
          openingPosition({ currentPrice: undefined, date: "2026-01-01" }),
        ],
        ppfAccounts: [account],
      }),
    );

    expect(result).toMatchObject({
      excludedPpfAccountCount: 1,
      estimatedMonths: [],
      missingMonths: ["2026-02"],
      snapshots: [expect.objectContaining({ month: "2026-03", portfolioValue: 1300 })],
    });
  });

  it("excludes every linked legacy PPF source before rebuilding market history", () => {
    const linkedAccount: PpfAccount = {
      ...ppfBlocker,
      id: "ppf-linked",
      legacyAssetId: linkedLegacyPpf.id,
    };
    const result = buildPpfExcludedChartHistory(
      buildInput({
        assets: [stock, linkedLegacyPpf],
        historicalQuotes: {
          [historicalQuoteCacheKey(stock.id, "2024-09")]: {
            assetId: stock.id,
            asOfMonth: "2024-09",
            basis: "historical-close",
            currency: "INR",
            fetchedAt: "2026-10-01T00:00:00.000Z",
            price: 120,
            source: "yahoo",
          },
        },
        openingPositions: [
          openingPosition(),
          openingPosition({
            assetId: linkedLegacyPpf.id,
            averageCostPrice: 100_000,
            currentPrice: 100_000,
            id: "legacy-ppf-opening",
            quantity: 1,
          }),
        ],
        ppfAccounts: [ppfBlocker, linkedAccount],
      }),
    );

    expect(result?.excludedPpfAccountCount).toBe(1);
    expect(result?.snapshots[0]).toMatchObject({
      debtValue: 0,
      equityValue: 1200,
      generated: {
        priceEvidence: [{ assetId: stock.id, basis: "historical-close", price: 120 }],
      },
    });
  });

  it("returns null for PPF-only records and when no PPF history is blocked", () => {
    expect(
      buildPpfExcludedChartHistory(
        buildInput({ assets: [], openingPositions: [] }),
      ),
    ).toBeNull();
    expect(
      buildPpfExcludedChartHistory(
        buildInput({ ppfAccounts: [{ ...ppfBlocker, balanceAsOf: "2024-01-01" }] }),
      ),
    ).toBeNull();
  });
});
