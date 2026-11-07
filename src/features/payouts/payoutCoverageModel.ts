import { compareCodeUnits } from "@/src/domain/ordering";
import { wholePortfolioPayoutGaps } from "@/src/features/dashboard/portfolioXirr";

export type PayoutCoverageRow = {
  assetId: string;
  name: string;
  /** The date the portfolio return needs payouts recorded from. */
  requiredFrom: string;
  /** Payouts already recorded on or after `requiredFrom`. */
  recordedPayouts: number;
};

/**
 * Holdings whose missing payout confirmation limits the portfolio return (#619),
 * by name. A holding that already has payouts recorded in the period is not
 * offered for "no payouts": its record has to be reviewed one holding at a time.
 */
export function payoutCoverageRows(
  state: Parameters<typeof wholePortfolioPayoutGaps>[0],
  now: Date,
): { confirmable: PayoutCoverageRow[]; withPayouts: PayoutCoverageRow[] } {
  const names = new Map(state.assets.map((asset) => [asset.id, asset.name]));
  const rows = wholePortfolioPayoutGaps(state, now).map((gap) => ({
    assetId: gap.assetId,
    name: names.get(gap.assetId) ?? gap.assetId,
    requiredFrom: gap.requiredFrom,
    recordedPayouts: state.distributions
      .filter((item) => item.assetId === gap.assetId && item.paidOn >= gap.requiredFrom).length,
  })).sort((a, b) => a.name.localeCompare(b.name) || compareCodeUnits(a.assetId, b.assetId));
  return {
    confirmable: rows.filter((row) => row.recordedPayouts === 0),
    withPayouts: rows.filter((row) => row.recordedPayouts > 0),
  };
}

/** Coverage entries for the selected holdings, each from the date the return needs. */
export function noPayoutEntries(rows: readonly PayoutCoverageRow[], selected: ReadonlySet<string>) {
  return rows.filter((row) => selected.has(row.assetId)).map((row) => ({ assetId: row.assetId, from: row.requiredFrom }));
}
