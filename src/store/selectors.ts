import type {
  Asset,
  CashEntry,
  OpeningPosition,
  QuoteCache,
  Trade,
} from "@/src/types";

export function selectAssetById(assets: Asset[], assetId: string) {
  return assets.find((asset) => asset.id === assetId) ?? null;
}

export function selectTradesForAsset(trades: Trade[], assetId: string) {
  return trades.filter((trade) => trade.assetId === assetId);
}

export function selectOpeningPositionsForAsset(
  openingPositions: OpeningPosition[],
  assetId: string,
) {
  return openingPositions.filter((position) => position.assetId === assetId);
}

export function selectCashBalance(cashEntries: CashEntry[]) {
  return cashEntries.reduce((balance, entry) => {
    if (entry.type === "withdrawal") {
      return balance - entry.amount;
    }

    return balance + entry.amount;
  }, 0);
}

export function selectQuoteForAsset(quoteCache: QuoteCache, assetId: string) {
  return quoteCache[assetId] ?? null;
}
