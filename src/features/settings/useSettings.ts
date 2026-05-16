import { useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

import { formatDate } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import type { Quote } from "@/src/types";

type UseSettingsInput = {
  store?: StoreApi<PortfolioStoreState>;
};

export type UseSettingsResult = {
  maskWealthValues: boolean;
  quoteStatus: SettingsQuoteStatus;
  toggleMaskWealthValues: () => void;
};

export type SettingsQuoteStatus = {
  latestQuoteAsOf: string | null;
  latestQuoteLabel: string;
  liveQuoteCount: number;
  manualFallbackCount: number;
  providerStatus: "Live available" | "Manual only" | "Waiting for holdings";
  quoteCount: number;
};

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

function getLatestQuote(quotes: Quote[]) {
  return quotes
    .filter((quote) => !Number.isNaN(new Date(quote.asOf).getTime()))
    .sort(
      (left, right) =>
        new Date(right.asOf).getTime() - new Date(left.asOf).getTime(),
    )[0];
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

  return {
    latestQuoteAsOf: latestQuote?.asOf ?? null,
    latestQuoteLabel: latestQuote ? formatDate(latestQuote.asOf) : "No quotes yet",
    liveQuoteCount,
    manualFallbackCount,
    providerStatus,
    quoteCount: quotes.length,
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

  return {
    maskWealthValues: snapshot.preferences.maskWealthValues,
    quoteStatus: deriveQuoteStatus(snapshot.quoteCache),
    toggleMaskWealthValues,
  };
}
