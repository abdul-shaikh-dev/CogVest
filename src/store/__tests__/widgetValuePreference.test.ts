import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

// The widget's value is opt-in and stays off by default (#786).
describe("widget value preference", () => {
  it("is off for a new portfolio, and absent from its backup", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    expect(store.getState().preferences.showWidgetValue).toBeUndefined();
    expect(store.getState().captureBackup().payload.portfolio.preferences).not.toHaveProperty("showWidgetValue");
  });

  it("survives a reload", () => {
    const storage = createMemoryJsonStorage();
    createPortfolioStore({ storage }).getState().updatePreferences({ showWidgetValue: true });
    expect(createPortfolioStore({ storage }).getState().preferences.showWidgetValue).toBe(true);
  });

  it("follows this device across a restore, so a backup never puts the value on this home screen", () => {
    const source = createPortfolioStore({ storage: createMemoryJsonStorage() });
    source.getState().updatePreferences({ showWidgetValue: true });
    const backup = source.getState().captureBackup().payload;
    expect(backup.portfolio.preferences.showWidgetValue).toBe(true);

    const device = createPortfolioStore({ storage: createMemoryJsonStorage() });
    device.getState().replaceFromBackup(backup, device.getState().getBackupRevision());
    expect(device.getState().preferences.showWidgetValue).toBeUndefined();

    const optedIn = createPortfolioStore({ storage: createMemoryJsonStorage() });
    optedIn.getState().updatePreferences({ showWidgetValue: true });
    source.getState().updatePreferences({ showWidgetValue: false });
    optedIn.getState().replaceFromBackup(source.getState().captureBackup().payload, optedIn.getState().getBackupRevision());
    expect(optedIn.getState().preferences.showWidgetValue).toBe(true);
  });
});
