import { parseTransactionCsv, transactionCsvHeaders } from "@/src/domain/transactionCsv";
import {
  buildTransactionImportPlan,
  transactionImportSourceFormat,
  type TransactionCsvResolution,
} from "@/src/features/transactionImport/transactionImport";
import type { PortfolioStoreState } from "@/src/store";
import type { Asset, OpeningPosition, Trade } from "@/src/types";

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

const baseline: OpeningPosition = {
  assetId: asset.id,
  averageCostPrice: 100,
  date: null,
  id: "opening-1",
  quantity: 10,
  recordedAt: "2025-01-02T00:00:00.000Z",
  recordedOn: "2025-01-02",
};

function state(input: {
  assets?: Asset[];
  openingPositions?: OpeningPosition[];
  trades?: Trade[];
} = {}) {
  return {
    assets: input.assets ?? [asset],
    cashEntries: [],
    monthlySnapshots: [],
    openingPositions: input.openingPositions ?? [baseline],
    trades: input.trades ?? [],
  } as unknown as PortfolioStoreState;
}

function resolution(
  row: string,
  selectedAsset: Asset = asset,
): TransactionCsvResolution {
  const parsed = parseTransactionCsv(
    `${transactionCsvHeaders.join(",")}\n${row}`,
  );
  expect(parsed.errors).toEqual([]);
  return { asset: selectedAsset, row: parsed.rows[0], status: "ready" };
}

function csvRow(input: {
  account?: string;
  acquisitionCost?: string;
  date: string;
  description?: string;
  externalId?: string;
  exchange?: string;
  fees?: string;
  isin?: string;
  notes?: string;
  price?: string;
  quantity: string;
  settlementDate?: string;
  symbol?: string;
  taxes?: string;
  type: string;
}) {
  const fields = Array.from({ length: transactionCsvHeaders.length }, () => "");
  fields[0] = "1";
  fields[1] = input.type;
  fields[2] = input.date;
  fields[3] = input.isin ?? "INE000000001";
  fields[4] = input.exchange ?? "";
  fields[5] = input.symbol ?? "";
  fields[6] = "INR";
  fields[7] = input.quantity;
  fields[8] = input.price ?? "";
  fields[9] = input.acquisitionCost ?? "";
  fields[10] = input.settlementDate ?? "";
  fields[11] = input.externalId ?? "";
  fields[12] = input.account ?? "";
  fields[13] = input.fees ?? "";
  fields[14] = input.taxes ?? "";
  fields[15] = input.description ?? "";
  fields[16] = input.notes ?? "";
  return fields.join(",");
}

function plan(input: {
  assets?: Asset[];
  mode: "fullHistory" | "supplemental";
  openingPositions?: OpeningPosition[];
  resolutions: TransactionCsvResolution[];
  sharedCutover?: string;
  trades?: Trade[];
}) {
  return buildTransactionImportPlan({
    batchId: "batch-1",
    mode: input.mode,
    now: new Date("2026-08-23T00:00:00.000Z"),
    resolutions: input.resolutions,
    sharedCutover: input.sharedCutover,
    state: state({
      assets: input.assets,
      openingPositions: input.openingPositions,
      trades: input.trades,
    }),
  });
}

describe("transaction import planner", () => {
  it("requires an explicit cutover and rejects supplemental pre-cutover rows", () => {
    const row = resolution(csvRow({ date: "2025-02-01", price: "100", quantity: "1", type: "buy" }));
    const missing = plan({ mode: "supplemental", resolutions: [row] });
    expect(missing.command).toBeUndefined();
    expect(missing.errors).toEqual([
      expect.objectContaining({ code: "missingCutover" }),
    ]);

    const preCutover = plan({
      mode: "supplemental",
      resolutions: [row],
      sharedCutover: "2025-03-01",
    });
    expect(preCutover.command).toBeUndefined();
    expect(preCutover.errors).toEqual([
      expect.objectContaining({ code: "preCutoverTransaction", rowNumber: 2 }),
    ]);
  });

  it("keeps the baseline and stages only post-cutover supplemental activity", () => {
    const result = plan({
      mode: "supplemental",
      resolutions: [
        resolution(csvRow({ date: "2025-04-01", externalId: "order-1", price: "120", quantity: "2", type: "buy" })),
      ],
      sharedCutover: "2025-03-01",
    });

    expect(result.errors).toEqual([]);
    expect(result.command).toEqual(
      expect.objectContaining({
        cutovers: [
          { measuredAsOf: "2025-03-01", openingPositionId: baseline.id },
        ],
        replaceOpeningPositionIds: [],
        transactions: [
          expect.objectContaining({
            assetId: asset.id,
            pricePerUnit: 120,
            type: "buy",
          }),
        ],
      }),
    );
    expect(result.holdings[0].reconciliation).toEqual(
      expect.objectContaining({ averageCostPrice: 103.33333333, quantity: 12 }),
    );
  });

  it("offers full-history replacement only for an exact baseline match", () => {
    const exact = plan({
      mode: "fullHistory",
      resolutions: [
        resolution(csvRow({ date: "2024-01-01", price: "100", quantity: "10", type: "buy" })),
      ],
      sharedCutover: "2025-03-01",
    });
    expect(exact.errors).toEqual([]);
    expect(exact.command?.replaceOpeningPositionIds).toEqual([baseline.id]);
    expect(exact.holdings[0].replacementExact).toBe(true);

    const mismatch = plan({
      mode: "fullHistory",
      resolutions: [
        resolution(csvRow({ date: "2024-01-01", price: "100", quantity: "9", type: "buy" })),
      ],
      sharedCutover: "2025-03-01",
    });
    expect(mismatch.command).toBeUndefined();
    expect(mismatch.errors).toEqual([
      expect.objectContaining({ code: "reconciliationMismatch" }),
    ]);
  });

  it("skips exact external-ID repeats and blocks materially changed reuse", () => {
    const existingRow = resolution(csvRow({ account: "broker", date: "2025-04-01", externalId: "order-1", price: "120", quantity: "2", type: "buy" })).row;
    const existing: Trade = {
      assetId: asset.id,
      date: existingRow.tradeDate,
      id: "existing-1",
      importProvenance: {
        account: "broker",
        externalId: "order-1",
        fingerprint: existingRow.fingerprint,
        importBatchId: "old-batch",
        originalRowNumber: 2,
        sourceFormat: transactionImportSourceFormat,
        sourceVersion: "1",
      },
      pricePerUnit: 120,
      quantity: 2,
      totalValue: 240,
      type: "buy",
    };
    const duplicate = plan({
      mode: "supplemental",
      resolutions: [{ asset, row: existingRow, status: "ready" }],
      sharedCutover: "2025-03-01",
      trades: [existing],
    });
    expect(duplicate.duplicates).toBe(1);
    expect(duplicate.command).toBeUndefined();

    const conflict = plan({
      mode: "supplemental",
      resolutions: [
        resolution(csvRow({ account: "broker", date: "2025-04-01", externalId: "order-1", price: "120", quantity: "3", type: "buy" })),
      ],
      sharedCutover: "2025-03-01",
      trades: [existing],
    });
    expect(conflict.conflicts).toBe(1);
    expect(conflict.errors).toEqual([
      expect.objectContaining({ code: "conflictingIdentity" }),
    ]);
  });

  it("deduplicates the same resolved asset across ISIN and exchange identities", () => {
    const first = plan({
      mode: "supplemental",
      openingPositions: [],
      resolutions: [
        resolution(
          csvRow({ date: "2025-04-01", price: "120", quantity: "2", type: "buy" }),
        ),
      ],
    });
    const existing = first.command!.transactions[0];
    const duplicate = plan({
      mode: "supplemental",
      openingPositions: [],
      resolutions: [
        resolution(
          csvRow({
            date: "2025-04-01",
            exchange: "NSE",
            isin: "",
            price: "120",
            quantity: "2",
            symbol: "EXAMPLE",
            type: "buy",
          }),
        ),
      ],
      trades: [existing],
    });

    expect(duplicate.duplicates).toBe(1);
    expect(duplicate.command).toBeUndefined();
  });

  it("deduplicates rows that normalize to the same persisted precision", () => {
    const first = plan({
      mode: "supplemental",
      openingPositions: [],
      resolutions: [
        resolution(
          csvRow({
            date: "2025-04-01",
            price: "120.000000001",
            quantity: "2.000000001",
            type: "buy",
          }),
        ),
      ],
    });
    const duplicate = plan({
      mode: "supplemental",
      openingPositions: [],
      resolutions: [
        resolution(
          csvRow({
            date: "2025-04-01",
            price: "120.000000002",
            quantity: "2.000000002",
            type: "buy",
          }),
        ),
      ],
      trades: [first.command!.transactions[0]],
    });

    expect(duplicate.duplicates).toBe(1);
    expect(duplicate.command).toBeUndefined();
  });

  it.each([
    ["settlement date", { settlementDate: "2025-04-03" }],
    ["fees", { fees: "3" }],
    ["taxes", { taxes: "4" }],
    ["description", { description: "Corrected broker memo" }],
    ["notes", { notes: "Corrected note" }],
  ])("treats changed %s as a conflicting external-ID reuse", (_label, changed) => {
    const original = resolution(
      csvRow({
        account: "broker",
        date: "2025-04-01",
        description: "Original broker memo",
        externalId: "order-1",
        fees: "2",
        notes: "Original note",
        price: "120",
        quantity: "2",
        settlementDate: "2025-04-02",
        taxes: "3",
        type: "buy",
      }),
    ).row;
    const existing: Trade = {
      assetId: asset.id,
      date: original.tradeDate,
      id: "existing-with-metadata",
      importProvenance: {
        account: original.account,
        externalId: original.externalId,
        fees: original.fees,
        fingerprint: original.fingerprint,
        importBatchId: "old-batch",
        originalDescription: original.description,
        originalRowNumber: 2,
        settlementDate: original.settlementDate,
        sourceFormat: transactionImportSourceFormat,
        sourceVersion: "1",
        taxes: original.taxes,
      },
      notes: original.notes,
      pricePerUnit: 120,
      quantity: 2,
      totalValue: 240,
      type: "buy",
    };
    const changedRow = resolution(
      csvRow({
        account: "broker",
        date: "2025-04-01",
        description: "Original broker memo",
        externalId: "order-1",
        fees: "2",
        notes: "Original note",
        price: "120",
        quantity: "2",
        settlementDate: "2025-04-02",
        taxes: "3",
        type: "buy",
        ...changed,
      }),
    );

    const result = plan({
      mode: "supplemental",
      resolutions: [changedRow],
      sharedCutover: "2025-03-01",
      trades: [existing],
    });

    expect(changedRow.row.fingerprint).toBe(original.fingerprint);
    expect(result.command).toBeUndefined();
    expect(result.errors).toEqual([
      expect.objectContaining({ code: "conflictingIdentity" }),
    ]);
  });

  it("treats metadata corrections without an external ID as fingerprint conflicts", () => {
    const original = resolution(
      csvRow({
        date: "2025-04-01",
        description: "Original memo",
        price: "120",
        quantity: "2",
        type: "buy",
      }),
    ).row;
    const existing: Trade = {
      assetId: asset.id,
      date: original.tradeDate,
      id: "existing-without-external-id",
      importProvenance: {
        fingerprint: JSON.stringify([
          "buy",
          "2025-04-01",
          asset.id,
          "INR",
          2,
          120,
          null,
        ]),
        importBatchId: "old-batch",
        originalDescription: original.description,
        originalRowNumber: 2,
        sourceFormat: transactionImportSourceFormat,
        sourceVersion: "1",
      },
      pricePerUnit: 120,
      quantity: 2,
      totalValue: 240,
      type: "buy",
    };
    const corrected = resolution(
      csvRow({
        date: "2025-04-01",
        description: "Corrected memo",
        price: "120",
        quantity: "2",
        type: "buy",
      }),
    );

    const result = plan({
      mode: "supplemental",
      resolutions: [corrected],
      sharedCutover: "2025-03-01",
      trades: [existing],
    });

    expect(corrected.row.fingerprint).toBe(original.fingerprint);
    expect(result.command).toBeUndefined();
    expect(result.errors).toEqual([
      expect.objectContaining({ code: "conflictingIdentity" }),
    ]);
  });

  it("does not collapse distinct ISIN groups onto an asset without an ISIN", () => {
    const assetWithoutIsin = { ...asset, isin: undefined };
    const result = plan({
      assets: [assetWithoutIsin],
      mode: "supplemental",
      openingPositions: [],
      resolutions: [
        resolution(
          csvRow({
            date: "2025-04-01",
            isin: "INE000000001",
            price: "100",
            quantity: "1",
            type: "buy",
          }),
          assetWithoutIsin,
        ),
        resolution(
          csvRow({
            date: "2025-04-02",
            isin: "INE000000002",
            price: "100",
            quantity: "1",
            type: "buy",
          }),
          assetWithoutIsin,
        ),
      ],
    });

    expect(result.command).toBeUndefined();
    expect(result.errors).toEqual([
      expect.objectContaining({ code: "duplicateAssetIdentity", rowNumber: 2 }),
    ]);
  });

  it("blocks unresolved transfer basis and oversold timelines", () => {
    const unresolved = plan({
      mode: "supplemental",
      resolutions: [
        resolution(csvRow({ date: "2025-04-01", quantity: "1", type: "transferIn" })),
      ],
      sharedCutover: "2025-03-01",
    });
    expect(unresolved.errors).toEqual([
      expect.objectContaining({ code: "unresolvedTransfer" }),
    ]);

    const oversold = plan({
      mode: "supplemental",
      resolutions: [
        resolution(csvRow({ date: "2025-04-01", price: "120", quantity: "11", type: "sell" })),
      ],
      sharedCutover: "2025-03-01",
    });
    expect(oversold.errors).toEqual([
      expect.objectContaining({ code: "wouldOversell" }),
    ]);
  });

  it("blocks mixed same-day directions whose cross-batch order is unknown", () => {
    const existing = {
      assetId: asset.id,
      date: "2025-04-01",
      id: "existing-buy",
      pricePerUnit: 100,
      quantity: 10,
      totalValue: 1000,
      type: "buy",
    } satisfies Trade;
    const result = plan({
      mode: "supplemental",
      resolutions: [
        resolution(
          csvRow({ date: "2025-04-01", price: "120", quantity: "10", type: "sell" }),
        ),
      ],
      sharedCutover: "2025-03-01",
      trades: [existing],
    });

    expect(result.command).toBeUndefined();
    expect(result.errors).toEqual([
      expect.objectContaining({ code: "ambiguousSameDayOrder" }),
    ]);
  });

  it("blocks indistinguishable same-file rows without external IDs", () => {
    const repeated = resolution(
      csvRow({
        date: "2025-04-01",
        price: "120",
        quantity: "2",
        type: "buy",
      }),
    );
    const result = plan({
      mode: "supplemental",
      resolutions: [repeated, repeated],
      sharedCutover: "2025-03-01",
    });

    expect(result.command).toBeUndefined();
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: "conflictingIdentity",
        message: expect.stringContaining("unique external_id"),
      }),
    ]);
  });
});
