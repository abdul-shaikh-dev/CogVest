import {
  calculateCashBalance,
  calculateConsolidatedHoldingRows,
  calculateHoldings,
  calculatePortfolioRollupTotals,
  combineFuturesWithRollupTotals,
} from "@/src/domain/calculations";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { getLinkedLegacyEpfAssetIds } from "@/src/domain/epf/legacyLinks";
import { includeEpfInPortfolioTotals, summarizeEpfForReporting } from "@/src/domain/epf/reporting";
import { calculatePpfPortfolioSummary, getLinkedLegacyPpfAssetIds } from "@/src/domain/ppf";
import type { SavingsGoalValueSources } from "@/src/domain/savingsGoals";
import { calculateUsdmPortfolioContribution } from "@/src/domain/usdmFutures";
import type { RawPortfolioSnapshot } from "@/src/store";
import type { QuoteCache } from "@/src/types";

export type GoalValueRecords = Pick<RawPortfolioSnapshot,
  "assets" | "cashEntries" | "epf" | "futuresAccounts" | "openingPositions" | "ppfAccounts" | "ppfLedgerEntries" | "trades"> & {
  quoteCache: QuoteCache;
};

/**
 * Today's INR values for savings goals (#767), valued exactly as the
 * Dashboard values them, so a whole-portfolio goal shows the Dashboard total.
 */
export function buildSavingsGoalValueSources(records: GoalValueRecords, now: Date): SavingsGoalValueSources {
  const { assets, cashEntries, epf, futuresAccounts, openingPositions, ppfAccounts, ppfLedgerEntries, quoteCache, trades } = records;
  const asOf = formatLocalCalendarDate(now);
  // Holdings linked to a PPF or EPF account are counted by that account instead.
  const linkedLegacyAssetIds = new Set([
    ...getLinkedLegacyPpfAssetIds(ppfAccounts, asOf),
    ...getLinkedLegacyEpfAssetIds(epf.accounts, asOf),
  ]);
  const ppfSummary = calculatePpfPortfolioSummary({ accounts: ppfAccounts, asOf, entries: ppfLedgerEntries });
  const holdings = calculateHoldings({ assets, now, openingPositions, quoteCache, trades })
    .filter((holding) => !linkedLegacyAssetIds.has(holding.asset.id));
  const cashBalance = calculateCashBalance(cashEntries, now);
  const epfSummary = summarizeEpfForReporting(epf, asOf);
  const spotTotals = calculatePortfolioRollupTotals(calculateConsolidatedHoldingRows(holdings), cashBalance, holdings, ppfSummary);
  const futuresContributions = futuresAccounts.map((account) => ({
    accountId: account.id,
    ...calculateUsdmPortfolioContribution(account, now.toISOString(), cashEntries),
  }));
  const { totals: nonEpfTotals } = combineFuturesWithRollupTotals(spotTotals, futuresContributions);
  const { totals } = includeEpfInPortfolioTotals(nonEpfTotals, epfSummary);

  const nonInrAssetIds = new Set<string>();
  const holdingValuesInr = new Map<string, number | null>();
  for (const holding of holdings) {
    const currency = holding.valuation.status === "pending" ? holding.asset.currency : holding.valuation.currency;
    if (holding.asset.currency !== "INR" || currency !== "INR") {
      nonInrAssetIds.add(holding.asset.id);
      continue;
    }
    holdingValuesInr.set(
      holding.asset.id,
      holding.valuation.status === "pending" ? null : holding.calculationBasis?.currentValue !== undefined
        ? Number(holding.calculationBasis.currentValue)
        : holding.currentValue,
    );
  }
  const epfBalancesInr = new Map<string, number | null>(epf.accounts.map((account) => [account.id, null]));
  for (const account of epfSummary.accounts) epfBalancesInr.set(account.accountId, account.balance.total);

  return {
    cashBalanceInr: cashBalance,
    epfBalancesInr,
    holdingValuesInr,
    nonInrAssetIds,
    portfolioTotalInr: totals.totalCurrentValue,
    ppfBalancesInr: new Map(ppfSummary.accounts.map((summary) => [summary.account.id, summary.confirmedBalance])),
  };
}
