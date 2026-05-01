import { useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";

type UseSettingsInput = {
  store?: StoreApi<PortfolioStoreState>;
};

export type UseSettingsResult = {
  maskWealthValues: boolean;
  toggleMaskWealthValues: () => void;
};

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useSettings({
  store = getPortfolioStore(),
}: UseSettingsInput = {}): UseSettingsResult {
  const snapshot = usePortfolioSnapshot(store);

  function toggleMaskWealthValues() {
    store.getState().updatePreferences({
      maskWealthValues: !store.getState().preferences.maskWealthValues,
    });
  }

  return {
    maskWealthValues: snapshot.preferences.maskWealthValues,
    toggleMaskWealthValues,
  };
}
