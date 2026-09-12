import type { Asset, OpeningPosition, Trade } from "@/src/types";
import { formatLocalCalendarDate, getCalendarDatePart } from "./dates";
import { decimal } from "./precision";
import { getOpeningPositionHistoryDate, isTransactionAfterOpeningCutover } from "./openingPositions";
import { matchesOpeningPosition, reconcileTransactions } from "./transactionReconciliation";
import { StockSplitError } from "./stockSplits";
import type { DemergerAdjustment } from "./demergerEvents";

export const demergerCatalog = [{
  id: "RELIANCE-JIOFIN-2023-v1", parentIsin: "INE002A01018", childIsin: "INE758E01017",
  exDate: "2023-07-20", availableFrom: "2023-08-21", childFraction: "0.0468",
  childSymbol: "JIOFIN", childName: "Jio Financial Services Limited",
  evidenceUrl: "https://rilstaticasset.akamaized.net/sites/default/files/2023-08/SEIntimation_ApportionmentofCost_0.pdf",
}, {
  id: "TATAMOTORS-TMCV-2025-v1", parentIsin: "INE155A01022", childIsin: "INE1TAE01010",
  exDate: "2025-10-14", availableFrom: "2025-11-12", childFraction: "0.3115",
  childSymbol: "TMCV", childName: "Tata Motors Limited",
  evidenceUrl: "https://nsearchives.nseindia.com/corporate/TATAMOTORSSJS_12112025224654_NSEBSECOAFINAL.pdf",
}] as const;

export type DemergerPortfolio = { assets: Asset[]; openingPositions: OpeningPosition[]; trades: Trade[] };
function fail(id: string, message: string): never { throw new StockSplitError(id, message); }

function eligibleSource(portfolio: DemergerPortfolio, parent: Asset, event: typeof demergerCatalog[number]) {
  const parentOpenings = portfolio.openingPositions.filter((item) => item.assetId === parent.id);
  if (parentOpenings.some((item) => !item.measuredAsOf)) fail(event.id, "Confirm the parent opening balance measurement date before applying a demerger.");
  const eligibleOpenings = parentOpenings.filter((item) => item.measuredAsOf! < event.exDate);
  if (eligibleOpenings.length > 1) fail(event.id, "Multiple parent opening balances need reconciliation before the demerger.");
  const eligibleTrades = portfolio.trades.filter((trade) => trade.assetId === parent.id &&
    (getCalendarDatePart(trade.date) ?? "") < event.exDate && isTransactionAfterOpeningCutover(trade.date, eligibleOpenings));
  if (!eligibleOpenings.length && !eligibleTrades.length) {
    fail(event.id, "A current parent balance cannot establish historical demerger eligibility. Import its earlier history first.");
  }
  const source = reconcileTransactions({ openingPosition: eligibleOpenings[0],
    openingMeasuredAsOf: eligibleOpenings[0]?.measuredAsOf, transactions: eligibleTrades,
    stockSplits: parent.stockSplits?.filter((item) => item.effectiveDate < event.exDate), through: event.exDate });
  if (!source.isExact || !Number.isSafeInteger(source.quantity) || source.totalCost === undefined) fail(event.id, "Parent quantity or acquisition cost is unresolved at the demerger date.");
  return { parentOpenings, eligibleOpenings, eligibleTrades, source };
}

/** Validate the complete graph before emitting either side of an allocation. */
export function projectDemergers(portfolio: DemergerPortfolio, through = formatLocalCalendarDate(new Date())) {
  const result: DemergerAdjustment[] = [];
  const children = new Set<string>();
  const eventIds = new Set<string>();
  for (const parent of portfolio.assets) {
    if (!parent.demerger) continue;
    const link = parent.demerger;
    const event = demergerCatalog.find((item) => item.id === link.eventId);
    const child = portfolio.assets.find((item) => item.id === link.childAssetId);
    if (Object.keys(link).length !== 2 || !event || !child || child.id === parent.id ||
        eventIds.has(link.eventId) || children.has(child.id) || child.demerger ||
        parent.isin !== event.parentIsin || child.isin !== event.childIsin ||
        parent.currency !== "INR" || child.currency !== "INR" ||
        parent.assetClass !== "stock" || child.assetClass !== "stock" ||
        portfolio.assets.filter((item) => item.isin === event.childIsin).length !== 1 ||
        portfolio.assets.filter((item) => item.isin === event.parentIsin).length !== 1) {
      fail(link.eventId, "The demerger's linked holdings or verified identity are incomplete or conflicting.");
    }
    eventIds.add(event.id); children.add(child.id);
    const childListings = [`${event.childSymbol}.NS`, `${event.childSymbol}.BO`];
    if ((child.symbol && child.symbol !== event.childSymbol && !childListings.includes(child.symbol)) ||
        (child.ticker && !childListings.includes(child.ticker)) ||
        (child.quoteSourceId && !childListings.includes(child.quoteSourceId))) {
      fail(event.id, "The successor quote listing does not match its verified identity.");
    }
    if (parent.stockSplits?.some((item) => item.effectiveDate === event.exDate)) {
      fail(event.id, "Same-day share adjustments require verified ordering before applying the demerger.");
    }
    const childOpenings = portfolio.openingPositions.filter((item) => item.assetId === child.id);
    if (childOpenings.some((item) => !item.measuredAsOf || item.measuredAsOf < event.exDate)) {
      fail(event.id, "Confirm the successor opening balance after the demerger before reconstructing history.");
    }
    if (portfolio.trades.some((trade) => trade.assetId === child.id &&
        (getCalendarDatePart(trade.date) ?? "") < event.availableFrom)) {
      fail(event.id, "Successor activity before its verified listing date needs reconciliation.");
    }
    if (event.exDate > through) continue;
    const { parentOpenings, eligibleOpenings, eligibleTrades, source } = eligibleSource(portfolio, parent, event);
    if (source.quantity <= 0 || !decimal(source.totalCost!).isPositive()) fail(event.id, "The linked demerger has no eligible parent position or cost.");
    const cost = decimal(source.totalCost!);
    const childCost = cost.times(event.childFraction);
    const retainedFraction = decimal(1).minus(event.childFraction).toString();
    if (cost.isNegative() || !cost.minus(childCost).plus(childCost).equals(cost)) fail(event.id, "Demerged cost allocation does not conserve the original cost.");
    result.push({ eventId: event.id, assetId: parent.id, date: event.exDate, kind: "retainedCost", retainedFraction });
    result.push({ eventId: event.id, assetId: child.id, date: event.exDate, kind: "entitlement",
      quantity: source.quantity, cost: childCost.toString(), sourceAssetId: parent.id,
      sourceRecordIds: [...eligibleOpenings, ...eligibleTrades].map((item) => item.id),
      firstAcquisitionDate: [...eligibleOpenings.map(getOpeningPositionHistoryDate), ...eligibleTrades.filter((item) => item.type === "buy" || item.type === "transferIn").map((item) => getCalendarDatePart(item.date))].filter((date): date is string => date !== null).sort()[0] ?? null });
    for (const position of [...parentOpenings, ...childOpenings].filter((item) => item.measuredAsOf! >= event.exDate)) {
      const isParent = position.assetId === parent.id;
      const sourceOpening = isParent ? eligibleOpenings[0] : undefined;
      const replay = reconcileTransactions({
        openingPosition: sourceOpening,
        openingMeasuredAsOf: sourceOpening?.measuredAsOf,
        transactions: portfolio.trades.filter((trade) => trade.assetId === position.assetId &&
          (getCalendarDatePart(trade.date) ?? "") <= position.measuredAsOf! &&
          isTransactionAfterOpeningCutover(trade.date, sourceOpening ? [sourceOpening] : [])),
        stockSplits: (isParent ? parent : child).stockSplits,
        demergerAdjustments: result.filter((item) => item.assetId === position.assetId),
        through: position.measuredAsOf,
      });
      if (!matchesOpeningPosition(replay, position)) {
        fail(event.id, "The measured opening balance does not reconcile with its demerger history. Reconcile both holdings before linking them.");
      }
    }
  }
  return result;
}

/** Import proposal only: a known successor is not evidence for an unknown parent. */
export function proposeDemergers(portfolio: DemergerPortfolio, eligibleParentIds: Set<string>, through: string) {
  let assets = [...portfolio.assets];
  for (const original of portfolio.assets) {
    if (!eligibleParentIds.has(original.id) || original.demerger) continue;
    const event = demergerCatalog.find((item) => item.parentIsin === original.isin && item.exDate <= through);
    if (!event || (!portfolio.trades.some((trade) => trade.assetId === original.id && (getCalendarDatePart(trade.date) ?? "") < event.exDate) &&
        !portfolio.openingPositions.some((position) => position.assetId === original.id && position.measuredAsOf && position.measuredAsOf < event.exDate))) continue;
    if (eligibleSource(portfolio, original, event).source.quantity === 0) continue;
    const existing = assets.filter((asset) => asset.isin === event.childIsin);
    if (existing.length > 1) fail(event.id, "Multiple successor holdings need reconciliation before importing a demerger.");
    const child: Asset = existing[0] ?? { id: `yahoo:${event.childSymbol}.NS`, name: event.childName,
      isin: event.childIsin, symbol: event.childSymbol, ticker: `${event.childSymbol}.NS`, quoteSourceId: `${event.childSymbol}.NS`,
      currency: "INR", exchange: "NSE", assetClass: "stock", instrumentType: "stock", sectorType: "other" };
    if (!existing.length && assets.some((asset) => asset.id === child.id)) fail(event.id, "The successor listing conflicts with an existing holding identity.");
    if (!existing.length) assets.push(child);
    assets = assets.map((asset) => asset.id === original.id ? { ...asset, demerger: { eventId: event.id, childAssetId: child.id } } : asset);
  }
  return assets;
}
