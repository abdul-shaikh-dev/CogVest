import { useMemo } from "react";
import type { StoreApi } from "zustand/vanilla";

import {
  calculateConsolidatedHoldingRows,
  calculateHoldings,
  calculatePortfolioRollupTotals,
  type ConsolidatedHoldingRow,
  type PortfolioRollupTotals,
} from "@/src/domain/calculations";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import {
  calculatePpfPortfolioSummary,
  getLinkedLegacyPpfAssetIds,
  type PpfPortfolioSummary,
} from "@/src/domain/ppf";
import {
  type QuoteRefreshFailure,
  type QuoteRefreshResult,
  type QuoteRefreshTimeout,
  type QuoteFreshnessSummary,
  summarizeQuoteFreshness,
} from "@/src/services/quotes";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import type { Asset, DisplayMode, OpeningPosition, Trade } from "@/src/types";
import {
  type HoldingWithQuoteMetadata,
  type RefreshQuotes,
  usePortfolioFields,
  useQuoteRefresh,
  withQuoteMetadata,
} from "@/src/hooks";

type UseHoldingsInput = {
  now?: Date;
  refreshQuotes?: RefreshQuotes;
  store?: StoreApi<PortfolioStoreState>;
};

export type UseHoldingsResult = {
  assets: Asset[];
  displayMode: DisplayMode;
  failed: QuoteRefreshFailure[];
  /** Any Cash entry is recorded, so a funded purchase is the natural next step. */
  hasCash: boolean;
  holdings: HoldingWithQuoteMetadata[];
  isRefreshing: boolean;
  maskWealthValues: boolean;
  openingPositions: OpeningPosition[];
  ppfSummary: PpfPortfolioSummary;
  refresh: () => Promise<QuoteRefreshResult>;
  quoteFreshness: QuoteFreshnessSummary;
  refreshError?: string;
  timedOut: QuoteRefreshTimeout[];
  rollupRows: ConsolidatedHoldingRow[];
  rollupTotals: PortfolioRollupTotals;
  toggleMaskWealthValues: () => void;
  trades: Trade[];
};

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return usePortfolioFields(store, ["assets", "cashEntries", "openingPositions", "ppfAccounts", "ppfLedgerEntries", "preferences", "quoteCache", "trades"]);
}

export function useHoldings({
  now = new Date(),
  refreshQuotes,
  store = getPortfolioStore(),
}: UseHoldingsInput = {}): UseHoldingsResult {
  const snapshot = usePortfolioSnapshot(store);
  const { failed, isRefreshing, refresh, refreshError, timedOut } = useQuoteRefresh({ now, refreshQuotes, store });
  const asOf = formatLocalCalendarDate(now);
  // Tab focus and local UI updates do not change the financial replay inputs.
  // Calendar-based accounting rolls over daily; quote freshness below stays live.
  const { holdings, ppfSummary, rollupRows, rollupTotals } = useMemo(() => {
    const accountingDate = new Date(`${asOf}T12:00:00`);
    const ppfSummary = calculatePpfPortfolioSummary({
      accounts: snapshot.ppfAccounts,
      asOf,
      entries: snapshot.ppfLedgerEntries,
    });
    const linkedLegacyAssetIds = getLinkedLegacyPpfAssetIds(snapshot.ppfAccounts, asOf);
    const holdings = withQuoteMetadata(
      calculateHoldings({
        assets: snapshot.assets,
        openingPositions: snapshot.openingPositions,
        quoteCache: snapshot.quoteCache,
        trades: snapshot.trades,
        now: accountingDate,
      }),
      snapshot.quoteCache,
    ).filter(
      (holding) => !linkedLegacyAssetIds.has(holding.asset.id),
    );
    const rollupRows = calculateConsolidatedHoldingRows(holdings);
    const rollupTotals = calculatePortfolioRollupTotals(
      rollupRows,
      0,
      holdings,
      ppfSummary,
    );
    return { holdings, ppfSummary, rollupRows, rollupTotals };
  }, [
    asOf,
    snapshot.assets,
    snapshot.openingPositions,
    snapshot.quoteCache,
    snapshot.trades,
    snapshot.ppfAccounts,
    snapshot.ppfLedgerEntries,
  ]);
  const quoteFreshness = summarizeQuoteFreshness(
    holdings
      .filter((holding) => holding.asset.assetClass !== "cash")
      .map((holding) => holding.asset.id),
    snapshot.quoteCache,
    now,
  );

  function toggleMaskWealthValues() {
    store.getState().updatePreferences({
      maskWealthValues: !store.getState().preferences.maskWealthValues,
    });
  }

  return {
    assets: snapshot.assets,
    displayMode: snapshot.preferences.displayMode,
    failed,
    hasCash: snapshot.cashEntries.length > 0,
    holdings,
    isRefreshing,
    maskWealthValues: snapshot.preferences.maskWealthValues,
    openingPositions: snapshot.openingPositions,
    ppfSummary,
    refresh,
    refreshError,
    quoteFreshness,
    rollupRows,
    rollupTotals,
    toggleMaskWealthValues,
    timedOut,
    trades: snapshot.trades,
  };
}
