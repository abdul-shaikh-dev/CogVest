import { useMemo } from "react";
import type { StoreApi } from "zustand/vanilla";

import { formatLocalCalendarDate } from "@/src/domain/dates";
import type { XirrSummary } from "@/src/domain/xirrSummary";
import { usePortfolioFields } from "@/src/hooks/usePortfolioSlice";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";

import { wholePortfolioXirrSummary } from "./portfolioXirr";

/**
 * The whole-portfolio return (#535), shared by the Dashboard tile and the
 * Progress benchmark comparison (#765). The solver is bounded but not free, so
 * it reruns only when a record it reads or the calendar day changes, not on a
 * preference toggle (#663).
 */
export function useWholePortfolioXirr(store: StoreApi<PortfolioStoreState> = getPortfolioStore(), now = new Date()): XirrSummary {
  const {
    assets, cashEntries, distributionCoverage, distributions, epf, futuresAccounts, measurementBasis,
    monthlySnapshots, openingPositions, ppfAccounts, ppfLedgerEntries, quoteCache, trades,
  } = usePortfolioFields(store, ["assets", "cashEntries", "distributionCoverage", "distributions", "epf", "futuresAccounts",
    "measurementBasis", "monthlySnapshots", "openingPositions", "ppfAccounts", "ppfLedgerEntries", "quoteCache", "trades"]);
  const asOf = formatLocalCalendarDate(now);
  return useMemo(
    () => wholePortfolioXirrSummary({
      assets, cashEntries, distributionCoverage, distributions, epf, futuresAccounts, measurementBasis,
      monthlySnapshots, openingPositions, ppfAccounts, ppfLedgerEntries, quoteCache, trades,
    }, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the calendar day (asOf), not the per-render Date.
    [assets, cashEntries, distributionCoverage, distributions, epf, futuresAccounts, measurementBasis,
      monthlySnapshots, openingPositions, ppfAccounts, ppfLedgerEntries, quoteCache, trades, asOf],
  );
}
