import {
  assetFromLookupResult,
  buildHoldingsCsvImportPlan,
  buildManualAssetFromCsvRow,
  classifyCsvLookupResults,
} from "@/src/features/holdingImport";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { AssetLookupResult } from "@/src/services/assetLookup";
import type { ParsedHoldingsCsvRow } from "@/src/domain/holdingsCsv";
import { buildE2ePortfolioEvidence } from "@/src/testing/e2eEvidence";

const row: ParsedHoldingsCsvRow = {
  averageCost: 1450,
  currency: "INR",
  firstPurchaseDate: "2024-04-15",
  name: "HDFC Bank",
  quantity: 25,
  rowNumber: 2,
  symbol: "HDFCBANK",
  ticker: "HDFCBANK.NS",
};

const lookup: AssetLookupResult = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "yahoo:HDFCBANK.NS",
  instrumentType: "stock",
  instrumentTypeConfidence: "provider",
  metadataReviewMessage: "Ready",
  name: "HDFC Bank Limited",
  provider: "yahoo",
  quoteSourceId: "HDFCBANK.NS",
  sectorType: "financialServices",
  sectorTypeConfidence: "provider",
  sourceLabel: "Yahoo Finance",
  symbol: "HDFCBANK",
  ticker: "HDFCBANK.NS",
};

describe("holdings CSV import planning", () => {
  it("does not offer a commit before a file has been resolved", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    expect(
      buildHoldingsCsvImportPlan({
        batchId: "csv-empty",
        resolutions: [],
        state: store.getState(),
      }),
    ).toEqual({ errors: [] });
  });

  it("auto-resolves one exact provider identity but requires selection otherwise", () => {
    expect(
      classifyCsvLookupResults({ assets: [], failures: [], results: [lookup], row }),
    ).toMatchObject({ asset: { id: lookup.id }, status: "ready" });

    expect(
      classifyCsvLookupResults({
        assets: [],
        failures: [],
        results: [{ ...lookup, ticker: "HDFC.NS" }],
        row: { ...row, symbol: undefined, ticker: undefined },
      }),
    ).toMatchObject({ status: "selectionRequired" });
  });

  it("requires explicit, complete metadata before creating a manual asset", () => {
    expect(buildManualAssetFromCsvRow(row)).toBeUndefined();
    expect(
      buildManualAssetFromCsvRow({
        ...row,
        assetClass: "stock",
        exchange: "NSE",
      }),
    ).toMatchObject({ assetClass: "stock", ticker: "HDFCBANK.NS" });
  });

  it("derives exact projected totals and pending coverage from domain functions", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const asset = assetFromLookupResult(lookup);
    const plan = buildHoldingsCsvImportPlan({
      batchId: "csv-1",
      now: new Date("2026-08-15T12:00:00.000Z"),
      resolutions: [
        {
          allowExistingUpdate: false,
          asset,
          candidates: [lookup],
          quote: {
            asOf: "2026-08-15T10:00:00.000Z",
            assetId: asset.id,
            currency: "INR",
            price: 1678.25,
            source: "yahoo",
          },
          row,
          status: "ready",
        },
      ],
      state: store.getState(),
    });

    expect(plan.errors).toEqual([]);
    expect(plan.summary).toEqual({
      additions: 1,
      pendingValuations: 0,
      resultingCurrentValue: 41956.25,
      resultingInvested: 36250,
      updates: 0,
    });
  });

  it("blocks duplicate rows, transaction history, and unconfirmed updates", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const asset = assetFromLookupResult(lookup);
    store.getState().addAsset(asset);
    store.getState().addOpeningPosition({
      assetId: asset.id,
      averageCostPrice: 1400,
      date: "2024-01-01",
      id: "existing",
      quantity: 20,
    });
    const resolution = {
      allowExistingUpdate: false,
      asset,
      candidates: [lookup],
      row,
      status: "ready" as const,
    };

    expect(
      buildHoldingsCsvImportPlan({
        batchId: "csv-2",
        resolutions: [resolution],
        state: store.getState(),
      }).errors,
    ).toEqual([
      expect.objectContaining({ message: expect.stringContaining("explicit update") }),
    ]);
    expect(
      buildHoldingsCsvImportPlan({
        batchId: "csv-3",
        resolutions: [
          { ...resolution, allowExistingUpdate: true },
          { ...resolution, allowExistingUpdate: true, row: { ...row, rowNumber: 3 } },
        ],
        state: store.getState(),
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("same asset") }),
      ]),
    );

    store.getState().addTrade({
      assetId: asset.id,
      date: "2026-07-01",
      id: "existing-trade",
      pricePerUnit: 1500,
      quantity: 1,
      totalValue: 1500,
      type: "buy",
    });
    expect(
      buildHoldingsCsvImportPlan({
        batchId: "csv-history",
        resolutions: [{ ...resolution, allowExistingUpdate: true }],
        state: store.getState(),
      }).errors,
    ).toEqual([
      expect.objectContaining({ message: expect.stringContaining("transaction history") }),
    ]);
  });

  it("does not reinterpret a CSV manual price in another currency", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const asset = assetFromLookupResult(lookup);

    expect(
      buildHoldingsCsvImportPlan({
        batchId: "csv-currency",
        resolutions: [
          {
            allowExistingUpdate: false,
            asset,
            candidates: [lookup],
            row: { ...row, currency: "USD", currentPrice: 20, valuationAsOf: "2026-08-01" },
            status: "ready",
          },
        ],
        state: store.getState(),
      }).errors,
    ).toEqual([
      expect.objectContaining({ message: expect.stringContaining("does not match") }),
    ]);

    expect(
      buildHoldingsCsvImportPlan({
        batchId: "csv-exchange",
        resolutions: [
          {
            allowExistingUpdate: false,
            asset,
            candidates: [lookup],
            row: { ...row, exchange: "BSE" },
            status: "ready",
          },
        ],
        state: store.getState(),
      }).errors,
    ).toEqual([
      expect.objectContaining({ message: expect.stringContaining("does not match") }),
    ]);
  });

  it("matches equivalent manual entry for a representative 21-holding portfolio", () => {
    const currentDate = new Date("2026-08-15T12:00:00.000Z");
    const importedStore = createPortfolioStore({
      now: () => currentDate,
      storage: createMemoryJsonStorage(),
    });
    const manualStore = createPortfolioStore({
      now: () => currentDate,
      storage: createMemoryJsonStorage(),
    });
    const resolutions = Array.from({ length: 21 }, (_, index) => {
      const csvRow: ParsedHoldingsCsvRow = {
        assetClass: "debt",
        averageCost: 100 + index,
        currency: "INR",
        currentPrice: 120 + index,
        firstPurchaseDate: "2026-08-01",
        instrumentType: "debt",
        name: `Debt Holding ${index + 1}`,
        quantity: index + 1,
        rowNumber: index + 2,
        sectorType: "fixedIncome",
        symbol: `DEBT${index + 1}`,
        ticker: `DEBT-${index + 1}`,
        valuationAsOf: "2026-08-01",
      };
      return {
        allowExistingUpdate: false,
        asset: buildManualAssetFromCsvRow(csvRow)!,
        candidates: [],
        row: csvRow,
        status: "ready" as const,
      };
    });
    const plan = buildHoldingsCsvImportPlan({
      batchId: "csv-parity-21",
      now: currentDate,
      resolutions,
      state: importedStore.getState(),
    });

    expect(plan.errors).toEqual([]);
    expect(plan.command?.items).toHaveLength(21);
    importedStore.getState().recordOpeningPositionBatch(plan.command!);
    for (const item of plan.command!.items) {
      manualStore.getState().recordOpeningPosition(item);
    }

    expect(importedStore.getState().assets).toEqual(manualStore.getState().assets);
    expect(importedStore.getState().openingPositions).toEqual(
      manualStore.getState().openingPositions,
    );
    expect(
      buildE2ePortfolioEvidence(importedStore.getState(), currentDate).rollupTotals,
    ).toEqual(
      buildE2ePortfolioEvidence(manualStore.getState(), currentDate).rollupTotals,
    );
  });
});
