import { formatLocalCalendarDate } from "@/src/domain/dates";
import { getLinkedLegacyEpfAssetIds } from "@/src/domain/epf/legacyLinks";
import { getLinkedLegacyPpfAssetIds } from "@/src/domain/ppf";
import { buildInvestmentsXirrInput } from "@/src/domain/xirrInputs";
import { summariseXirr } from "@/src/domain/xirrSummary";
import type { PortfolioStoreState } from "@/src/store";

type XirrState = Pick<PortfolioStoreState, "assets" | "cashEntries" | "distributionCoverage" | "distributions" | "epf"
  | "futuresAccounts" | "openingPositions" | "ppfAccounts" | "ppfLedgerEntries" | "quoteCache" | "trades">;

/** Which accounts the Investments return covers, for its scope line. */
export function investmentsScope(state: XirrState) {
  const parts = [
    state.trades.length || state.openingPositions.length ? "market holdings" : null,
    state.ppfAccounts.length ? "PPF" : null,
    state.epf.accounts.length ? "EPF" : null,
    state.futuresAccounts.length ? "Futures" : null,
  ].filter((part): part is string => part !== null);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0] ?? "nothing yet";
  return `Covers ${list}. Cash is excluded.`;
}

/** Investments XIRR (D8) measured to now, from stored records only; never persisted. */
export function investmentsXirrSummary(state: XirrState, now: Date) {
  const today = formatLocalCalendarDate(now);
  // Legacy holdings linked to a PPF or EPF account are replaced by that account's records.
  const replaced = new Set([...getLinkedLegacyPpfAssetIds(state.ppfAccounts, today), ...getLinkedLegacyEpfAssetIds(state.epf.accounts, today)]);
  return summariseXirr(buildInvestmentsXirrInput({
    assets: state.assets,
    trades: state.trades.filter((trade) => !replaced.has(trade.assetId)),
    openingPositions: state.openingPositions.filter((position) => !replaced.has(position.assetId)),
    quotes: state.quoteCache,
    distributions: state.distributions,
    distributionCoverage: state.distributionCoverage,
    ppfAccounts: state.ppfAccounts,
    ppfLedgerEntries: state.ppfLedgerEntries,
    epf: state.epf,
    futuresAccounts: state.futuresAccounts,
    cashEntries: state.cashEntries,
    endDate: today,
    today,
    valuationTime: now.toISOString(),
  }));
}
