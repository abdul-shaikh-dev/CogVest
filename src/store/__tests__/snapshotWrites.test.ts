import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey } from "@/src/store";
import type { MonthlySnapshot } from "@/src/types";

const snapshot: MonthlySnapshot = {
  id: "snapshot", month: "2026-08", portfolioValue: 1000, cashValue: 1000,
  equityValue: 0, debtValue: 0, cryptoValue: 0, investedValue: 0, monthlyInvestment: 0,
  generated: { source: "manual", generatedAt: "2026-09-01T10:00:00Z", priceBasis: "mixed", warnings: [] },
};

describe("snapshot write boundaries", () => {
  it("invalidates old-month flow evidence and marks relocated generated values as manual", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const original = { ...snapshot, generated: { ...snapshot.generated!, source: "auto" as const }, performanceBasis: { status: "complete" as const, netExternalFlow: 100, weightedExternalFlow: 50, warnings: [] } };
    store.getState().addMonthlySnapshot(original);
    store.getState().updateMonthlySnapshot({ ...original, month: "2026-07" });
    expect(store.getState().monthlySnapshots[0]).toMatchObject({ month: "2026-07", generated: { source: "manual" }, performanceBasis: { status: "unavailable" } });
  });
  it.each(["add", "correct"] as const)("rejects invalid %s records without publishing or persisting", (action) => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });
    if (action === "correct") store.getState().addMonthlySnapshot(snapshot);
    const before = store.getState();
    const raw = storage.getRawItem(portfolioStorageKey);
    const subscriber = jest.fn();
    store.subscribe(subscriber);
    for (const candidate of [{ ...snapshot, portfolioValue: 2000 }, { ...snapshot, month: "2026-13" }, { ...snapshot, cashValue: 1000.001 }, { ...snapshot, investedValue: Infinity }]) {
      expect(() => action === "add" ? store.getState().addMonthlySnapshot(candidate) : store.getState().updateMonthlySnapshot(candidate)).toThrow();
      expect(store.getState()).toBe(before);
      expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
    }
    expect(subscriber).not.toHaveBeenCalled();
  });

  it.each(["correct", "delete"] as const)("failed %s keeps live state, disk, revision and restart unchanged; retry succeeds", (action) => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });
    store.getState().addMonthlySnapshot(snapshot);
    const before = store.getState();
    const raw = storage.getRawItem(portfolioStorageKey);
    const revision = store.getState().getBackupRevision();
    const subscriber = jest.fn();
    store.subscribe(subscriber);
    const write = storage.setItem;
    storage.setItem = () => { throw new Error("Storage full"); };
    const apply = () => action === "delete" ? store.getState().removeMonthlySnapshot(snapshot.id) : store.getState().updateMonthlySnapshot({ ...snapshot, cashValue: 2000, portfolioValue: 2000 });
    expect(apply).toThrow("Storage full");
    expect(store.getState()).toBe(before);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
    expect(store.getState().getBackupRevision()).toBe(revision);
    expect(subscriber).not.toHaveBeenCalled();
    expect(createPortfolioStore({ storage }).getState().monthlySnapshots).toEqual([snapshot]);
    storage.setItem = write;
    apply();
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(store.getState().getBackupRevision()).not.toBe(revision);
    expect(createPortfolioStore({ storage }).getState().monthlySnapshots).toEqual(store.getState().monthlySnapshots);
  });

  it("retains inconsistent legacy values until explicit correction restores backup eligibility", () => {
    const storage = createMemoryJsonStorage();
    const seed = createPortfolioStore({ storage });
    seed.getState().addMonthlySnapshot(snapshot);
    const raw = JSON.parse(storage.getRawItem(portfolioStorageKey)!);
    raw.monthlySnapshots[0].portfolioValue = 2000;
    storage.setRawItem(portfolioStorageKey, JSON.stringify(raw));
    const store = createPortfolioStore({ storage });
    expect(store.getState().monthlySnapshots[0].portfolioValue).toBe(2000);
    expect(() => store.getState().captureBackup()).toThrow(/correction/);
    expect(JSON.parse(storage.getRawItem(portfolioStorageKey)!).monthlySnapshots[0].portfolioValue).toBe(2000);
    store.getState().updateMonthlySnapshot({ ...snapshot, cashValue: 2000, portfolioValue: 2000 });
    expect(store.getState().captureBackup().payload.portfolio.monthlySnapshots[0].portfolioValue).toBe(2000);
    expect(createPortfolioStore({ storage }).getState().monthlySnapshots[0].cashValue).toBe(2000);
  });

  it("rejects duplicate months before they can block backup", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addMonthlySnapshot(snapshot);
    expect(() => store.getState().addMonthlySnapshot({ ...snapshot, id: "duplicate" })).toThrow(/already/);
    store.getState().addMonthlySnapshot({ ...snapshot, id: "other", month: "2026-07" });
    expect(() => store.getState().updateMonthlySnapshot({ ...snapshot, id: "other" })).toThrow(/already/);
  });
});
