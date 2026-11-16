import type { DemergerAdjustment } from "@/src/domain/demergerEvents";
import { projectDemergers } from "@/src/domain/demergers";
import { isTransactionAfterOpeningCutover } from "@/src/domain/openingPositions";
import { normalizeQuantity } from "@/src/domain/precision";
import { positionQuantity, StockSplitError } from "@/src/domain/stockSplits";
import type { Asset, OpeningPosition, Trade } from "@/src/types";

function groupByAsset<Item extends { assetId: string }>(items: readonly Item[]) {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const group = groups.get(item.assetId);
    if (group) group.push(item);
    else groups.set(item.assetId, [item]);
  }
  return groups;
}

/**
 * Remaining units for every asset, worked out once per record change rather
 * than per asset and per search keystroke (#664). Null when a stock split
 * leaves the quantity unknown.
 */
export function remainingUnitsByAsset(
  state: { assets: readonly Asset[]; openingPositions: readonly OpeningPosition[]; trades: readonly Trade[] },
) {
  const demergerAdjustments = groupByAsset(projectDemergers({
    assets: state.assets,
    openingPositions: state.openingPositions,
    trades: state.trades,
  }));
  const openingsByAsset = groupByAsset<OpeningPosition>(state.openingPositions);
  const tradesByAsset = groupByAsset<Trade>(state.trades);
  return new Map(state.assets.map((asset) => [asset.id, remainingUnits(
    asset,
    openingsByAsset.get(asset.id) ?? [],
    tradesByAsset.get(asset.id) ?? [],
    demergerAdjustments.get(asset.id) ?? [],
  )]));
}

export function remainingUnits(
  asset: Asset,
  assetOpenings: OpeningPosition[],
  assetTrades: readonly Trade[],
  demergerAdjustments: readonly DemergerAdjustment[],
) {
  const trades = assetTrades.filter((trade) =>
    isTransactionAfterOpeningCutover(trade.date, assetOpenings));

  try {
    return normalizeQuantity(positionQuantity({
      openingPositions: assetOpenings,
      trades,
      stockSplits: asset.stockSplits,
      demergerAdjustments,
    }));
  } catch (error) {
    if (!(error instanceof StockSplitError)) throw error;
    return null;
  }
}
