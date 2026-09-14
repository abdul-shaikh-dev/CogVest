import { parseZerodhaTradebook, zerodhaTradebookHeaders } from "@/src/domain/zerodhaTradebook";
import { splitCanonicalIsin, withVerifiedStockSplits } from "@/src/domain/stockSplitCatalog";
import { buildTransactionImportPlan } from "@/src/features/transactionImport/transactionImport";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset } from "@/src/types";

const now = () => new Date("2026-09-14T00:00:00.000Z");

const listings = [
  ["EASEMYTRIP", "INE07O001026"],
  ["BERGEPAINT", "INE463A01038"],
  ["HDFCBANK", "INE040A01034"],
  ["RELIANCE", "INE002A01018"],
  ["TMPV", "INE155A01022"],
  ["LTM", "INE214T01019"],
  ["CLOSED", "INE000A01018"],
] as const;

const assets = new Map<string, Asset>(listings.map(([symbol, isin]) => {
  const ticker = `${symbol}.NS`;
  const asset = withVerifiedStockSplits({
    assetClass: "stock",
    currency: "INR",
    exchange: "NSE",
    id: `yahoo:${ticker}`,
    instrumentType: "stock",
    isin,
    name: `${symbol} Limited`,
    quoteSourceId: ticker,
    sectorType: "other",
    symbol,
    ticker,
  } satisfies Asset);
  return [isin, asset] as const;
}));

function canonicalRowIsin(identity: ReturnType<typeof parseZerodhaTradebook>["rows"][number]["identity"]) {
  if (identity.kind !== "isin") {
    throw new Error("The synthetic Zerodha row must retain its source ISIN.");
  }
  return splitCanonicalIsin(identity.value)!;
}

function row({
  date,
  id,
  isin,
  quantity,
  symbol,
  type = "buy",
}: {
  date: string;
  id: number;
  isin: string;
  quantity: number;
  symbol: string;
  type?: "buy" | "sell";
}) {
  return [
    symbol, isin, date, "NSE", "EQ", "EQ", type, "false", quantity, 100,
    `synthetic-trade-${id}`, `synthetic-order-${id}`, `${date}T10:00:00`,
  ].join(",");
}

const rows = [
  row({ date: "2022-06-01", id: 1, isin: "INE07O001018", quantity: 10, symbol: "EASEMYTRIP" }),
  row({ date: "2023-01-01", id: 2, isin: "INE463A01038", quantity: 10, symbol: "BERGEPAINT" }),
  row({ date: "2024-01-01", id: 3, isin: "INE040A01034", quantity: 10, symbol: "HDFCBANK" }),
  row({ date: "2023-01-01", id: 4, isin: "INE002A01018", quantity: 10, symbol: "RELIANCE" }),
  row({ date: "2025-01-01", id: 5, isin: "INE002A01018", quantity: 2, symbol: "RELIANCE" }),
  row({ date: "2025-01-01", id: 6, isin: "INE155A01022", quantity: 10, symbol: "TATAMOTORS" }),
  row({ date: "2022-04-01", id: 7, isin: "INE214T01019", quantity: 4, symbol: "LTI" }),
  row({ date: "2023-01-01", id: 8, isin: "INE214T01019", quantity: 2, symbol: "LTIM" }),
  row({ date: "2024-01-01", id: 9, isin: "INE000A01018", quantity: 3, symbol: "CLOSED" }),
  row({ date: "2024-02-01", id: 10, isin: "INE000A01018", quantity: 3, symbol: "CLOSED", type: "sell" }),
];

function buildPlan(store: ReturnType<typeof createPortfolioStore>) {
  const parsed = parseZerodhaTradebook(
    [zerodhaTradebookHeaders.join(","), ...rows].join("\n"),
    { fileIndex: 0, fileName: "synthetic-corporate-actions.csv" },
  );
  expect(parsed.errors).toEqual([]);
  expect(parsed.unsupportedEvents).toEqual([]);

  return buildTransactionImportPlan({
    batchId: "synthetic-corporate-action-portfolio",
    mode: "fullHistory",
    now: now(),
    resolutions: parsed.rows.map((parsedRow) => ({
      asset: assets.get(canonicalRowIsin(parsedRow.identity))!,
      row: parsedRow,
      status: "ready" as const,
    })),
    sourceCoverageConfirmed: true,
    state: store.getState(),
    unsupportedCount: parsed.unsupportedEvents.length,
  });
}

describe("corporate-action portfolio import", () => {
  it("accounts for every row and preserves the combined portfolio through restart and reimport", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ now, storage });
    const plan = buildPlan(store);

    expect(plan.errors).toEqual([]);
    expect(plan.summary).toMatchObject({ additions: rows.length, parsedRows: rows.length });
    expect(plan.holdings.map(({ asset, reconciliation }) => [
      asset.symbol,
      reconciliation.quantity,
      reconciliation.totalCost,
    ])).toEqual(expect.arrayContaining([
      ["EASEMYTRIP", 160, "1000"],
      ["BERGEPAINT", 12, "1000"],
      ["HDFCBANK", 20, "1000"],
      ["RELIANCE", 22, "1153.2"],
      ["JIOFIN", 10, "46.8"],
      ["TMPV", 10, "688.5"],
      ["TMCV", 10, "311.5"],
      ["LTM", 6, "600"],
      ["CLOSED", 0, "0"],
    ]));

    expect(store.getState().recordTransactionImport(plan.command!)).toMatchObject({
      added: rows.length,
      status: "applied",
    });
    const restarted = createPortfolioStore({ now, storage });
    expect(restarted.getState().trades).toHaveLength(rows.length);
    expect(restarted.getState().assets.map((asset) => asset.symbol)).toEqual(
      expect.arrayContaining(["JIOFIN", "TMCV"]),
    );

    const duplicatePlan = buildPlan(restarted);
    expect(duplicatePlan).toMatchObject({
      conflicts: 0,
      duplicates: rows.length,
      errors: [],
      summary: { additions: 0, parsedRows: rows.length },
    });
    expect(duplicatePlan.command).toBeUndefined();

    const dependentSale = {
      assetId: "yahoo:JIOFIN.NS",
      date: "2024-01-10",
      id: "dependent-successor-sale",
      pricePerUnit: 100,
      quantity: 1,
      totalValue: 100,
      type: "sell" as const,
    };
    restarted.getState().addTrade(dependentSale);
    expect(restarted.getState().previewTradeDeletion(restarted.getState().trades.filter((trade) => trade.importProvenance).map((trade) => trade.id))).toMatchObject({
      reason: "corporateActionDependency",
      status: "rejected",
    });
    expect(restarted.getState().trades).toContainEqual(dependentSale);
    expect(restarted.getState().deleteTrade(dependentSale.id)).toMatchObject({ status: "applied" });

    const deletion = restarted.getState().deleteTrades(restarted.getState().trades.map((trade) => trade.id));
    expect(deletion).toMatchObject({
      impact: {
        affectedHoldings: expect.arrayContaining([
          expect.objectContaining({ assetId: "yahoo:RELIANCE.NS", corporateActionRecalculated: true }),
          expect.objectContaining({ assetId: "yahoo:JIOFIN.NS", corporateActionRecalculated: true }),
          expect.objectContaining({ assetId: "yahoo:TMPV.NS", corporateActionRecalculated: true }),
          expect.objectContaining({ assetId: "yahoo:TMCV.NS", corporateActionRecalculated: true }),
        ]),
        detachedDemergers: 2,
        importedTransactions: rows.length,
        transactions: rows.length,
      },
      status: "applied",
    });
    expect(restarted.getState().trades).toEqual([]);
    expect(restarted.getState().assets.filter((asset) => asset.demerger)).toEqual([]);

    const reimportPlan = buildPlan(restarted);
    expect(reimportPlan).toMatchObject({
      conflicts: 0,
      duplicates: 0,
      errors: [],
      summary: { additions: rows.length, parsedRows: rows.length },
    });
  });
});
