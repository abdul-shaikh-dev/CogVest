import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

// The "Block screenshots" preference is optional and off by default (#660).
describe("screenshot blocking preference", () => {
  it("is off for a new portfolio, and absent from its backup", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    expect(store.getState().preferences.blockScreenCapture).toBeUndefined();
    expect(store.getState().captureBackup().payload.portfolio.preferences).not.toHaveProperty("blockScreenCapture");
  });

  it("survives a backup and restore when turned on", () => {
    const source = createPortfolioStore({ storage: createMemoryJsonStorage() });
    source.getState().updatePreferences({ blockScreenCapture: true });
    const target = createPortfolioStore({ storage: createMemoryJsonStorage() });

    target.getState().replaceFromBackup(source.getState().captureBackup().payload, target.getState().getBackupRevision());

    expect(target.getState().preferences.blockScreenCapture).toBe(true);
  });
});
