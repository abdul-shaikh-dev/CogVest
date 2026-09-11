import type { Asset, StockSplitEvent, Trade } from "@/src/types";
import { getCalendarDatePart } from "./dates";
import { orderedStockSplits, StockSplitError } from "./stockSplits";

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
}, {
  id: "EASEMYTRIP-2022-11-21-split-v1", kind: "split", effectiveDate: "2022-11-21", sequence: 0,
  oldIsin: "INE07O001018", newIsin: "INE07O001026", newShares: 2, oldShares: 1,
  evidence: { url: "https://archives.nseindia.com/content/circulars/CML54479.pdf", publishedDate: "2022-11-17", verifiedDate: "2026-09-12" },
}];

export const bonusShareCatalog: readonly StockSplitEvent[] = [{
  id: "BERGEPAINT-2023-09-22-bonus-v1",
  kind: "bonus",
  effectiveDate: "2023-09-22",
  creditedDate: "2023-10-05",
  oldIsin: "INE463A01038",
  newIsin: "INE463A01038",
  newShares: 1,
  oldShares: 5,
  evidence: {
    url: "https://nsearchives.nseindia.com/content/circulars/CMPT58398.pdf",
    publishedDate: "2023-09-14",
    verifiedDate: "2026-09-11",
  },
}, {
  id: "HDFCBANK-2025-08-26-bonus-v1", kind: "bonus", effectiveDate: "2025-08-26", availableFrom: "2025-08-29",
  oldIsin: "INE040A01034", newIsin: "INE040A01034", newShares: 1, oldShares: 1,
  evidence: { url: "https://nsearchives.nseindia.com/content/circulars/CML69791.pdf", publishedDate: "2025-08-22", verifiedDate: "2026-09-12" },
}, {
  id: "RELIANCE-2024-10-28-bonus-v1", kind: "bonus", effectiveDate: "2024-10-28", availableFrom: "2024-11-01",
  oldIsin: "INE002A01018", newIsin: "INE002A01018", newShares: 1, oldShares: 1,
  evidence: { url: "https://nsearchives.nseindia.com/content/circulars/CML64862.pdf", publishedDate: "2024-10-31", verifiedDate: "2026-09-12" },
}, {
  id: "EASEMYTRIP-2022-11-21-bonus-v1", kind: "bonus", effectiveDate: "2022-11-21", sequence: 1,
  availableFrom: "2022-12-31",
  oldIsin: "INE07O001026", newIsin: "INE07O001026", newShares: 3, oldShares: 1,
  evidence: { url: "https://www.easemytrip.com/investor-pdf/2022/Reconciliation-of-Share-Capital-Audit-December-Quarter.pdf", publishedDate: "2023-01-10", verifiedDate: "2026-09-12" },
}, {
  id: "EASEMYTRIP-2024-11-29-bonus-v1", kind: "bonus", effectiveDate: "2024-11-29", availableFrom: "2024-12-03",
  oldIsin: "INE07O001026", newIsin: "INE07O001026", newShares: 1, oldShares: 1,
  evidence: { url: "https://nsearchives.nseindia.com/content/circulars/CML65294.pdf", publishedDate: "2024-11-28", verifiedDate: "2026-09-12" },
}];
const shareAdjustmentCatalog = [...stockSplitCatalog, ...bonusShareCatalog];

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
    const known = shareAdjustmentCatalog.find((item) => item.id === event?.id);
    const exactKeys = (value: object, keys: string[]) =>
      Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
    if (!event || !event.evidence ||
        !exactKeys(event, ["id", "kind", "effectiveDate", "oldIsin", "newIsin", "newShares", "oldShares", "evidence",
          ...(known?.creditedDate ? ["creditedDate"] : []), ...(known?.availableFrom ? ["availableFrom"] : []), ...(known?.sequence !== undefined ? ["sequence"] : [])]) ||
        !exactKeys(event.evidence, ["url", "publishedDate", "verifiedDate"]) ||
        ids.has(event.id) || !known || asset.assetClass !== "stock" || asset.currency !== "INR" ||
        splitCanonicalIsin(asset.isin) !== splitCanonicalIsin(known.newIsin) ||
        event.kind !== known.kind || event.effectiveDate !== known.effectiveDate ||
        event.creditedDate !== known.creditedDate ||
        event.availableFrom !== known.availableFrom || event.sequence !== known.sequence ||
        event.oldIsin !== known.oldIsin || event.newIsin !== known.newIsin ||
        event.newShares !== known.newShares || event.oldShares !== known.oldShares ||
        event.evidence.url !== known.evidence.url || event.evidence.publishedDate !== known.evidence.publishedDate ||
        event.evidence.verifiedDate !== known.evidence.verifiedDate) {
      throw new StockSplitError(event?.id ?? "invalid", "Share-adjustment evidence differs from the verified catalog.");
    }
    ids.add(event.id);
  }
  orderedStockSplits(asset.stockSplits ?? []);
  for (const event of asset.stockSplits ?? []) {
    const peers = shareAdjustmentCatalog.filter((item) =>
      splitCanonicalIsin(item.newIsin) === splitCanonicalIsin(event.newIsin));
    if (peers.some((peer) => !ids.has(peer.id))) throw new StockSplitError(event.id, "The verified event chain is incomplete.");
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
    const events = orderedStockSplits(asset.stockSplits ?? []);
    const date = getCalendarDatePart(trade.date);
    const splits = events.filter((event) => event.kind === "split");
    const expected = splits.filter((event) => date && event.effectiveDate <= date).at(-1)?.newIsin ?? splits[0]?.oldIsin ?? events[0]?.oldIsin;
    if (events.length && (!date || isin !== expected)) {
      throw new StockSplitError(events[0].id, "The original transaction identity conflicts with the stock-split date.");
    }
  }
}

export function withVerifiedStockSplits(asset: Asset): Asset {
  assertCatalogSplits(asset);
  if (asset.assetClass !== "stock" || asset.currency !== "INR") return asset;
  const isin = splitCanonicalIsin(asset.isin);
  const events = shareAdjustmentCatalog.filter((event) => splitCanonicalIsin(event.newIsin) === isin);
  if (!events.length) return asset;
  return { ...asset, isin, stockSplits: orderedStockSplits(events).map((event) => ({ ...event, evidence: { ...event.evidence } })) };
}
