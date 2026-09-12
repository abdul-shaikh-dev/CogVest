import type { TransactionCsvCandidate } from "@/src/domain/transactionCsv";
import {
  buildTransactionImportPlan,
  type CasOpeningEvidence,
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
  name: "Example Fund",
  symbol: "EXAMPLE",
  ticker: "EXAMPLE.NS",
};

function opening(quantity: number, measuredAsOf = "2023-12-31"): OpeningPosition {
  return {
    assetId: asset.id,
    averageCostPrice: 100,
    date: null,
    id: "opening-1",
    measuredAsOf,
    quantity,
    recordedAt: "2024-01-01T00:00:00.000Z",
    recordedOn: "2024-01-01",
  };
}

function casRow(selectedAsset = asset, quantity = 2): TransactionCsvCandidate {
  return {
    account: "folio_test",
    currency: "INR",
    externalId: "cas:2024-01-02:purchase:2:100:12",
    fingerprint: "cas-row-1",
    identity: { kind: "isin", value: selectedAsset.isin! },
    isin: selectedAsset.isin,
    quantity,
    rowNumber: 10,
    source: { format: "cams-kfin-cas", version: "combined-detailed-v1" },
    tradeDate: "2024-01-02",
    transactionType: "buy",
    unitPrice: 100,
  };
}

function resolution(selectedAsset = asset): TransactionCsvResolution {
  return { asset: selectedAsset, row: casRow(selectedAsset), status: "ready" };
}

function evidence(openings: string[], coverageFrom: string | undefined = "2024-01-01"): CasOpeningEvidence {
  return {
    ...(coverageFrom ? { coverageFrom } : {}),
    schemes: openings.map((openingUnits, index) => ({
      folioLabel: `Folio ${index + 1}`,
      isin: asset.isin!,
      openingUnits,
    })),
  };
}

function plan(input: {
  assets?: Asset[];
  casOpeningEvidence: CasOpeningEvidence;
  mode: "fullHistory" | "supplemental";
  openingPositions?: OpeningPosition[];
  resolutions?: TransactionCsvResolution[];
  sharedCutover?: string;
  trades?: Trade[];
}) {
  const state = {
    assets: input.assets ?? [asset],
    cashEntries: [],
    monthlySnapshots: [],
    openingPositions: input.openingPositions ?? [],
    trades: input.trades ?? [],
  } as unknown as PortfolioStoreState;
  return buildTransactionImportPlan({
    batchId: "cas-opening-test",
    casOpeningEvidence: input.casOpeningEvidence,
    mode: input.mode,
    now: new Date("2026-08-23T00:00:00.000Z"),
    resolutions: input.resolutions ?? [resolution()],
    sharedCutover: input.sharedCutover,
    state,
  });
}

describe("CAS opening coverage planning", () => {
  it("blocks CAS rows when opening evidence is omitted", () => {
    const state = {
      assets: [asset],
      cashEntries: [],
      monthlySnapshots: [],
      openingPositions: [],
      trades: [],
    } as unknown as PortfolioStoreState;
    const result = buildTransactionImportPlan({
      batchId: "cas-missing-evidence",
      mode: "fullHistory",
      resolutions: [resolution()],
      state,
    });

    expect(result.command).toBeUndefined();
    expect(result.errors).toContainEqual(expect.objectContaining({
      code: "incompleteCasHistory",
      message: expect.stringMatching(/evidence is missing/u),
    }));
  });

  it("blocks CAS rows when opening evidence has no schemes", () => {
    const result = plan({
      casOpeningEvidence: { coverageFrom: "2024-01-01", schemes: [] },
      mode: "fullHistory",
    });

    expect(result.command).toBeUndefined();
    expect(result.errors).toContainEqual(expect.objectContaining({
      code: "incompleteCasHistory",
      message: expect.stringMatching(/does not cover every incoming scheme/u),
    }));
  });

  it("blocks CAS rows when evidence omits one incoming ISIN", () => {
    const secondAsset = { ...asset, id: "asset-2", isin: "INF000000002", name: "Second Fund" };
    const result = plan({
      assets: [asset, secondAsset],
      casOpeningEvidence: evidence(["0"]),
      mode: "fullHistory",
      resolutions: [resolution(), resolution(secondAsset)],
    });

    expect(result.command).toBeUndefined();
    expect(result.errors).toContainEqual(expect.objectContaining({
      code: "incompleteCasHistory",
      message: expect.stringMatching(/does not cover every incoming scheme/u),
    }));
  });

  it.each(["fullHistory", "supplemental"] as const)(
    "blocks a nonzero opening in an empty portfolio for %s mode",
    (mode) => {
      const result = plan({ casOpeningEvidence: evidence(["10"]), mode });

      expect(result.command).toBeUndefined();
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "incompleteCasHistory" }),
      );
    },
  );

  it("allows supplemental rows against an exact opening baseline and boundary cutover", () => {
    const result = plan({
      casOpeningEvidence: evidence(["10"]),
      mode: "supplemental",
      openingPositions: [opening(10)],
      sharedCutover: "2023-12-31",
    });

    expect(result.errors).toEqual([]);
    expect(result.command?.transactions).toHaveLength(1);
  });

  it.each([
    { baseline: opening(9), cutover: "2023-12-31", name: "quantity mismatch" },
    { baseline: opening(10, "2024-01-01"), cutover: "2023-12-31", name: "cutover mismatch" },
  ])("blocks supplemental import on $name", ({ baseline, cutover }) => {
    const result = plan({
      casOpeningEvidence: evidence(["10"]),
      mode: "supplemental",
      openingPositions: [baseline],
      sharedCutover: cutover,
    });

    expect(result.command).toBeUndefined();
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "incompleteCasHistory" }),
    );
  });

  it("blocks a nonzero scheme with no in-period rows because it cannot be resolved", () => {
    const result = plan({
      casOpeningEvidence: evidence(["10"]),
      mode: "supplemental",
      openingPositions: [opening(10)],
      resolutions: [],
      sharedCutover: "2023-12-31",
    });

    expect(result.command).toBeUndefined();
    expect(result.errors).toContainEqual(expect.objectContaining({
      code: "incompleteCasHistory",
      message: expect.stringMatching(/mapped to one resolved holding/u),
    }));
  });

  it("does not treat earlier CAS trades as an opening balance", () => {
    const earlier = plan({
      casOpeningEvidence: evidence(["0"]),
      mode: "fullHistory",
    }).command!.transactions[0];
    const result = plan({
      casOpeningEvidence: evidence(["10"]),
      mode: "supplemental",
      trades: [earlier],
    });

    expect(result.command).toBeUndefined();
    expect(result.errors).toContainEqual(expect.objectContaining({
      code: "incompleteCasHistory",
      message: expect.stringMatching(/saved opening balance/u),
    }));
  });

  it("blocks a nonzero opening mapped to more than one resolved asset", () => {
    const duplicateAsset = { ...asset, id: "asset-2", name: "Duplicate Fund" };
    const result = plan({
      assets: [asset, duplicateAsset],
      casOpeningEvidence: evidence(["10"]),
      mode: "supplemental",
      resolutions: [resolution(), resolution(duplicateAsset)],
      sharedCutover: "2023-12-31",
    });

    expect(result.command).toBeUndefined();
    expect(result.errors).toContainEqual(expect.objectContaining({
      code: "incompleteCasHistory",
      message: expect.stringMatching(/mapped to one resolved holding/u),
    }));
  });

  it("aggregates multiple folio openings exactly for one resolved asset", () => {
    const result = plan({
      casOpeningEvidence: evidence(["4.25", "5.75"]),
      mode: "supplemental",
      openingPositions: [opening(10)],
      sharedCutover: "2023-12-31",
    });

    expect(result.errors).toEqual([]);
    expect(result.command?.transactions).toHaveLength(1);
  });

  it.each(["fullHistory", "supplemental"] as const)(
    "leaves zero-opening %s imports unchanged",
    (mode) => {
      const result = plan({
        casOpeningEvidence: evidence(["0", "0.00000000"]),
        mode,
      });

      expect(result.errors).toEqual([]);
      expect(result.command?.transactions).toHaveLength(1);
    },
  );

  it("blocks supplemental nonzero openings without statement coverage", () => {
    const result = plan({
      casOpeningEvidence: { schemes: evidence(["10"]).schemes },
      mode: "supplemental",
      openingPositions: [opening(10)],
      sharedCutover: "2023-12-31",
    });

    expect(result.command).toBeUndefined();
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "incompleteCasHistory" }),
    );
  });
});
