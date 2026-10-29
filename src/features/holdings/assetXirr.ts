import { formatLocalCalendarDate } from "@/src/domain/dates";
import { buildAssetXirrInput } from "@/src/domain/xirrInputs";
import { summariseXirr } from "@/src/domain/xirrSummary";
import type { PortfolioStoreState } from "@/src/store";

type XirrState = Pick<PortfolioStoreState, "assets" | "distributionCoverage" | "distributions" | "openingPositions" | "quoteCache" | "trades">;

/** Per-asset XIRR measured to today, from the stored records only. */
export function assetXirrSummary(state: XirrState, assetId: string, now: Date) {
  return summariseXirr(buildAssetXirrInput({
    asset: state.assets.find((asset) => asset.id === assetId),
    assetId,
    assets: state.assets,
    trades: state.trades,
    openingPositions: state.openingPositions,
    quote: state.quoteCache[assetId],
    distributions: state.distributions,
    coverage: state.distributionCoverage.find((item) => item.assetId === assetId),
    endDate: formatLocalCalendarDate(now),
  }));
}
