import { hasCanonicalAssetConflict } from "@/src/domain/assets";
import { calculateHoldings } from "@/src/domain/calculations";
import type { PortfolioStoreState } from "@/src/store";

export type E2eAssetEvidence = {
  asset: PortfolioStoreState["assets"][number];
  holding?: ReturnType<typeof calculateHoldings>[number];
  key: string;
  openingPositions: PortfolioStoreState["openingPositions"];
  quote?: PortfolioStoreState["quoteCache"][string];
};

export type E2ePortfolioEvidence = {
  assets: E2eAssetEvidence[];
  assetCount: number;
  duplicateIdentityCount: number;
  openingPositionCount: number;
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
): E2ePortfolioEvidence {
  const holdings = calculateHoldings({
    assets: state.assets,
    openingPositions: state.openingPositions,
    quoteCache: state.quoteCache,
    trades: state.trades,
  });

  return {
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
    tradeCount: state.trades.length,
  };
}
