import { parseTransactionCsv, transactionCsvHeaders } from "@/src/domain/transactionCsv";
import { buildTransactionImportPlan, type TransactionCsvResolution } from "../transactionImport";
import { conflictingHistoricalRows } from "../transactionImportMatching";
import { createPortfolioStore } from "@/src/store";
import { createMemoryJsonStorage } from "@/src/services/storage";
import type { Asset } from "@/src/types";

const listing: Asset = { id: "yahoo:EXAMPLE.NS", quoteSourceId: "EXAMPLE.NS", ticker: "EXAMPLE.NS", symbol: "EXAMPLE", exchange: "NSE", currency: "INR", assetClass: "stock", name: "Example" };
function row(isin: string, id: string, asset = listing): TransactionCsvResolution {
  const fields = ["1", "buy", "2024-01-02", isin, "NSE", "EXAMPLE", "INR", "10", "100", "", "", id, "", "", "", "", ""];
  const parsed = parseTransactionCsv(`${transactionCsvHeaders.join(",")}\n${fields.join(",")}`);
  expect(parsed.errors).toEqual([]);
  return { asset, row: { ...parsed.rows[0], rowNumber: Number(id.replace(/\D/g, "")) + 2 }, status: "ready" };
}
const oldIsin = "INE000000001";
const newIsin = "INE000000002";

describe("historical ISIN collisions", () => {
  it("accounts for every row and blocks both sides rather than dropping the later identity", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const before = store.getState();
    const rows = Array.from({ length: 267 }, (_, i) => row(i === 266 ? newIsin : oldIsin, `trade-${i}`));
    const plan = buildTransactionImportPlan({ batchId: "test", mode: "fullHistory", state: before, resolutions: rows });
    expect(plan.command).toBeUndefined();
    expect(plan.holdings).toEqual([]);
    expect(plan.summary).toMatchObject({ parsedRows: 267, additions: 0, unplannedRows: 267 });
    expect(plan.errors).toHaveLength(267);
    expect(plan.errors.every((error) => error.code === "historicalIdentityConflict")).toBe(true);
    expect(store.getState()).toBe(before);
  });

  it("detects shared quote IDs even if provider asset IDs differ", () => {
    expect(conflictingHistoricalRows([row(oldIsin, "1"), row(newIsin, "2", { ...listing, id: "other-id" })], [])).toEqual(new Set([0, 1]));
  });

  it("does not treat choosing another exchange as proof of compatible historical units", () => {
    const rows = [row(oldIsin, "1"), row(newIsin, "2", { ...listing, id: "yahoo:EXAMPLE.BO", quoteSourceId: "EXAMPLE.BO", ticker: "EXAMPLE.BO", exchange: "BSE" })];
    for (const item of rows) {
      item.row.source = { format: "zerodha-tradebook", version: "eq-v1" };
      item.row.symbol = "EXAMPLE";
      item.row.exchange = "NSE";
    }
    expect(conflictingHistoricalRows(rows, [])).toEqual(new Set([0, 1]));
  });

  it("detects conflicts with previously saved identities before canonicalization", () => {
    expect(conflictingHistoricalRows([row(newIsin, "1")], [{ ...listing, isin: oldIsin }])).toEqual(new Set([0]));
  });

  it("includes an ISIN-only canonical alias when both listings lead to a saved holding", () => {
    const saved = { ...listing, id: "saved", isin: oldIsin };
    const renamed = { ...listing, id: "renamed", quoteSourceId: "NEW.NS", ticker: "NEW.NS" };
    expect(conflictingHistoricalRows([row(oldIsin, "1", renamed), row(newIsin, "2")], [saved])).toEqual(new Set([0, 1]));
  });

  it("is order-independent and leaves unrelated rows available for review", () => {
    const unrelated = row("INE000000003", "3", { ...listing, id: "different", quoteSourceId: "OTHER.NS", ticker: "OTHER.NS" });
    for (const rows of [[row(oldIsin, "1"), row(newIsin, "2"), unrelated], [row(newIsin, "2"), row(oldIsin, "1"), unrelated]]) {
      const plan = buildTransactionImportPlan({ batchId: "test", mode: "fullHistory", state: createPortfolioStore({ storage: createMemoryJsonStorage() }).getState(), resolutions: rows });
      expect(plan.summary).toMatchObject({ parsedRows: 3, additions: 1, unplannedRows: 2 });
      expect(plan.command).toBeUndefined();
    }
  });

  it("preserves same-ISIN continuity and reimport deduplication", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const rows = [row(oldIsin, "1"), row(oldIsin, "2")];
    const build = () => buildTransactionImportPlan({ batchId: "test", mode: "fullHistory", state: store.getState(), resolutions: rows });
    const first = build();
    expect(first.errors).toEqual([]);
    store.getState().recordTransactionImport(first.command!);
    const repeated = build();
    expect(repeated.duplicates).toBe(2);
    expect(repeated.summary).toMatchObject({ parsedRows: 2, additions: 0, unplannedRows: 0 });
  });
});
