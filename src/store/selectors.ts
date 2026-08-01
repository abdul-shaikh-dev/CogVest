import type {
  Asset,
  CashEntry,
  OpeningPosition,
  QuoteCache,
  Trade,
} from "@/src/types";
import { isEffectiveCalendarDate } from "@/src/domain/dates";
import { decimal, normalizeMoney } from "@/src/domain/precision";

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

export function selectCashBalance(cashEntries: CashEntry[], now = new Date()) {
  const balance = cashEntries
    .filter((entry) => isEffectiveCalendarDate(entry.date, now))
    .reduce(
      (total, entry) =>
        entry.type === "withdrawal"
          ? total.minus(entry.amount)
          : total.plus(entry.amount),
      decimal(0),
    );

  return normalizeMoney(balance);
}

export function selectQuoteForAsset(quoteCache: QuoteCache, assetId: string) {
  return quoteCache[assetId] ?? null;
}
