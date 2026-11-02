import type { StoreApi } from "zustand/vanilla";
import type { JsonStorage } from "@/src/services/storage";

import type { PortfolioStoreState } from "./storeTypes";

/** What every action group shares: store access, storage and the clock (#617). */
export type StoreContext = {
  assertBackupReady: (state: PortfolioStoreState) => void;
  bindActions: (epoch: number) => Partial<PortfolioStoreState>;
  get: () => PortfolioStoreState;
  now: () => Date;
  revision: (state: PortfolioStoreState) => string;
  set: StoreApi<PortfolioStoreState>["setState"];
  storage: JsonStorage;
};
