import { positionEvents, splitQuantity } from "@/src/domain/stockSplits";
import { projectDemergers } from "@/src/domain/demergers";
import type { DemergerAdjustment } from "@/src/domain/demergerEvents";
import { assertCatalogSplits, assertSplitSourceIdentities } from "@/src/domain/stockSplitCatalog";
import { normalizeTrade } from "@/src/domain/financialRecords";
import {
  formatLocalCalendarDate,
  getCalendarDatePart,
  isFutureCalendarDate,
} from "@/src/domain/dates";
import {
  getOpeningPositionHistoryDate,
  isTransactionAfterOpeningCutover,
} from "@/src/domain/openingPositions";
import { getV1AssetCurrencyIssue } from "@/src/domain/portfolioCurrency";
import {
  decimal,
  isAtOrBeyondNegativeQuantum,
  isWithinQuantum,
  moneyQuantum,
  normalizeQuantity,
  quantityQuantum,
} from "@/src/domain/precision";
import {
  getTradeQuantityDelta,
  isManualTrade,
  isTradeAcquisition,
} from "@/src/domain/transactionSemantics";
import { reconcileTransactions } from "@/src/domain/transactionReconciliation";
import type {
  Asset,
  BuyTrade,
  CashEntry,
  ImportedTransactionProvenance,
  OpeningPosition,
  SellTrade,
  Trade,
} from "@/src/types";

import type {
  LinkedTradeCommandInput,
  LinkedTradeCommandResult,
  PortfolioStoreState,
  RawPortfolioSnapshot,
  TradeCorrectionInput,
  TradeDeletionImpact,
  TradeDeletionPreview,
} from "./storeTypes";

export function tradeMonth(trade: Trade) {
  return getCalendarDatePart(trade.date)?.slice(0, 7) ?? null;
}

export function isValidTradeRecord(trade: Trade, now: Date) {
  if (
    trade.assetId.trim().length === 0 ||
    trade.id.trim().length === 0 ||
    !Number.isFinite(trade.quantity) ||
    trade.quantity <= 0 ||
    !getCalendarDatePart(trade.date) ||
    isFutureCalendarDate(trade.date, now) ||
    (trade.conviction !== undefined &&
      (!Number.isInteger(trade.conviction) ||
        trade.conviction < 1 ||
        trade.conviction > 5)) ||
    (trade.intendedHoldDays !== undefined &&
      (!Number.isInteger(trade.intendedHoldDays) ||
        trade.intendedHoldDays <= 0))
  ) {
    return false;
  }

  if (trade.type === "transferOut") return true;
  if (trade.type === "transferIn") {
    return (
      trade.acquisitionCostPerUnit === undefined ||
      (Number.isFinite(trade.acquisitionCostPerUnit) &&
        trade.acquisitionCostPerUnit >= 0)
    );
  }

  const fees = trade.fees ?? 0;
  if (
    !Number.isFinite(trade.pricePerUnit) ||
    trade.pricePerUnit <= 0 ||
    !Number.isFinite(fees) ||
    fees < 0 ||
    !Number.isFinite(trade.totalValue) ||
    trade.totalValue <= 0
  ) {
    return false;
  }
  const grossValue = decimal(trade.quantity).times(trade.pricePerUnit);
  const expectedTotal =
    trade.type === "buy" ? grossValue.plus(fees) : grossValue.minus(fees);

  return isWithinQuantum(trade.totalValue, expectedTotal, moneyQuantum);
}

export function isValidImportProvenance(
  provenance: ImportedTransactionProvenance,
  commandId: string,
) {
  return (
    provenance.importBatchId === commandId &&
    provenance.importBatchId.trim().length > 0 &&
    provenance.sourceFormat.trim().length > 0 &&
    provenance.sourceVersion.trim().length > 0 &&
    Number.isInteger(provenance.originalRowNumber) &&
    provenance.originalRowNumber > 0 &&
    Boolean(provenance.fingerprint?.trim()) &&
    (provenance.externalId === undefined ||
      provenance.externalId.trim().length > 0) &&
    (provenance.settlementDate === undefined ||
      getCalendarDatePart(provenance.settlementDate) ===
        provenance.settlementDate) &&
    (provenance.sourceExchange === undefined ||
      provenance.sourceExchange.trim().length > 0) &&
    (provenance.sourceExecutedAt === undefined ||
      provenance.sourceExecutedAt.trim().length > 0) &&
    (provenance.sourceFileIndex === undefined ||
      (Number.isInteger(provenance.sourceFileIndex) &&
        provenance.sourceFileIndex >= 0)) &&
    (provenance.sourceFileName === undefined ||
      provenance.sourceFileName.trim().length > 0) &&
    (provenance.sourceOrderId === undefined ||
      provenance.sourceOrderId.trim().length > 0) &&
    (provenance.sourceSegment === undefined ||
      provenance.sourceSegment.trim().length > 0) &&
    (provenance.sourceSymbol === undefined ||
      provenance.sourceSymbol.trim().length > 0) &&
    (provenance.fees === undefined ||
      (Number.isFinite(provenance.fees) && provenance.fees >= 0)) &&
    (provenance.taxes === undefined ||
      (Number.isFinite(provenance.taxes) && provenance.taxes >= 0))
  );
}

export function transactionImportIdentity(trade: Trade) {
  return JSON.stringify({
    acquisitionCostPerUnit:
      trade.type === "transferIn" ? trade.acquisitionCostPerUnit ?? null : null,
    account: trade.importProvenance?.account?.trim().toUpperCase() ?? null,
    assetId: trade.assetId,
    date: trade.date,
    externalId:
      trade.importProvenance?.externalId?.trim().toUpperCase() ?? null,
    fingerprint: trade.importProvenance?.fingerprint ?? null,
    fees: trade.importProvenance?.fees ?? null,
    notes: trade.notes ?? null,
    originalDescription:
      trade.importProvenance?.originalDescription ?? null,
    pricePerUnit:
      trade.type === "buy" || trade.type === "sell"
        ? trade.pricePerUnit
        : null,
    quantity: trade.quantity,
    settlementDate: trade.importProvenance?.settlementDate ?? null,
    sourceExchange: trade.importProvenance?.sourceExchange ?? null,
    sourceExecutedAt: trade.importProvenance?.sourceExecutedAt ?? null,
    sourceFileIndex: trade.importProvenance?.sourceFileIndex ?? null,
    sourceFileName: trade.importProvenance?.sourceFileName ?? null,
    sourceFormat: trade.importProvenance?.sourceFormat ?? null,
    sourceOrderId: trade.importProvenance?.sourceOrderId ?? null,
    sourceSegment: trade.importProvenance?.sourceSegment ?? null,
    sourceSymbol: trade.importProvenance?.sourceSymbol ?? null,
    sourceVersion: trade.importProvenance?.sourceVersion ?? null,
    taxes: trade.importProvenance?.taxes ?? null,
    type: trade.type,
  });
}

export function deriveTrade(input: TradeCorrectionInput): BuyTrade | SellTrade {
  return normalizeTrade({
    ...input,
    totalValue: 0,
  });
}

export function hasNonnegativeCashTimeline(cashEntries: CashEntry[]) {
  const orderedEntries = [...cashEntries].sort((left, right) => {
    const dateOrder = (getCalendarDatePart(left.date) ?? left.date)
      .localeCompare(getCalendarDatePart(right.date) ?? right.date);
    if (dateOrder !== 0) return dateOrder;
    if (left.type !== right.type) return left.type === "addition" ? -1 : 1;
    return left.id.localeCompare(right.id);
  });
  let balance = decimal(0);

  for (const entry of orderedEntries) {
    balance =
      entry.type === "addition"
        ? balance.plus(entry.amount)
        : balance.minus(entry.amount);
    if (isAtOrBeyondNegativeQuantum(balance, moneyQuantum)) return false;
  }

  return true;
}

export type QuantityEvent = {
  split?: import("@/src/types").StockSplitEvent;
  date: string;
  delta: number;
  id: string;
  importBatchId?: string;
  originalRowNumber?: number;
  priority: number;
};

export function validateSplitInventory(
  portfolio: Pick<RawPortfolioSnapshot, "assets" | "openingPositions" | "trades">,
) {
  const adjustments = projectDemergers(portfolio);
  for (const asset of portfolio.assets) {
    assertCatalogSplits(asset);
    assertSplitSourceIdentities(asset, portfolio.trades);
    const demergerAdjustments = adjustments.filter((event) => event.assetId === asset.id);
    if (demergerAdjustments.length) {
      const openings = portfolio.openingPositions.filter((item) => item.assetId === asset.id);
      if (openings.length > 1 || !reconcileTransactions({ openingPosition: openings[0], openingMeasuredAsOf: openings[0]?.measuredAsOf,
        transactions: portfolio.trades.filter((trade) => trade.assetId === asset.id && isTransactionAfterOpeningCutover(trade.date, openings)),
        stockSplits: asset.stockSplits, demergerAdjustments }).isExact) throw new Error("Demerged quantity or acquisition cost is unresolved.");
    }
    if ((asset.stockSplits?.length || adjustments.some((event) => event.assetId === asset.id)) && wouldOversellAsset(asset.id, portfolio.openingPositions, portfolio.trades, asset.stockSplits, adjustments.filter((event) => event.assetId === asset.id))) {
      throw new Error("Stock-split inventory does not reconcile.");
    }
  }
}

export function assetQuantityEvents(
  assetId: string,
  openingPositions: OpeningPosition[],
  trades: Trade[],
  stockSplits: import("@/src/types").StockSplitEvent[] = [],
  demergerAdjustments: DemergerAdjustment[] = [],
) {
  const assetOpenings = openingPositions.filter(
    (item) => item.assetId === assetId,
  );
  const events: QuantityEvent[] = [
    ...positionEvents({ openingPositions: assetOpenings, trades: trades.filter((trade) => trade.assetId === assetId), stockSplits, demergerAdjustments })
      .flatMap((event): QuantityEvent[] => event.type === "demerger"
        ? [{ date: event.date, delta: event.adjustment.kind === "entitlement" ? event.adjustment.quantity : 0, id: event.adjustment.eventId, priority: -2 }]
        : event.type === "split"
        ? [{ date: event.date, delta: 0, id: event.split.id, priority: -1, split: event.split }] : []),
    ...assetOpenings
      .map((position) => ({
        date: getOpeningPositionHistoryDate(position) ?? "",
        delta: position.quantity,
        id: position.id,
        importBatchId: undefined as string | undefined,
        originalRowNumber: undefined as number | undefined,
        priority: 0,
      })),
    ...trades
      .filter(
        (item) =>
          item.assetId === assetId &&
          isTransactionAfterOpeningCutover(item.date, assetOpenings),
      )
      .map((trade) => ({
        date: getCalendarDatePart(trade.date) ?? "",
        delta: getTradeQuantityDelta(trade),
        id: trade.id,
        importBatchId: trade.importProvenance?.importBatchId,
        originalRowNumber: trade.importProvenance?.originalRowNumber,
        priority: isTradeAcquisition(trade) ? 1 : 2,
      })),
  ].filter((event) => event.date);

  events.sort(
    (left, right) => {
      const dateOrder = left.date.localeCompare(right.date);
      if (dateOrder !== 0) return dateOrder;
      if (left.split && right.split) return (left.split.sequence ?? 0) - (right.split.sequence ?? 0);
      if (
        left.importBatchId &&
        left.importBatchId === right.importBatchId &&
        left.originalRowNumber !== undefined &&
        right.originalRowNumber !== undefined
      ) {
        return left.originalRowNumber - right.originalRowNumber;
      }
      return left.priority - right.priority || left.id.localeCompare(right.id);
    },
  );

  return events;
}

/** Checks the complete dated inventory timeline, including measured cutovers. */
export function wouldOversellAsset(
  assetId: string,
  openingPositions: OpeningPosition[],
  trades: Trade[],
  stockSplits: import("@/src/types").StockSplitEvent[] = [],
  demergerAdjustments: DemergerAdjustment[] = [],
) {
  const events = assetQuantityEvents(assetId, openingPositions, trades, stockSplits, demergerAdjustments);
  let units = decimal(0);
  for (const event of events) {
    units = event.split ? splitQuantity(units, event.split) : units.plus(event.delta);
    if (isAtOrBeyondNegativeQuantum(units, quantityQuantum)) return true;
  }

  return false;
}

export function availableUnitsBeforeTrade(
  assetId: string,
  openingPositions: OpeningPosition[],
  trades: Trade[],
  tradeId: string,
  stockSplits: import("@/src/types").StockSplitEvent[] = [],
  demergerAdjustments: DemergerAdjustment[] = [],
) {
  let units = decimal(0);
  for (const event of assetQuantityEvents(assetId, openingPositions, trades, stockSplits, demergerAdjustments)) {
    if (event.id === tradeId) return normalizeQuantity(units);
    units = event.split ? splitQuantity(units, event.split) : units.plus(event.delta);
  }
  return normalizeQuantity(units);
}

export function linkedCashEntriesForTrade(state: PortfolioStoreState, tradeId: string) {
  return state.cashEntries.filter((entry) => entry.linkedTradeId === tradeId);
}

export function isConsistentTradeCashLink(trade: Trade, entry: CashEntry) {
  if (!isManualTrade(trade)) return false;
  return trade.type === "buy"
    ? entry.type === "withdrawal" && entry.purpose === "purchaseFunding"
    : entry.type === "addition" && entry.purpose === "saleProceeds";
}

export type PreparedTradeDeletion = {
  assets: Asset[];
  cashEntries: CashEntry[];
  impact: TradeDeletionImpact;
  linkedEntries: CashEntry[];
  status: "ready";
  trades: Trade[];
};

export function prepareTradeDeletion(
  state: PortfolioStoreState,
  tradeIds: string[],
  currentDate: Date,
): PreparedTradeDeletion | Extract<TradeDeletionPreview, { status: "rejected" }> {
  const selectedIds = new Set(tradeIds.filter((id) => id.trim().length > 0));
  if (selectedIds.size === 0) return { reason: "emptySelection", status: "rejected" };

  const selectedTrades = state.trades.filter((trade) => selectedIds.has(trade.id));
  if (selectedTrades.length !== selectedIds.size) return { reason: "notFound", status: "rejected" };
  if (state.distributions.some((item) => selectedIds.has(item.linkedTradeId ?? ""))) {
    return { reason: "linkedPayout", status: "rejected" };
  }

  const linkedEntries: CashEntry[] = [];
  for (const trade of selectedTrades) {
    const links = linkedCashEntriesForTrade(state, trade.id);
    if (links.length > 1 || (links[0] && !isConsistentTradeCashLink(trade, links[0]))) {
      return { reason: "inconsistentLink", status: "rejected" };
    }
    if (links[0]) linkedEntries.push(links[0]);
  }

  const trades = state.trades.filter((trade) => !selectedIds.has(trade.id));
  const linkedEntryIds = new Set(linkedEntries.map((entry) => entry.id));
  const cashEntries = state.cashEntries.filter((entry) => !linkedEntryIds.has(entry.id));
  if (!hasNonnegativeCashTimeline(cashEntries)) {
    return { reason: "insufficientCash", status: "rejected" };
  }

  let assets = state.assets;
  const detachedParentIds = new Set<string>();
  const corporateActionAffectedAssetIds = new Set<string>();
  try {
    const through = formatLocalCalendarDate(currentDate);
    const currentAdjustments = projectDemergers(state, through);
    for (const parent of state.assets.filter((asset) => asset.demerger)) {
      const entitlement = currentAdjustments.find(
        (adjustment): adjustment is Extract<DemergerAdjustment, { kind: "entitlement" }> =>
          adjustment.eventId === parent.demerger!.eventId &&
          adjustment.kind === "entitlement",
      );
      if (!entitlement || !entitlement.sourceRecordIds.some((id) => selectedIds.has(id))) continue;

      const childId = parent.demerger!.childAssetId;
      corporateActionAffectedAssetIds.add(parent.id);
      corporateActionAffectedAssetIds.add(childId);
      if (!entitlement.sourceRecordIds.every((id) => selectedIds.has(id))) continue;
      const childStillHasRecords =
        state.openingPositions.some((position) => position.assetId === childId) ||
        trades.some((trade) => trade.assetId === childId);
      if (childStillHasRecords) continue;

      detachedParentIds.add(parent.id);
    }
    if (detachedParentIds.size > 0) {
      assets = state.assets.map((asset) => {
        if (!detachedParentIds.has(asset.id)) return asset;
        const { demerger: _demerger, ...withoutDemerger } = asset;
        return withoutDemerger;
      });
    }
  } catch {
    return { reason: "corporateActionDependency", status: "rejected" };
  }

  let adjustments: DemergerAdjustment[];
  try {
    adjustments = projectDemergers(
      { assets, openingPositions: state.openingPositions, trades },
      formatLocalCalendarDate(currentDate),
    );
  } catch {
    return { reason: "corporateActionDependency", status: "rejected" };
  }

  const blockingAssetIds = assets
    .filter((asset) => wouldOversellAsset(
      asset.id,
      state.openingPositions,
      trades,
      asset.stockSplits,
      adjustments.filter((event) => event.assetId === asset.id),
    ))
    .map((asset) => asset.id);
  if (blockingAssetIds.length > 0) {
    return { blockingAssetIds, reason: "oversold", status: "rejected" };
  }

  try {
    validateSplitInventory({ ...state, assets, trades });
  } catch {
    return { reason: "corporateActionDependency", status: "rejected" };
  }

  const earliestAffectedMonth = [...selectedTrades.map(tradeMonth), ...linkedEntries.map((entry) => getCalendarDatePart(entry.date)?.slice(0, 7) ?? null)]
    .filter((month): month is string => Boolean(month))
    .sort()[0];
  if (!earliestAffectedMonth) return { reason: "notFound", status: "rejected" };

  const affectedAssetIds = new Set(selectedTrades.map((trade) => trade.assetId));
  for (const assetId of corporateActionAffectedAssetIds) affectedAssetIds.add(assetId);
  for (const parentId of detachedParentIds) {
    affectedAssetIds.add(parentId);
    const childId = state.assets.find((asset) => asset.id === parentId)?.demerger?.childAssetId;
    if (childId) affectedAssetIds.add(childId);
  }

  return {
    assets,
    cashEntries,
    impact: {
      affectedHoldings: state.assets
        .filter((asset) => affectedAssetIds.has(asset.id))
        .map((asset) => ({
          assetId: asset.id,
          corporateActionRecalculated: corporateActionAffectedAssetIds.has(asset.id),
          linkedCashEntries: linkedEntries.filter((entry) => selectedTrades.some((trade) => trade.id === entry.linkedTradeId && trade.assetId === asset.id)).length,
          name: asset.name,
          transactions: selectedTrades.filter((trade) => trade.assetId === asset.id).length,
        })),
      automaticSnapshots: state.monthlySnapshots.filter((snapshot) => snapshot.month >= earliestAffectedMonth && snapshot.generated?.source === "auto").length,
      detachedDemergers: detachedParentIds.size,
      earliestAffectedMonth,
      importedTransactions: selectedTrades.filter((trade) => trade.importProvenance).length,
      linkedCashEntries: linkedEntries.length,
      transactions: selectedTrades.length,
    },
    linkedEntries,
    status: "ready",
    trades,
  };
}

export function linkedCashEntry(
  input: LinkedTradeCommandInput,
  purpose: "purchaseFunding" | "saleProceeds",
): CashEntry {
  return {
    amount: input.trade.totalValue,
    date: input.trade.date,
    id: `cash-${input.trade.id}`,
    label: input.cashLabel,
    linkedTradeId: input.trade.id,
    notes: input.cashNotes,
    purpose,
    type: purpose === "purchaseFunding" ? "withdrawal" : "addition",
  };
}

export function validateLinkedTrade(
  state: PortfolioStoreState,
  input: LinkedTradeCommandInput,
  trade: Trade,
  expectedType: "buy" | "sell",
  currentDate: Date,
): LinkedTradeCommandResult | null {
  if (!isManualTrade(trade) || trade.type !== expectedType) {
    return { isValid: false, reason: "invalidTradeType" };
  }

  const fees = trade.fees ?? 0;
  if (
    !isValidTradeRecord(trade, currentDate) ||
    !Number.isFinite(trade.quantity) ||
    trade.quantity <= 0 ||
    !Number.isFinite(trade.pricePerUnit) ||
    trade.pricePerUnit <= 0 ||
    !Number.isFinite(fees) ||
    fees < 0 ||
    !Number.isFinite(trade.totalValue) ||
    trade.totalValue <= 0
  ) {
    return { isValid: false, reason: "invalidTrade" };
  }

  const grossValue = decimal(trade.quantity).times(trade.pricePerUnit);
  const expectedTotal =
    trade.type === "buy" ? grossValue.plus(fees) : grossValue.minus(fees);
  const hasMatchingAsset =
    state.assets.some((asset) => asset.id === trade.assetId) ||
    input.asset?.id === trade.assetId;
  const tradeAsset =
    state.assets.find((asset) => asset.id === trade.assetId) ?? input.asset;
  const assetOpenings = state.openingPositions.filter(
    (position) => position.assetId === trade.assetId,
  );

  if (
    !hasMatchingAsset ||
    !tradeAsset ||
    !isTransactionAfterOpeningCutover(trade.date, assetOpenings) ||
    getV1AssetCurrencyIssue(tradeAsset) !== undefined ||
    input.cashLabel.trim().length === 0 ||
    !isWithinQuantum(trade.totalValue, expectedTotal, moneyQuantum)
  ) {
    return { isValid: false, reason: "invalidTrade" };
  }

  if (state.trades.some((currentTrade) => currentTrade.id === trade.id)) {
    return { isValid: false, reason: "duplicateTrade" };
  }

  return null;
}

