import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

// The "Block screenshots" preference is optional and off by default (#660).
describe("screenshot blocking preference", () => {
  it("is off for a new portfolio, and absent from its backup", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    expect(store.getState().preferences.blockScreenCapture).toBeUndefined();
    expect(store.getState().captureBackup().payload.portfolio.preferences).not.toHaveProperty("blockScreenCapture");
  });

  it("follows this device, not the backup, across a restore (#718)", () => {
    const source = createPortfolioStore({ storage: createMemoryJsonStorage() });
    source.getState().updatePreferences({ blockScreenCapture: true });
    const backup = source.getState().captureBackup().payload;
    expect(backup.portfolio.preferences.blockScreenCapture).toBe(true);

    const unprotected = createPortfolioStore({ storage: createMemoryJsonStorage() });
    unprotected.getState().replaceFromBackup(backup, unprotected.getState().getBackupRevision());
    expect(unprotected.getState().preferences.blockScreenCapture).toBeUndefined();

    const protectedDevice = createPortfolioStore({ storage: createMemoryJsonStorage() });
    protectedDevice.getState().updatePreferences({ blockScreenCapture: true });
    source.getState().updatePreferences({ blockScreenCapture: false });
    protectedDevice.getState().replaceFromBackup(source.getState().captureBackup().payload, protectedDevice.getState().getBackupRevision());
    expect(protectedDevice.getState().preferences.blockScreenCapture).toBe(true);
  });
});
