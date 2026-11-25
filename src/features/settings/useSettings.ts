import type { StoreApi } from "zustand/vanilla";

import { formatDate } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import type { AllocationTargets, DisplayMode, Quote, SipTemplate } from "@/src/types";
import type { AppearancePreference } from "@/src/types/preferences";
import { usePortfolioFields } from "@/src/hooks";

type UseSettingsInput = {
  store?: StoreApi<PortfolioStoreState>;
};

export type UseSettingsResult = {
  /** The saved target mix, if any (#764). */
  allocationTargets: AllocationTargets | undefined;
  sipTemplates: SipTemplate[];
  appearance: AppearancePreference;
  blockScreenCapture: boolean;
  setAppearance: (appearance: AppearancePreference) => void;
  displayMode: DisplayMode;
  maskWealthValues: boolean;
  quoteStatus: SettingsQuoteStatus;
  setDisplayMode: (displayMode: DisplayMode) => void;
  showWidgetValue: boolean;
  toggleBlockScreenCapture: () => void;
  toggleMaskWealthValues: () => void;
  toggleShowWidgetValue: () => void;
};

export type SettingsQuoteSourceLabel = "Waiting" | "Live" | "Manual" | "Mixed";

export type SettingsQuoteStatus = {
  latestQuoteAsOf: string | null;
  latestQuoteLabel: string;
  liveQuoteCount: number;
  manualFallbackCount: number;
  providerStatus: "Live available" | "Manual only" | "Waiting for holdings";
  quoteCount: number;
  quoteSourceLabel: SettingsQuoteSourceLabel;
};

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return usePortfolioFields(store, ["preferences", "quoteCache", "sipTemplates"]);
}

function getLatestQuote(quotes: Quote[]) {
  return quotes
    .filter((quote) => !Number.isNaN(new Date(quote.asOf).getTime()))
    .sort(
      (left, right) =>
        new Date(right.asOf).getTime() - new Date(left.asOf).getTime(),
    )[0];
}

function getQuoteSourceLabel({
  liveQuoteCount,
  manualFallbackCount,
  quoteCount,
}: {
  liveQuoteCount: number;
  manualFallbackCount: number;
  quoteCount: number;
}): SettingsQuoteSourceLabel {
  if (quoteCount === 0) {
    return "Waiting";
  }

  if (liveQuoteCount > 0 && manualFallbackCount > 0) {
    return "Mixed";
  }

  if (liveQuoteCount > 0) {
    return "Live";
  }

  return "Manual";
}

function deriveQuoteStatus(quoteCache: PortfolioStoreState["quoteCache"]) {
  const quotes = Object.values(quoteCache);
  const manualFallbackCount = quotes.filter(
    (quote) => quote.source === "manual",
  ).length;
  const liveQuoteCount = quotes.length - manualFallbackCount;
  const latestQuote = getLatestQuote(quotes);
  const providerStatus =
    quotes.length === 0
      ? "Waiting for holdings"
      : liveQuoteCount > 0
        ? "Live available"
        : "Manual only";
  const quoteSourceLabel = getQuoteSourceLabel({
    liveQuoteCount,
    manualFallbackCount,
    quoteCount: quotes.length,
  });

  return {
    latestQuoteAsOf: latestQuote?.asOf ?? null,
    latestQuoteLabel: latestQuote ? formatDate(latestQuote.asOf) : "No quotes yet",
    liveQuoteCount,
    manualFallbackCount,
    providerStatus,
    quoteCount: quotes.length,
    quoteSourceLabel,
  } satisfies SettingsQuoteStatus;
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

  function toggleBlockScreenCapture() {
    store.getState().updatePreferences({
      blockScreenCapture: !store.getState().preferences.blockScreenCapture,
    });
  }

  function toggleShowWidgetValue() {
    store.getState().updatePreferences({
      showWidgetValue: !store.getState().preferences.showWidgetValue,
    });
  }

  function setDisplayMode(displayMode: DisplayMode) {
    store.getState().updatePreferences({ displayMode });
  }

  return {
    displayMode: snapshot.preferences.displayMode,
    appearance: snapshot.preferences.appearance ?? "dark",
    blockScreenCapture: snapshot.preferences.blockScreenCapture === true,
    setAppearance: (appearance) => store.getState().updatePreferences({ appearance }),
    maskWealthValues: snapshot.preferences.maskWealthValues,
    quoteStatus: deriveQuoteStatus(snapshot.quoteCache),
    setDisplayMode,
    showWidgetValue: snapshot.preferences.showWidgetValue === true,
    allocationTargets: snapshot.preferences.allocationTargets,
    sipTemplates: snapshot.sipTemplates,
    toggleBlockScreenCapture,
    toggleMaskWealthValues,
    toggleShowWidgetValue,
  };
}
