import { formatLocalCalendarDate } from "@/src/domain/dates";
import { formatDate } from "@/src/domain/formatters";
import { getLinkedLegacyEpfAssetIds } from "@/src/domain/epf/legacyLinks";
import { getLinkedLegacyPpfAssetIds } from "@/src/domain/ppf";
import { automaticMeasurementBasis, buildWholePortfolioXirrInput } from "@/src/domain/wholePortfolioXirr";
import type { InvestmentsXirrInput } from "@/src/domain/xirrInputs";
import { summariseXirr } from "@/src/domain/xirrSummary";
import type { PortfolioStoreState } from "@/src/store";

type XirrState = Pick<PortfolioStoreState, "assets" | "cashEntries" | "distributionCoverage" | "distributions" | "epf"
  | "futuresAccounts" | "openingPositions" | "ppfAccounts" | "ppfLedgerEntries" | "quoteCache" | "trades">;
type WholeState = XirrState & Pick<PortfolioStoreState, "measurementBasis" | "monthlySnapshots">;

/** Display names for the holdings and accounts a blocking reason can name. */
export function xirrNames(state: Pick<XirrState, "assets" | "epf" | "futuresAccounts" | "ppfAccounts">) {
  const names: Record<string, string> = {};
  for (const asset of state.assets) names[asset.id] = asset.name;
  for (const account of state.ppfAccounts) names[account.id] = `PPF · ${account.nickname}`;
  for (const account of state.epf.accounts) names[account.id] = `EPF · ${account.nickname}`;
  for (const account of state.futuresAccounts) names[account.id] = "Futures";
  return names;
}

/** The start the portfolio return uses: the user's, or the automatic one from the earliest snapshot (#610). */
export function portfolioBasis(state: Pick<PortfolioStoreState, "measurementBasis" | "monthlySnapshots">, now: Date) {
  return state.measurementBasis
    ? { basis: state.measurementBasis, automatic: false }
    : { basis: automaticMeasurementBasis(state.monthlySnapshots, formatLocalCalendarDate(now)), automatic: true };
}

/** What the portfolio return covers and where it starts. */
export function wholePortfolioScope(state: Pick<PortfolioStoreState, "measurementBasis" | "monthlySnapshots">, now: Date) {
  const { basis, automatic } = portfolioBasis(state, now);
  if (!basis) return "Covers everything CogVest tracks, Cash included.";
  if (automatic) return `Covers everything CogVest tracks, Cash included, from your earliest month-end snapshot (${formatDate(basis.startDate)}).`;
  return basis.kind === "inception"
    ? `Covers everything CogVest tracks, Cash included, since ${formatDate(basis.startDate)}.`
    : `Covers everything CogVest tracks, Cash included, from its value at the end of ${formatDate(basis.startDate)}.`;
}

/** Records behind the return, with legacy holdings that a PPF or EPF account replaces left out. */
function xirrRecords(state: XirrState, now: Date): InvestmentsXirrInput {
  const today = formatLocalCalendarDate(now);
  const replaced = new Set([...getLinkedLegacyPpfAssetIds(state.ppfAccounts, today), ...getLinkedLegacyEpfAssetIds(state.epf.accounts, today)]);
  return {
    assets: state.assets,
    // Unfiltered records keep their identity, so the holdings replay is shared (#138).
    trades: replaced.size ? state.trades.filter((trade) => !replaced.has(trade.assetId)) : state.trades,
    openingPositions: replaced.size
      ? state.openingPositions.filter((position) => !replaced.has(position.assetId))
      : state.openingPositions,
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

/** Whole-portfolio XIRR (D9-D11) from the measurement basis to now; never persisted. */
export function wholePortfolioXirrSummary(state: WholeState, now: Date) {
  const { basis, automatic } = portfolioBasis(state, now);
  return summariseXirr(buildWholePortfolioXirrInput({
    ...xirrRecords(state, now), basis, automaticBasis: automatic,
    // The store fingerprints every record, including legacy holdings left out of the flows.
    evidence: state,
  }));
}
