import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey } from "@/src/store";
import type { MonthlySnapshot } from "@/src/types";

const month = (id: string, value: string, portfolioValue: number): MonthlySnapshot => ({
  cashValue: 0, cryptoValue: 0, debtValue: 0, equityValue: portfolioValue, id, investedValue: 100,
  month: value, monthlyInvestment: 0, portfolioValue,
  generated: { generatedAt: "2026-09-01T10:00:00Z", priceBasis: "mixed", source: "manual", warnings: [] },
});

function seeded() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage });
  for (const item of [month("a", "2026-01", 1000), month("b", "2026-02", 2000), month("c", "2026-03", 3000)]) {
    store.getState().addMonthlySnapshot(item);
  }
  return { storage, store };
}

describe("replacing several saved months at once (#751)", () => {
  test("replaces only the given months, keeping their IDs, in one write that survives a restart", () => {
    const { storage, store } = seeded();
    const recalculated = [
      { ...month("a", "2026-01", 1500), generated: { ...month("a", "2026-01", 0).generated!, source: "auto" as const } },
      { ...month("c", "2026-03", 3500), generated: { ...month("c", "2026-03", 0).generated!, source: "auto" as const } },
    ];
    const subscriber = jest.fn();
    store.subscribe(subscriber);
    store.getState().replaceMonthlySnapshots(recalculated);
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(store.getState().monthlySnapshots.map((item) => [item.id, item.portfolioValue, item.generated?.source]))
      .toEqual([["a", 1500, "auto"], ["b", 2000, "manual"], ["c", 3500, "auto"]]);
    const restarted = createPortfolioStore({ storage });
    expect(restarted.getState().monthlySnapshots.map((item) => item.portfolioValue)).toEqual([1500, 2000, 3500]);
  });

  test.each([
    ["an unknown month", [month("a", "2026-01", 1500), month("gone", "2026-04", 1)]],
    ["a moved month", [month("a", "2026-01", 1500), month("b", "2026-05", 2500)]],
    ["an invalid month", [month("a", "2026-01", 1500), { ...month("b", "2026-02", 2500), portfolioValue: -1 }]],
    ["a repeated month", [month("a", "2026-01", 1500), month("a", "2026-01", 1600)]],
  ])("one bad replacement (%s) saves none of them", (_label, replacements) => {
    const { storage, store } = seeded();
    const before = store.getState();
    const raw = storage.getRawItem(portfolioStorageKey);
    expect(() => store.getState().replaceMonthlySnapshots(replacements)).toThrow();
    expect(store.getState()).toBe(before);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
  });

  test("a failed save keeps live state, disk and restart unchanged; a retry saves them all", () => {
    const { storage, store } = seeded();
    const before = store.getState();
    const raw = storage.getRawItem(portfolioStorageKey);
    const write = storage.setItem;
    storage.setItem = () => { throw new Error("Storage full"); };
    const apply = () => store.getState().replaceMonthlySnapshots([month("a", "2026-01", 1500), month("b", "2026-02", 2500)]);
    expect(apply).toThrow("Storage full");
    expect(store.getState()).toBe(before);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
    expect(createPortfolioStore({ storage }).getState().monthlySnapshots.map((item) => item.portfolioValue))
      .toEqual([1000, 2000, 3000]);
    storage.setItem = write;
    apply();
    expect(createPortfolioStore({ storage }).getState().monthlySnapshots.map((item) => item.portfolioValue))
      .toEqual([1500, 2500, 3000]);
  });

  test("replacing nothing changes nothing", () => {
    const { storage, store } = seeded();
    const before = store.getState();
    const raw = storage.getRawItem(portfolioStorageKey);
    store.getState().replaceMonthlySnapshots([]);
    expect(store.getState()).toBe(before);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
  });
});
