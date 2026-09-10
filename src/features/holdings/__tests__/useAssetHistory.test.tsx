import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useAssetHistory } from "../useAssetHistory";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createDailyPriceCache, type DailyPriceEntry } from "@/src/services/quotes/dailyPriceCache";
import { AssetHistoryError, fetchAssetHistory } from "@/src/services/quotes/assetHistoryProvider";
import type { Asset } from "@/src/types";

jest.mock("@/src/services/quotes/assetHistoryProvider", () => ({
  ...jest.requireActual("@/src/services/quotes/assetHistoryProvider"),
  fetchAssetHistory: jest.fn(),
}));
jest.mock("@/src/services/quotes/dailyPriceCache", () => ({
  ...jest.requireActual("@/src/services/quotes/dailyPriceCache"),
  createDailyPriceCache: jest.fn(),
}));
const realCreate = jest.requireActual("@/src/services/quotes/dailyPriceCache").createDailyPriceCache;
const asset: Asset = { id: "a", assetClass: "stock", currency: "INR", name: "A", symbol: "A", ticker: "A.NS" };
const makeEntry = (id: string): DailyPriceEntry => ({ basis: "close", provider: "yahoo", providerId: id, currency: "INR", from: "2025-01-01", to: "2025-01-05", complete: true, fetchedAt: new Date().toISOString(), points: [{ date: "2025-01-01", close: 100 }] });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(createDailyPriceCache).mockImplementation(() => realCreate({ storage: createMemoryJsonStorage() }));
});

it("ignores a previous asset completion after identity changes", async () => {
  let finishA!: (entry: DailyPriceEntry) => void;
  jest.mocked(fetchAssetHistory).mockImplementation((request) => request.providerId === "A.NS"
    ? new Promise((resolve) => { finishA = resolve; }) : Promise.resolve(makeEntry("B.NS")));
  const hook = renderHook(({ selected }: { selected: Asset }) => useAssetHistory(selected, "2025-01-01", "2025-01-05"), { initialProps: { selected: asset } });
  hook.rerender({ selected: { ...asset, id: "b", ticker: "B.NS" } });
  await waitFor(() => expect(hook.result.current.entry?.providerId).toBe("B.NS"));
  await act(async () => { finishA(makeEntry("A.NS")); });
  expect(hook.result.current.entry?.providerId).toBe("B.NS");
});

it("keeps stale cached observations visible when offline", async () => {
  const cache = realCreate({ storage: createMemoryJsonStorage() });
  cache.write({ ...makeEntry("A.NS"), fetchedAt: "2025-01-06T00:00:00.000Z" });
  jest.mocked(createDailyPriceCache).mockReturnValue(cache);
  jest.mocked(fetchAssetHistory).mockRejectedValue(new Error("offline"));
  const hook = renderHook(() => useAssetHistory(asset, "2025-01-01", "2025-01-05"));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.entry?.points[0].close).toBe(100);
  expect(hook.result.current.freshness).toBe("stale");
  expect(hook.result.current.message).toContain("connection");
});

it("does not request a manual asset", () => {
  const hook = renderHook(() => useAssetHistory({ ...asset, assetClass: "debt", instrumentType: "ppf" }, "2025-01-01", "2025-01-05"));
  expect(hook.result.current.loading).toBe(false);
  expect(hook.result.current.message).toContain("not available");
  expect(fetchAssetHistory).not.toHaveBeenCalled();
});

it("removes unsafe cached history after discovering a corporate action", async () => {
  const cache = realCreate({ storage: createMemoryJsonStorage() });
  cache.write({ ...makeEntry("A.NS"), fetchedAt: "2025-01-06T00:00:00.000Z" });
  jest.mocked(createDailyPriceCache).mockReturnValue(cache);
  jest.mocked(fetchAssetHistory).mockRejectedValue(new AssetHistoryError("corporate-action", "A split affects this range."));
  const hook = renderHook(() => useAssetHistory(asset, "2025-01-01", "2025-01-05"));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.entry).toBeUndefined();
  expect(cache.read(makeEntry("A.NS")).status).toBe("missing");
});

it("does not revive unverified holding values when corporate-action cache clearing fails", async () => {
  const cache = realCreate({ storage: createMemoryJsonStorage() });
  cache.write({ ...makeEntry("FAIL-CLEAR.NS"), fetchedAt: "2025-01-06T00:00:00.000Z" });
  cache.clear = jest.fn(() => ({ status: "unavailable" }));
  jest.mocked(createDailyPriceCache).mockReturnValue(cache);
  jest.mocked(fetchAssetHistory).mockRejectedValue(new AssetHistoryError("corporate-action", "Split"));
  const selected = { ...asset, ticker: "FAIL-CLEAR.NS" };
  const first = renderHook(() => useAssetHistory(selected, "2025-01-01", "2025-01-05"));
  await waitFor(() => expect(first.result.current.loading).toBe(false));
  first.unmount();
  jest.mocked(fetchAssetHistory).mockRejectedValue(new Error("offline"));
  const second = renderHook(() => useAssetHistory(selected, "2025-01-01", "2025-01-05"));
  await waitFor(() => expect(second.result.current.loading).toBe(false));
  expect(second.result.current.entry).toBeDefined();
  expect(second.result.current.holdingSafe).toBe(false);
});
