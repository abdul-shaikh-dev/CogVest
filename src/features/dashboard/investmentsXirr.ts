import { formatLocalCalendarDate } from "@/src/domain/dates";
import { formatDate } from "@/src/domain/formatters";
import { getLinkedLegacyEpfAssetIds } from "@/src/domain/epf/legacyLinks";
import { getLinkedLegacyPpfAssetIds } from "@/src/domain/ppf";
import { buildWholePortfolioXirrInput } from "@/src/domain/wholePortfolioXirr";
import { buildInvestmentsXirrInput, type InvestmentsXirrInput } from "@/src/domain/xirrInputs";
import { summariseXirr } from "@/src/domain/xirrSummary";
import type { PortfolioStoreState } from "@/src/store";

type XirrState = Pick<PortfolioStoreState, "assets" | "cashEntries" | "distributionCoverage" | "distributions" | "epf"
  | "futuresAccounts" | "openingPositions" | "ppfAccounts" | "ppfLedgerEntries" | "quoteCache" | "trades">;
type WholeState = XirrState & Pick<PortfolioStoreState, "measurementBasis">;

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

/** What the whole-portfolio return covers and where it starts. */
export function wholePortfolioScope(state: Pick<PortfolioStoreState, "measurementBasis">) {
  const basis = state.measurementBasis;
  if (!basis) return "Covers everything CogVest tracks, Cash included, from a start you set.";
  return basis.kind === "inception"
    ? `Covers everything CogVest tracks, Cash included, since ${formatDate(basis.startDate)}.`
    : `Covers everything CogVest tracks, Cash included, from its value at the end of ${formatDate(basis.startDate)}.`;
}

/** Records behind both returns, with legacy holdings that a PPF or EPF account replaces left out. */
function xirrRecords(state: XirrState, now: Date): InvestmentsXirrInput {
  const today = formatLocalCalendarDate(now);
  const replaced = new Set([...getLinkedLegacyPpfAssetIds(state.ppfAccounts, today), ...getLinkedLegacyEpfAssetIds(state.epf.accounts, today)]);
  return {
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
  };
}

/** Investments XIRR (D8) measured to now, from stored records only; never persisted. */
export function investmentsXirrSummary(state: XirrState, now: Date) {
  return summariseXirr(buildInvestmentsXirrInput(xirrRecords(state, now)));
}

/** Whole-portfolio XIRR (D9-D11) from the measurement basis to now; never persisted. */
export function wholePortfolioXirrSummary(state: WholeState, now: Date) {
  return summariseXirr(buildWholePortfolioXirrInput({
    ...xirrRecords(state, now), basis: state.measurementBasis,
    // The store fingerprints every record, including legacy holdings left out of the flows.
    evidence: state,
  }));
}
