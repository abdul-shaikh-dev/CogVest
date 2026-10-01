import { act, renderHook } from "@testing-library/react-native";

import { transactionCsvHeaders } from "@/src/domain/transactionCsv";
import type { AssetLookupResult } from "@/src/services/assetLookup";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { useTransactionImport } from "../useTransactionImport";

const candidate: AssetLookupResult = {
  assetClass: "stock", currency: "INR", exchange: "NSE",
  id: "yahoo:EXAMPLE.NS", name: "Example", symbol: "EXAMPLE", ticker: "EXAMPLE.NS",
  provider: "yahoo", quoteSourceId: "EXAMPLE.NS", sourceLabel: "Yahoo Finance",
  instrumentType: "stock", instrumentTypeConfidence: "provider",
  sectorType: "other", sectorTypeConfidence: "provider", metadataReviewMessage: "Ready",
};
const text = `${transactionCsvHeaders.join(",")}\n1,buy,2024-01-02,INE000000001,NSE,EXAMPLE,INR,2,100,,,one,,,,,`;

async function setup(measuredAsOf?: string) {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now: () => new Date("2024-12-31T12:00:00Z") });
  store.getState().addAsset({ ...candidate, id: "local-example" });
  store.getState().addOpeningPosition({ assetId: "local-example", id: "opening-example", quantity: 2, averageCostPrice: 100, date: "2024-01-01", measuredAsOf });
  const before = store.getState();
  const onImported = jest.fn();
  const hook = renderHook(() => useTransactionImport({
    store, onImported, now: () => new Date("2024-12-31T12:00:00Z"),
    pickCsvFile: async () => ({ name: "synthetic.csv", size: text.length, text }),
    searchAssetLookupResults: async () => ({ failures: [], results: [candidate] }),
  }));
  act(() => hook.result.current.setSourceId("cogvestCsvV1"));
  await act(async () => { await hook.result.current.selectFile(); });
  const group = hook.result.current.groups[0];
  act(() => hook.result.current.selectCandidate(group.key, group.candidates![0]));
  return { ...hook, store, before, onImported, key: group.key };
}

describe("import baseline identity", () => {
  it.each(["supplemental", "fullHistory"] as const)("uses the canonical opening date in %s and leaves cancelled previews untouched", async (mode) => {
    const { result, store, before, unmount, onImported } = await setup();
    act(() => result.current.setMode(mode));
    expect(result.current.plan.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "missingCutover", assetId: "local-example" })]));
    expect(result.current.cutoverHoldings).toHaveLength(1);
    expect(result.current.cutoverHoldings[0].position.id).toBe("opening-example");
    expect(result.current.cutoverHoldings[0].asset.id).toBe("local-example");
    expect(result.current.needsSharedCutover).toBe(true);
    act(() => result.current.confirmImport());
    expect(onImported).not.toHaveBeenCalled();
    act(() => result.current.setSharedCutover(mode === "fullHistory" ? "2024-02-01" : "2024-01-01"));
    expect(result.current.plan.errors).toEqual([]);
    expect(result.current.plan.holdings[0].reconciliation.quantity).toBe(mode === "fullHistory" ? 2 : 4);
    expect(result.current.plan.holdings[0].reconciliation.averageCostPrice).toBe(100);
    expect(result.current.plan.command).toBeDefined();
    unmount();
    expect(store.getState()).toBe(before);
  });

  it("shows the saved date, follows candidate changes, and does not attach unrelated openings", async () => {
    const { result, key, store, before } = await setup("2024-01-01");
    expect(result.current.cutoverHoldings[0]?.position.measuredAsOf).toBe("2024-01-01");
    expect(result.current.needsSharedCutover).toBe(false);
    expect(result.current.plan.errors).toEqual([]);
    act(() => result.current.selectCandidate(key, { ...candidate, id: "other", quoteSourceId: "OTHER.NS", ticker: "OTHER.NS", symbol: "OTHER" }));
    expect(result.current.cutoverHoldings).toEqual([]);
    expect(result.current.plan.holdings[0].baseline).toBeUndefined();
    act(() => result.current.selectCandidate(key, candidate));
    expect(result.current.cutoverHoldings).toHaveLength(1);
    expect(result.current.cutoverHoldings[0].position.id).toBe("opening-example");
    expect(store.getState()).toBe(before);
  });

  it("preserves exact reconciliation and date validation after resolving the local ID", async () => {
    const { result, store, before } = await setup();
    act(() => result.current.setMode("fullHistory"));
    act(() => result.current.setSharedCutover("2024-01-01"));
    expect(result.current.plan.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "reconciliationMismatch" })]));
    expect(result.current.plan.command).toBeUndefined();
    act(() => result.current.setCutover("opening-example", "2025-01-01"));
    expect(result.current.plan.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalidCutover" })]));
    expect(result.current.plan.command).toBeUndefined();
    expect(store.getState()).toBe(before);
  });

  it("commits to the local asset only and detects a repeated import", async () => {
    const { result, store, onImported } = await setup();
    act(() => result.current.setMode("fullHistory"));
    act(() => result.current.setSharedCutover("2024-02-01"));
    act(() => result.current.confirmImport());
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(store.getState().assets).toHaveLength(1);
    expect(store.getState().assets[0].id).toBe("local-example");
    expect(store.getState().openingPositions).toEqual([]);
    expect(store.getState().trades).toHaveLength(1);
    expect(store.getState().trades[0]).toMatchObject({ assetId: "local-example", quantity: 2, pricePerUnit: 100 });
    expect(store.getState().cashEntries).toEqual([]);
    await act(async () => { await result.current.selectFile(); });
    expect(result.current.plan.duplicates).toBe(1);
    expect(result.current.plan.summary.additions).toBe(0);
    expect(store.getState().trades).toHaveLength(1);
  });
});
