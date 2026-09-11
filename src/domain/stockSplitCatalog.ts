import type { Asset, StockSplitEvent, Trade } from "@/src/types";
import { getCalendarDatePart } from "./dates";
import { StockSplitError } from "./stockSplits";

// Bounded reviewed coverage. Do not promote provider adjustment factors to events.
export const stockSplitCatalog: readonly StockSplitEvent[] = [{
  id: "IRCTC-2021-10-28-split-v1",
  kind: "split",
  effectiveDate: "2021-10-28",
  oldIsin: "INE335Y01012",
  newIsin: "INE335Y01020",
  newShares: 5,
  oldShares: 1,
  evidence: {
    url: "https://www.steelcitynettrade.com/Circulars/Face%20Value%20Split%20%E2%80%93%20IRCTC.pdf",
    publishedDate: "2021-10-11",
    verifiedDate: "2026-09-11",
  },
}];

export function splitCanonicalIsin(isin?: string) {
  const normalized = isin?.trim().toUpperCase();
  return stockSplitCatalog.find((event) => event.oldIsin === normalized)?.newIsin ?? normalized;
}

export function assertCatalogSplits(asset: Asset) {
  if (asset.stockSplits !== undefined && !Array.isArray(asset.stockSplits)) {
    throw new StockSplitError("container", "Stock-split records must be an array.");
  }
  const ids = new Set<string>();
  for (const event of asset.stockSplits ?? []) {
    const known = stockSplitCatalog.find((item) => item.id === event.id);
    const exactKeys = (value: object, keys: string[]) =>
      Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
    if (!event || !event.evidence ||
        !exactKeys(event, ["id", "kind", "effectiveDate", "oldIsin", "newIsin", "newShares", "oldShares", "evidence"]) ||
        !exactKeys(event.evidence, ["url", "publishedDate", "verifiedDate"]) ||
        ids.has(event.id) || !known || asset.assetClass !== "stock" || asset.currency !== "INR" ||
        splitCanonicalIsin(asset.isin) !== known.newIsin ||
        event.kind !== known.kind || event.effectiveDate !== known.effectiveDate ||
        event.oldIsin !== known.oldIsin || event.newIsin !== known.newIsin ||
        event.newShares !== known.newShares || event.oldShares !== known.oldShares ||
        event.evidence.url !== known.evidence.url || event.evidence.publishedDate !== known.evidence.publishedDate ||
        event.evidence.verifiedDate !== known.evidence.verifiedDate) {
      throw new StockSplitError(event.id, "Stock-split evidence differs from the verified catalog.");
    }
    ids.add(event.id);
  }
}

export function assertSplitSourceIdentities(asset: Asset, trades: Trade[]) {
  for (const trade of trades) {
    if (trade.assetId !== asset.id) continue;
    const isin = trade.importProvenance?.sourceIsin;
    if (isin === undefined) continue;
    if (typeof isin !== "string" || !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
      throw new StockSplitError("source", "The original transaction ISIN is invalid.");
    }
    for (const event of asset.stockSplits ?? []) {
      const date = getCalendarDatePart(trade.date);
      if (!date || isin !== (date < event.effectiveDate ? event.oldIsin : event.newIsin)) {
        throw new StockSplitError(event.id, "The original transaction identity conflicts with the stock-split date.");
      }
    }
  }
}

export function withVerifiedStockSplits(asset: Asset): Asset {
  assertCatalogSplits(asset);
  if (asset.assetClass !== "stock" || asset.currency !== "INR") return asset;
  const isin = splitCanonicalIsin(asset.isin);
  const events = stockSplitCatalog.filter((event) => event.newIsin === isin);
  if (!events.length) return asset;
  return { ...asset, isin, stockSplits: events.map((event) => ({ ...event, evidence: { ...event.evidence } })) };
}
