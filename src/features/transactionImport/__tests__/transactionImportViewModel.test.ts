import type { TransactionImportPlan } from "@/src/features/transactionImport/transactionImport";
import type { ResolutionGroup } from "@/src/features/transactionImport/transactionImportResolution";
import {
  candidateTestID,
  candidateTitle,
  casStatementSummaryText,
  confirmImportTitle,
  getMatchGroups,
  groupPlanErrors,
  holdingMatchCountText,
  holdingMatchDetail,
  importFileName,
  parseErrorText,
  planErrorText,
  replacementConsequenceText,
  selectFileAction,
  shouldShowDryRun,
} from "@/src/features/transactionImport/transactionImportViewModel";
import type { TransactionImportController } from "@/src/features/transactionImport/useTransactionImport";
import type { Asset } from "@/src/types";

const asset: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "yahoo:EXAMPLE.NS",
  name: "Example Limited",
  symbol: "EXAMPLE",
  ticker: "EXAMPLE.NS",
};

function group(overrides: Partial<ResolutionGroup> = {}): ResolutionGroup {
  return {
    candidates: [],
    key: "isin:INE000000001",
    rowNumbers: [2],
    title: "ISIN INE000000001",
    ...overrides,
  };
}

type PlanError = TransactionImportPlan["errors"][number];

describe("match groups", () => {
  it("separates conflicts, unresolved, suggested and matched holdings", () => {
    const conflict = group({ identityConflict: true, key: "a", selectedAsset: asset });
    const pending = group({ key: "b" });
    const suggested = group({ key: "c", suggestedAsset: asset });
    const matched = group({ key: "d", selectedAsset: asset });

    expect(getMatchGroups([conflict, pending, suggested, matched])).toEqual({
      identityConflicts: [conflict],
      matched: [matched],
      suggested: [suggested],
      unresolved: [pending, suggested],
    });
  });

  it("holds the dry run until every holding is matched", () => {
    const controller = {
      casReview: undefined,
      groups: [group({ selectedAsset: asset })],
      isResolving: false,
      unsupportedEvents: [],
    } as unknown as TransactionImportController;

    expect(shouldShowDryRun(controller, getMatchGroups(controller.groups))).toBe(true);
    expect(shouldShowDryRun(controller, getMatchGroups([group()]))).toBe(false);
    expect(
      shouldShowDryRun({ ...controller, isResolving: true }, getMatchGroups(controller.groups)),
    ).toBe(false);
  });
});

describe("holding match text", () => {
  it("describes a suggested provider match", () => {
    const suggested = group({ rowNumbers: [2, 3], suggestedAsset: asset });

    expect(holdingMatchDetail(suggested, asset)).toBe("EXAMPLE.NS • NSE • Suggested match");
    expect(holdingMatchCountText(suggested, asset)).toBe("2 transactions • ISIN INE000000001");
  });

  it("labels statement funds and unresolved historical identities", () => {
    const fund = { ...asset, exchange: undefined, id: "cas:INF000000001", ticker: "INF000000001" };

    expect(holdingMatchDetail(group({ selectedAsset: fund }), fund)).toBe("INF000000001 • From statement");
    expect(holdingMatchDetail(group({ identityConflict: true }), asset)).toBe(
      "EXAMPLE.NS • NSE • Historical identity unresolved",
    );
    expect(holdingMatchCountText(group(), undefined)).toBe("1 transaction");
  });

  it("offers allocation choices for statement funds", () => {
    const fund = group({ casClassificationRequired: true, key: "isin:INF000000001" });
    const debt = { ...asset, assetClass: "debt" as const, id: "cas:INF000000001" };

    expect(candidateTitle(fund, debt)).toBe("Classify as Debt");
    expect(candidateTestID(fund, debt)).toBe(
      "transaction-import-asset-isin:INF000000001-candidate-cas:INF000000001-debt",
    );
    expect(candidateTitle(group(), asset)).toBe("Example Limited • EXAMPLE.NS");
  });
});

describe("plan errors", () => {
  const conflict = {
    assetId: asset.id,
    code: "conflictingTransaction",
    message: "Transaction conflicts with a saved record.",
  } as unknown as PlanError;

  it("counts repeated errors once and leaves out match errors", () => {
    const unresolved = { code: "unresolvedAsset", message: "Match needed." } as unknown as PlanError;
    const grouped = groupPlanErrors([conflict, conflict, unresolved]);

    expect(grouped).toEqual([{ count: 2, error: conflict }]);
    expect(planErrorText(grouped[0], [], [asset])).toBe(
      "Example Limited: Transaction conflicts with a saved record. (2 transactions)",
    );
  });

  it("omits the asset name when the asset is unknown", () => {
    expect(planErrorText({ count: 1, error: conflict }, [], [])).toBe(
      "Transaction conflicts with a saved record.",
    );
  });
});

describe("import labels", () => {
  it("names the file button for the source and selection", () => {
    expect(selectFileAction("zerodhaTradebookEqV1", false)).toEqual({
      testID: "select-transaction-csv",
      title: "Choose Tradebook CSV",
    });
    expect(selectFileAction("zerodhaTradebookEqV1", true).title).toBe("Add another Tradebook");
    expect(selectFileAction("camsKfinCasPdfV1", true)).toEqual({
      testID: "select-cas-statement",
      title: "Choose another statement",
    });
    expect(selectFileAction("cogvestCsvV1", false).title).toBe("Choose CSV");
  });

  it("formats file names, row errors and statement totals", () => {
    expect(importFileName("tradebook-2025.CSV")).toBe("tradebook-2025.CSV");
    expect(importFileName("download")).toBe("Tradebook CSV");
    expect(parseErrorText({ message: "Date is invalid.", rowNumber: 4 })).toBe("Row 4: Date is invalid.");
    expect(parseErrorText({ message: "Header is invalid." })).toBe("Header is invalid.");
    expect(casStatementSummaryText(1, 1)).toBe("1 scheme • 1 transaction ready. Folio numbers stay private.");
  });

  it("explains which opening balances are replaced", () => {
    expect(replacementConsequenceText(1, 1)).toBe("1 of 1 opening balance will be replaced after confirmation.");
    expect(replacementConsequenceText(1, 3)).toBe(
      "1 of 3 opening balances will be replaced after confirmation. 2 will stay unchanged unless the imported history reconciles exactly.",
    );
  });

  it("names the confirm action", () => {
    const controller = (command: unknown, isSaving = false) =>
      ({ isSaving, plan: { command } }) as unknown as TransactionImportController;

    expect(confirmImportTitle(controller({ transactions: [{}] }))).toBe("Confirm transaction import");
    expect(confirmImportTitle(controller({ transactions: [] }))).toBe("Apply share adjustments");
    expect(confirmImportTitle(controller({ transactions: [] }, true))).toBe("Importing...");
  });
});
