import type { StoreContext } from "./storeContext";
import type { PortfolioStoreState } from "./storeTypes";
import { persistPreferences } from "./persistence";

type PreferenceActions = Pick<PortfolioStoreState, "updatePreferences" | "acknowledgeNudge">;

export function createPreferenceActions({ get, set, storage }: StoreContext): PreferenceActions {
  return {
    // Preferences have their own key, so a toggle never rewrites the portfolio (#665).
    // The state changes only after the write succeeds.
    updatePreferences: (changes) => {
      const preferences = { ...get().preferences, ...changes };
      persistPreferences(storage, preferences);
      set({ preferences });
    },
    acknowledgeNudge: (kind, version) => {
      if (!Number.isInteger(version) || version < 1) return;
      const state = get();
      if (state.storageRecovery) throw new Error("Resolve storage recovery before saving preferences.");
      if ((state.preferences.nudgeVersions?.[kind] ?? 0) >= version) return;
      const preferences = {
        ...state.preferences,
        nudgeVersions: { ...state.preferences.nudgeVersions, [kind]: version },
      };
      // Do not claim dismissal is saved if local storage rejected the write.
      persistPreferences(storage, preferences);
      set({ preferences });
    },
  };
}
