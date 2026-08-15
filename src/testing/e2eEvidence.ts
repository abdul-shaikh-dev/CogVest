import { hasCanonicalAssetConflict } from "@/src/domain/assets";
import {
  calculateAllocation,
  calculateCashBalance,
  calculateConsolidatedHoldingRows,
  calculateHoldings,
  calculatePortfolioRollupTotals,
} from "@/src/domain/calculations";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import {
  calculatePpfPortfolioSummary,
  getLinkedLegacyPpfAssetIds,
} from "@/src/domain/ppf";
import type { PortfolioStoreState } from "@/src/store";

export type E2eAssetEvidence = {
  asset: PortfolioStoreState["assets"][number];
  holding?: ReturnType<typeof calculateHoldings>[number];
  key: string;
  openingPositions: PortfolioStoreState["openingPositions"];
  quote?: PortfolioStoreState["quoteCache"][string];
};

export type E2ePortfolioEvidence = {
  allocation: ReturnType<typeof calculateAllocation>;
  assets: E2eAssetEvidence[];
  assetCount: number;
  duplicateIdentityCount: number;
  openingPositionCount: number;
  ppfAccounts: ReturnType<typeof calculatePpfPortfolioSummary>["accounts"];
  ppfConfirmedBalance: number;
  ppfCount: number;
  rollupTotals: ReturnType<typeof calculatePortfolioRollupTotals>;
  tradeCount: number;
};

export function toEvidenceKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildE2ePortfolioEvidence(
  state: PortfolioStoreState,
  now = new Date(),
): E2ePortfolioEvidence {
  const asOf = formatLocalCalendarDate(now);
  const linkedLegacyAssetIds = getLinkedLegacyPpfAssetIds(
    state.ppfAccounts,
    asOf,
  );
  const holdings = calculateHoldings({
    assets: state.assets,
    openingPositions: state.openingPositions,
    quoteCache: state.quoteCache,
    trades: state.trades,
  }).filter((holding) => !linkedLegacyAssetIds.has(holding.asset.id));
  const ppfSummary = calculatePpfPortfolioSummary({
    accounts: state.ppfAccounts,
    asOf,
    entries: state.ppfLedgerEntries,
  });
  const cashBalance = calculateCashBalance(state.cashEntries, now);
  const allocation = calculateAllocation({
    cashBalance,
    holdings,
    ppfConfirmedBalance: ppfSummary.confirmedBalance,
  });
  const rollupTotals = calculatePortfolioRollupTotals(
    calculateConsolidatedHoldingRows(holdings),
    cashBalance,
    holdings,
    ppfSummary,
  );

  return {
    allocation,
    assetCount: state.assets.length,
    assets: state.assets.map((asset) => ({
      asset,
      holding: holdings.find((holding) => holding.asset.id === asset.id),
      key: toEvidenceKey(asset.quoteSourceId ?? asset.ticker ?? asset.id),
      openingPositions: state.openingPositions.filter(
        (position) => position.assetId === asset.id,
      ),
      quote: state.quoteCache[asset.id],
    })),
    duplicateIdentityCount: state.assets.filter((asset) =>
      hasCanonicalAssetConflict(state.assets, asset),
    ).length,
    openingPositionCount: state.openingPositions.length,
    ppfAccounts: ppfSummary.accounts,
    ppfConfirmedBalance: ppfSummary.confirmedBalance,
    ppfCount: state.ppfAccounts.length,
    rollupTotals,
    tradeCount: state.trades.length,
  };
}
