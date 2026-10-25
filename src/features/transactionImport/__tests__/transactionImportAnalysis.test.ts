import { transactionCsvHeaders, transactionCsvMaxBytes } from "@/src/domain/transactionCsv";
import type { TransactionCsvResolution } from "@/src/features/transactionImport/transactionImport";
import {
  getCutoverHoldings,
  getImportCoverage,
  parseTransactionImportFiles,
} from "@/src/features/transactionImport/transactionImportAnalysis";
import {
  groupResolutions,
  resolveTransactionRows,
} from "@/src/features/transactionImport/transactionImportResolution";
import type { CasStatementImportReview } from "@/src/services/import-export";
import type { PortfolioStoreState } from "@/src/store";
import type { Asset, OpeningPosition } from "@/src/types";

const asset: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "asset-1",
  isin: "INE000000001",
  name: "Example",
  symbol: "EXAMPLE",
  ticker: "EXAMPLE.NS",
};

function csvLine(date: string, isin = "INE000000001") {
  const fields = Array.from({ length: transactionCsvHeaders.length }, () => "");
  fields[0] = "1";
  fields[1] = "buy";
  fields[2] = date;
  fields[3] = isin;
  fields[6] = "INR";
  fields[7] = "1";
  fields[8] = "100";
  return fields.join(",");
}

function csvFile(id: string, name: string, lines: string[]) {
  const text = [transactionCsvHeaders.join(","), ...lines].join("\n");
  return { id, name, size: text.length, text };
}

function parsedRows(...dates: string[]) {
  const summaries: Record<string, string> = {};
  const [parsed] = parseTransactionImportFiles(
    [csvFile("file-1", "trades.csv", dates.map((date) => csvLine(date)))],
    "cogvestCsvV1",
    (fileId, summary) => {
      summaries[fileId] = summary;
    },
  );
  expect(parsed.errors).toEqual([]);
  return parsed.rows;
}

function seeds(...dates: string[]): TransactionCsvResolution[] {
  return parsedRows(...dates).map((row) => ({ row, status: "unresolved" }));
}

describe("parseTransactionImportFiles", () => {
  it("reports each file's date range and transaction count", () => {
    const onFileSummary = jest.fn();
    const [parsed] = parseTransactionImportFiles(
      [csvFile("file-1", "trades.csv", [csvLine("2025-05-02"), csvLine("2025-04-01")])],
      "cogvestCsvV1",
      onFileSummary,
    );

    expect(parsed.rows).toHaveLength(2);
    expect(onFileSummary).toHaveBeenCalledWith(
      "file-1",
      "2025-04-01 to 2025-05-02 • 2 transactions",
    );
  });

  it("rejects an oversized file without parsing it", () => {
    const onFileSummary = jest.fn();
    const [parsed] = parseTransactionImportFiles(
      [{ id: "big", name: "big.csv", size: transactionCsvMaxBytes + 1, text: "" }],
      "cogvestCsvV1",
      onFileSummary,
    );

    expect(parsed).toEqual({
      errors: [{ code: "fileLimit", message: "big.csv: CSV files may be at most 1 MB." }],
      rows: [],
      unsupportedEvents: [],
    });
    expect(onFileSummary).not.toHaveBeenCalled();
  });

  it("prefixes parse errors with the file name", () => {
    const [parsed] = parseTransactionImportFiles(
      [csvFile("file-1", "broken.csv", [csvLine("not-a-date")])],
      "cogvestCsvV1",
      jest.fn(),
    );

    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.errors.every((error) => error.message.startsWith("broken.csv: "))).toBe(true);
  });
});

describe("getImportCoverage", () => {
  it("spans the earliest and latest transaction dates", () => {
    expect(getImportCoverage(seeds("2025-05-02", "2025-04-01"), undefined)).toEqual({
      from: "2025-04-01",
      to: "2025-05-02",
    });
  });

  it("prefers the statement's own coverage", () => {
    const casReview = {
      normalization: { coverage: { from: "2024-04-01", to: "2025-03-31" } },
    } as unknown as CasStatementImportReview;

    expect(getImportCoverage(seeds("2025-04-01"), casReview)).toEqual({
      from: "2024-04-01",
      to: "2025-03-31",
    });
  });

  it("is undefined with no rows", () => {
    expect(getImportCoverage([], undefined)).toBeUndefined();
  });
});

describe("getCutoverHoldings", () => {
  it("lists each opening position of an imported asset once", () => {
    const position = { assetId: asset.id, id: "opening-1" } as OpeningPosition;
    const other = { assetId: "asset-2", id: "opening-2" } as OpeningPosition;
    const snapshot = {
      assets: [asset],
      openingPositions: [position, other],
    } as unknown as PortfolioStoreState;
    const resolutions = seeds("2025-04-01", "2025-05-02").map((seed) => ({
      ...seed,
      asset,
      status: "ready" as const,
    }));

    expect(getCutoverHoldings(resolutions, snapshot)).toEqual([{ asset, position }]);
  });
});

describe("resolveTransactionRows", () => {
  function input(overrides: Partial<Parameters<typeof resolveTransactionRows>[0]> = {}) {
    return {
      amfiClassifications: {},
      casSchemes: [],
      existingAssets: [],
      isCurrent: () => true,
      lookupCache: new Map<string, Asset[]>(),
      rows: parsedRows("2025-04-01", "2025-05-02"),
      searchAssetLookupResults: jest.fn(async () => ({ failures: [], results: [] })),
      selectedAssets: new Map<string, Asset>(),
      ...overrides,
    };
  }

  it("uses a saved asset with the same ISIN without a lookup", async () => {
    const search = jest.fn();
    const resolved = await resolveTransactionRows(
      input({ existingAssets: [asset], searchAssetLookupResults: search }),
    );

    expect(resolved.map((resolution) => resolution.status)).toEqual(["ready", "ready"]);
    expect(resolved.every((resolution) => resolution.asset === asset)).toBe(true);
    expect(search).not.toHaveBeenCalled();
  });

  it("leaves rows unresolved when the lookup fails", async () => {
    const resolved = await resolveTransactionRows(
      input({
        searchAssetLookupResults: jest.fn(async () => {
          throw new Error("offline");
        }),
      }),
    );

    expect(resolved.map((resolution) => resolution.status)).toEqual([
      "unresolved",
      "unresolved",
    ]);
  });

  it("looks up rows sharing an identity once", async () => {
    const search = jest.fn(async () => ({ failures: [], results: [] }));
    await resolveTransactionRows(input({ searchAssetLookupResults: search }));

    expect(search).toHaveBeenCalledTimes(1);
  });
});

describe("groupResolutions", () => {
  it("groups rows by identity with their row numbers", () => {
    const rows = seeds("2025-04-01", "2025-05-02");
    const groups = groupResolutions(rows, []);

    expect(groups).toHaveLength(1);
    expect(groups[0].rowNumbers).toEqual(rows.map((seed) => seed.row.rowNumber));
    expect(groups[0].title).toBe("ISIN INE000000001");
  });
});
