import { act, renderHook } from "@testing-library/react-native";
import { useRecordPurchase } from "../useRecordPurchase";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset } from "@/src/types";

const now = new Date("2026-09-20T10:00:00Z");
const asset: Asset = { id: "asset", name: "Accounting Test Asset", symbol: "ACCT", ticker: "ACCT.NS", currency: "INR", assetClass: "stock", exchange: "NSE" };
describe("purchase identity and review", () => {
  it("accepts same-calendar-day funding stored as an ISO timestamp", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now: () => now });
    store.getState().addAsset(asset);
    store.getState().addCashEntry({ id: "same-day", amount: 1000, date: "2026-09-20T00:00:00.000Z", label: "Funding", purpose: "capitalContribution", type: "addition" });
    const { result } = renderHook(() => useRecordPurchase({ store, now, initialAssetId: asset.id }));
    act(() => { result.current.update("quantity", "2"); result.current.update("pricePerUnit", "100"); });
    act(() => result.current.prepareReview());
    act(() => { expect(result.current.save()).toBe(true); });
    expect(store.getState().cashEntries[1].amount).toBe(200);
  });
  it("reuses a canonical identity and invalidates review when execution details change", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now: () => now });
    store.getState().addAsset(asset);
    const { result } = renderHook(() => useRecordPurchase({ store, now }));
    act(() => result.current.selectAsset({ ...asset, id: "provider-new-id" }));
    expect(result.current.asset?.id).toBe("asset");
    act(() => { result.current.update("quantity", "2"); result.current.update("pricePerUnit", "100"); });
    act(() => result.current.prepareReview());
    expect(result.current.review?.totalValue).toBe(200);
    act(() => { result.current.setPhase("details"); result.current.update("quantity", "3"); });
    expect(result.current.review).toBeUndefined();
    expect(result.current.save()).toBe(false);
    expect(store.getState().trades).toHaveLength(0);
  });
  it("rejects foreign settlement identities without implicitly converting to INR", () => {
    const { result } = renderHook(() => useRecordPurchase({ now, store: createPortfolioStore({ storage: createMemoryJsonStorage() }) }));
    act(() => result.current.selectAsset({ ...asset, currency: "USD" }));
    expect(result.current.phase).toBe("asset");
    expect(result.current.errors.asset).toMatch(/INR/);
    expect(result.current.asset).toBeUndefined();
  });
});
