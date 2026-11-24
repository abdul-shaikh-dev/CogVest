import { validateBackupPayload } from "@/src/domain/portfolioBackup";
import { parsePersistedPreferences } from "@/src/domain/persistedSchemas/persistedPortfolioSchema";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

const targets = { cash: 10, crypto: 5, debt: 25, equity: 60 };

describe("allocation targets persistence (#764)", () => {
  it("are absent for a new portfolio and from its backup", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    expect(store.getState().preferences.allocationTargets).toBeUndefined();
    expect(store.getState().captureBackup().payload.portfolio.preferences).not.toHaveProperty("allocationTargets");
  });

  it("saves valid targets, survives a reload, and clears", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });
    expect(store.getState().saveAllocationTargets(targets)).toEqual({ status: "applied" });
    expect(createPortfolioStore({ storage }).getState().preferences.allocationTargets).toEqual(targets);

    expect(store.getState().saveAllocationTargets(null)).toEqual({ status: "applied" });
    expect(store.getState().preferences).not.toHaveProperty("allocationTargets");
    expect(createPortfolioStore({ storage }).getState().preferences.allocationTargets).toBeUndefined();
  });

  it("does not save targets that miss 100% or are out of range", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().saveAllocationTargets(targets);
    expect(store.getState().saveAllocationTargets({ ...targets, equity: 50 }))
      .toEqual({ problems: ["Targets must add up to 100%."], status: "rejected" });
    expect(store.getState().saveAllocationTargets({ cash: 0, crypto: 0, debt: -1, equity: 101 }).status).toBe("rejected");
    expect(store.getState().preferences.allocationTargets).toEqual(targets);
  });

  it("travels with a backup and restores", () => {
    const source = createPortfolioStore({ storage: createMemoryJsonStorage() });
    source.getState().saveAllocationTargets(targets);
    const payload = validateBackupPayload(JSON.parse(JSON.stringify(source.getState().captureBackup().payload)));
    expect(payload.portfolio.preferences.allocationTargets).toEqual(targets);

    const device = createPortfolioStore({ storage: createMemoryJsonStorage() });
    device.getState().replaceFromBackup(payload, device.getState().getBackupRevision());
    expect(device.getState().preferences.allocationTargets).toEqual(targets);
  });

  it("rejects a stored or backed-up mix that does not add up to 100%", () => {
    const record = (allocationTargets: unknown) => JSON.stringify({
      preferences: { allocationTargets, defaultChartRange: "1Y", displayMode: "standard", hasCompletedOnboarding: true, maskWealthValues: false },
      version: 1,
    });
    expect(parsePersistedPreferences(record(targets)).success).toBe(true);
    expect(parsePersistedPreferences(record({ ...targets, cash: 11 }))).toEqual({ reason: "invalid-shape", success: false });
    expect(parsePersistedPreferences(record({ ...targets, gold: 0 }))).toEqual({ reason: "invalid-shape", success: false });

    const source = createPortfolioStore({ storage: createMemoryJsonStorage() });
    source.getState().saveAllocationTargets(targets);
    const payload = JSON.parse(JSON.stringify(source.getState().captureBackup().payload));
    payload.portfolio.preferences.allocationTargets.cash = 11;
    expect(() => validateBackupPayload(payload)).toThrow();
  });
});
