import type { StoreApi } from "zustand/vanilla";

import type { EpfChange } from "@/src/domain/epf/persistence";
import type { PortfolioStoreState } from "@/src/store";

/** Applies one validated EPF command; returns a user-facing error, or null. */
export function applyEpfChange(
  store: StoreApi<PortfolioStoreState>,
  command: { commandId: string; reason: string; change: EpfChange },
  expectedRevision: string,
) {
  try {
    store.getState().applyEpfCommand(command, expectedRevision);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/revision|changed/i.test(message)) return "Your portfolio changed on another screen. Review the latest values and try again.";
    return message || "CogVest could not save this EPF change safely.";
  }
}
