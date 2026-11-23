import { createHash } from "node:crypto";

import { createPortfolioBackup, parsePortfolioBackup, validateBackupPayload } from "@/src/domain/portfolioBackup";
import { createMemoryJsonStorage, type JsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey, type SavingsGoalInput } from "@/src/store";
import type { Asset, CashEntry } from "@/src/types";

const now = () => new Date("2026-11-24T06:00:00Z");
const digest = async (text: string) => createHash("sha256").update(text).digest("hex");
const stock: Asset = { assetClass: "stock", currency: "INR", exchange: "NSE", id: "stock", name: "Synthetic", symbol: "SYN", ticker: "SYN.NS" };
const deposit: CashEntry = { amount: 5000, date: "2026-01-01", id: "deposit", label: "Deposit", purpose: "capitalContribution", type: "addition" };
const house: SavingsGoalInput = {
  assumedAnnualReturnPct: 10,
  id: "goal-house",
  name: " House ",
  scope: { assetIds: ["stock", "stock"], epfAccountIds: [], includeCash: true, kind: "selected", ppfAccountIds: [] },
  targetAmountInr: 2_500_000,
  targetDate: "2031-12-31",
};

function harness(storage: JsonStorage = createMemoryJsonStorage()) {
  const store = createPortfolioStore({ storage, now });
  store.getState().addAsset(stock);
  store.getState().addCashEntry(deposit);
  return { storage, store };
}

describe("savings goals persistence (#767)", () => {
  it("saves a trimmed, de-duplicated goal that survives restart and changes no other record", () => {
    const { storage, store } = harness();
    const before = store.getState().captureBackup().payload.portfolio;

    const result = store.getState().saveSavingsGoal(house);

    expect(result).toEqual({ goal: {
      assumedAnnualReturnPct: 10, createdAt: "2026-11-24T06:00:00.000Z", id: "goal-house", name: "House",
      scope: { assetIds: ["stock"], epfAccountIds: [], includeCash: true, kind: "selected", ppfAccountIds: [] },
      targetAmountInr: 2_500_000, targetDate: "2031-12-31", updatedAt: "2026-11-24T06:00:00.000Z",
    }, status: "applied" });
    expect({ ...store.getState().captureBackup().payload.portfolio, savingsGoals: [] }).toEqual(before);
    expect(createPortfolioStore({ storage, now }).getState().savingsGoals).toEqual(store.getState().savingsGoals);
  });

  it("edits in place keeping createdAt, and deletes", () => {
    const { storage, store } = harness();
    store.getState().saveSavingsGoal(house);
    const later = createPortfolioStore({ storage, now: () => new Date("2026-12-01T06:00:00Z") });

    const edited = later.getState().saveSavingsGoal({ ...house, name: "Bigger house", scope: { kind: "portfolio" } });

    expect(edited).toMatchObject({ goal: { createdAt: "2026-11-24T06:00:00.000Z", name: "Bigger house",
      scope: { kind: "portfolio" }, updatedAt: "2026-12-01T06:00:00.000Z" }, status: "applied" });
    expect(later.getState().savingsGoals).toHaveLength(1);
    expect(later.getState().deleteSavingsGoal("goal-house")).toEqual({ status: "applied" });
    expect(later.getState().deleteSavingsGoal("goal-house")).toEqual({ reason: "notFound", status: "rejected" });
    expect(createPortfolioStore({ storage, now }).getState().savingsGoals).toEqual([]);
  });

  it("rejects an invalid goal or a 21st goal without saving", () => {
    const { storage, store } = harness();
    const raw = storage.getRawItem(portfolioStorageKey);

    expect(store.getState().saveSavingsGoal({ ...house, assumedAnnualReturnPct: 40, targetAmountInr: -1 }))
      .toMatchObject({ problems: { assumedAnnualReturnPct: expect.any(String), targetAmountInr: expect.any(String) }, reason: "invalidEntry", status: "rejected" });
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);

    for (let index = 0; index < 20; index += 1) store.getState().saveSavingsGoal({ ...house, id: `goal-${index}` });
    expect(store.getState().saveSavingsGoal({ ...house, id: "goal-21" })).toEqual({ reason: "limit", status: "rejected" });
    expect(store.getState().savingsGoals).toHaveLength(20);
  });

  it("keeps memory unchanged when the save fails", () => {
    const storage = createMemoryJsonStorage();
    const { store } = harness(storage);
    const failing: JsonStorage = { ...storage, setItem: () => { throw new Error("simulated goal save failure"); } };
    const failingStore = createPortfolioStore({ storage: failing, now });

    expect(() => failingStore.getState().saveSavingsGoal(house)).toThrow("simulated goal save failure");
    expect(failingStore.getState().savingsGoals).toEqual([]);
    expect(store.getState().savingsGoals).toEqual([]);
  });

  it("migrates a V19 record once with no goals", () => {
    const { storage, store } = harness();
    const { savingsGoals: _goals, ...v19 } = JSON.parse(storage.getRawItem(portfolioStorageKey)!);
    storage.setRawItem(portfolioStorageKey, JSON.stringify({ ...v19, schemaVersion: 19 }));

    const migrated = createPortfolioStore({ storage, now });

    expect(migrated.getState().storageRecovery).toBeUndefined();
    expect(migrated.getState().captureBackup().payload).toEqual(store.getState().captureBackup().payload);
    expect(JSON.parse(storage.getRawItem(portfolioStorageKey)!)).toMatchObject({ savingsGoals: [], schemaVersion: 20 });
  });

  it("rejects a V19 record that already carries goals, and a V20 record with an invalid goal", () => {
    const { storage, store } = harness();
    store.getState().saveSavingsGoal(house);
    const current = JSON.parse(storage.getRawItem(portfolioStorageKey)!);
    storage.setRawItem(portfolioStorageKey, JSON.stringify({ ...current, schemaVersion: 19 }));
    expect(createPortfolioStore({ storage, now }).getState().storageRecovery).toBeDefined();

    const invalidStorage = createMemoryJsonStorage();
    invalidStorage.setRawItem(portfolioStorageKey, JSON.stringify({ ...current,
      savingsGoals: [{ ...current.savingsGoals[0], assumedAnnualReturnPct: 99 }] }));
    expect(createPortfolioStore({ storage: invalidStorage, now }).getState().storageRecovery).toBeDefined();
  });

  it("round-trips goals through backup, restores a V19 backup with none, and rejects a tampered goal", async () => {
    const { store } = harness();
    store.getState().saveSavingsGoal(house);
    const payload = store.getState().captureBackup().payload;
    const text = await createPortfolioBackup(payload, { appVersion: "1.0.36", createdAt: now().toISOString() }, digest);
    const target = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    target.getState().replaceFromBackup((await parsePortfolioBackup(text, digest)).payload, target.getState().getBackupRevision());
    expect(target.getState().captureBackup().payload).toEqual(payload);

    const { savingsGoals: _goals, ...v19Portfolio } = payload.portfolio;
    expect(validateBackupPayload({ ...payload, portfolio: { ...v19Portfolio, schemaVersion: 19 } as never }).portfolio)
      .toMatchObject({ savingsGoals: [], schemaVersion: 20 });

    const tampered = JSON.parse(JSON.stringify(payload));
    tampered.portfolio.savingsGoals[0].targetAmountInr = 0;
    const fresh = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    const before = fresh.getState();
    expect(() => fresh.getState().replaceFromBackup(tampered, fresh.getState().getBackupRevision())).toThrow();
    expect(fresh.getState()).toBe(before);
  });
});
