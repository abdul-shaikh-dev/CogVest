import type { StoreContext } from "./storeContext";
import type { PortfolioStoreState } from "./storeTypes";
import { persistPortfolio } from "./persistence";

type PreferenceActions = Pick<PortfolioStoreState, "updatePreferences" | "acknowledgeNudge">;

export function createPreferenceActions({ get, set, storage }: StoreContext): PreferenceActions {
  return {
    updatePreferences: (preferences) => {
      set((state) => ({
        preferences: {
          ...state.preferences,
          ...preferences,
        },
      }));
      persistPortfolio(storage, get());
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
      persistPortfolio(storage, { ...state, preferences });
      set({ preferences });
    },
  };
}
