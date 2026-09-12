import {
  matchesOpeningPosition,
  reconcileTransactions,
} from "@/src/domain/transactionReconciliation";
import type { Trade } from "@/src/types";

function transaction(input: Partial<Trade> & Pick<Trade, "id" | "type">): Trade {
  const base = {
    assetId: "asset-1",
    date: "2025-01-01",
    quantity: 1,
    ...input,
  };

  if (base.type === "buy" || base.type === "sell") {
    return {
      ...base,
      pricePerUnit: "pricePerUnit" in base ? (base.pricePerUnit ?? 100) : 100,
      totalValue: "totalValue" in base ? (base.totalValue ?? 100) : 100,
    } as Trade;
  }

  return base as Trade;
}

describe("transaction reconciliation", () => {
  it("uses moving weighted-average cost and preserves it across disposals", () => {
    const result = reconcileTransactions({
      transactions: [
        transaction({ id: "buy-1", pricePerUnit: 100, quantity: 10, type: "buy" }),
        transaction({ id: "buy-2", pricePerUnit: 200, quantity: 10, type: "buy" }),
        transaction({ id: "sell-1", pricePerUnit: 250, quantity: 5, type: "sell" }),
        transaction({ id: "out-1", quantity: 5, type: "transferOut" }),
      ],
    });

    expect(result).toEqual({
      averageCostPrice: 150,
      isExact: true,
      oversoldTransactionIds: [],
      quantity: 10,
      totalCost: "1500",
      unresolvedTransactionIds: [],
    });
  });

  it("includes buy fees in the same moving-average basis used by holdings", () => {
    const result = reconcileTransactions({
      transactions: [
        transaction({
          fees: 10,
          id: "buy-with-fees",
          pricePerUnit: 100,
          quantity: 10,
          totalValue: 1010,
          type: "buy",
        }),
      ],
    });

    expect(result.averageCostPrice).toBe(101);
    expect(
      matchesOpeningPosition(result, {
        averageCostPrice: 101,
        quantity: 10,
      }),
    ).toBe(true);
  });

  it("includes costed transfers and blocks unknown transfer-in basis", () => {
    const costed = reconcileTransactions({
      transactions: [
        transaction({
          acquisitionCostPerUnit: 125,
          id: "transfer-1",
          quantity: 4,
          type: "transferIn",
        }),
      ],
    });
    expect(costed.quantity).toBe(4);
    expect(costed.averageCostPrice).toBe(125);
    expect(costed.isExact).toBe(true);

    const unresolved = reconcileTransactions({
      transactions: [
        transaction({ id: "transfer-2", quantity: 4, type: "transferIn" }),
      ],
    });
    expect(unresolved.quantity).toBe(4);
    expect(unresolved.unresolvedTransactionIds).toEqual(["transfer-2"]);
    expect(unresolved.isExact).toBe(false);
  });

  it("reports oversells without manufacturing negative quantity", () => {
    const result = reconcileTransactions({
      transactions: [
        transaction({ id: "sell-1", pricePerUnit: 100, quantity: 2, type: "sell" }),
      ],
    });

    expect(result.quantity).toBe(0);
    expect(result.oversoldTransactionIds).toEqual(["sell-1"]);
    expect(result.isExact).toBe(false);
  });

  it("preserves imported CSV row order for same-day transactions", () => {
    const provenance = (row: number) => ({
      fingerprint: `fingerprint-${row}`,
      importBatchId: "batch-1",
      originalRowNumber: row,
      sourceFormat: "cogvest-transactions",
      sourceVersion: "1",
    });
    const result = reconcileTransactions({
      transactions: [
        transaction({
          id: "sell-first",
          importProvenance: provenance(2),
          pricePerUnit: 100,
          quantity: 10,
          type: "sell",
        }),
        transaction({
          id: "buy-second",
          importProvenance: provenance(3),
          pricePerUnit: 100,
          quantity: 10,
          type: "buy",
        }),
      ],
    });

    expect(result.oversoldTransactionIds).toEqual(["sell-first"]);
    expect(result.isExact).toBe(false);
  });

  it("matches an opening baseline only within domain precision", () => {
    const result = reconcileTransactions({
      transactions: [
        transaction({ id: "buy-1", pricePerUnit: 100, quantity: 2, type: "buy" }),
      ],
    });

    expect(
      matchesOpeningPosition(result, {
        averageCostPrice: 100,
        quantity: 2,
      }),
    ).toBe(true);
    expect(
      matchesOpeningPosition(result, {
        averageCostPrice: 100.00000001,
        quantity: 2,
      }),
    ).toBe(false);
  });
});
