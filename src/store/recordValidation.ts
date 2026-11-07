import { assertCatalogSplits } from "@/src/domain/stockSplitCatalog";
import { hasCanonicalAssetConflict, isInstrumentType, isSectorType } from "@/src/domain/assets";
import {
  buildGeneratedMonthEndSnapshot,
  getMissingCompletedSnapshotMonths,
  getMonthlySnapshotPriceConfidence,
} from "@/src/domain/calculations";
import {
  formatLocalCalendarDate,
  getCalendarDatePart,
  isFutureCalendarDate,
} from "@/src/domain/dates";
import { getOpeningPositionHistoryDate } from "@/src/domain/openingPositions";
import { getV1AssetCurrencyIssue } from "@/src/domain/portfolioCurrency";
import { decimal, normalizeMoney } from "@/src/domain/precision";
import {
  calculatePpfConfirmedBalance,
  comparePpfLedgerEntries,
  validatePpfAccount,
  validatePpfLedgerEntryForAccount,
} from "@/src/domain/ppf";
import type {
  Asset,
  CashEntry,
  Currency,
  OpeningPosition,
  PpfAccount,
  PpfLedgerEntry,
  Trade,
} from "@/src/types";

import type { PortfolioStoreState } from "./storeTypes";
import { tradeMonth } from "./tradeRules";
import { compareCodeUnits } from "@/src/domain/ordering";

export function cashBalance(cashEntries: CashEntry[]) {
  const balance = cashEntries
    .reduce(
    (balance, entry) =>
      entry.type === "withdrawal"
          ? balance.minus(entry.amount)
          : balance.plus(entry.amount),
      decimal(0),
    );

  return normalizeMoney(balance);
}

export function isLinkedCashEntry(entry: CashEntry) {
  return (
    Boolean(entry.linkedTradeId) ||
    Boolean(entry.linkedFutures) ||
    Boolean(entry.linkedEpf) ||
    Boolean(entry.linkedDistributionId) ||
    Boolean(entry.linkedPpf) ||
    entry.purpose === "distribution" ||
    entry.purpose === "ppfTransfer" ||
    entry.purpose === "epfTransfer" ||
    entry.purpose === "futuresTransfer" ||
    entry.purpose === "purchaseFunding" ||
    entry.purpose === "saleProceeds"
  );
}

export function isValidManualCashEntry(entry: CashEntry, now = new Date()) {
  const hasValidType = entry.type === "addition" || entry.type === "withdrawal";
  const hasValidPurpose =
    entry.type === "withdrawal"
      ? entry.purpose === "withdrawal"
      : ["capitalContribution", "legacyUncategorized"].includes(
          entry.purpose,
        );

  return (
    !isLinkedCashEntry(entry) &&
    hasValidType &&
    Number.isFinite(entry.amount) &&
    entry.amount > 0 &&
    Boolean(getCalendarDatePart(entry.date)) &&
    !isFutureCalendarDate(entry.date, now) &&
    entry.label.trim().length > 0 &&
    hasValidPurpose
  );
}

export function sortPpfLedgerEntries(entries: readonly PpfLedgerEntry[]) {
  return [...entries].sort(comparePpfLedgerEntries);
}

export function isValidPpfTimeline(
  account: PpfAccount,
  entries: readonly PpfLedgerEntry[],
  currentDate: Date,
) {
  if (!validatePpfAccount(account, currentDate).isValid) return false;

  const ordered = sortPpfLedgerEntries(entries);
  for (let index = 0; index < ordered.length; index += 1) {
    const entry = ordered[index];
    if (
      !validatePpfLedgerEntryForAccount(account, entry, currentDate).isValid
    ) {
      return false;
    }

    const balance = calculatePpfConfirmedBalance(
      account,
      ordered.slice(0, index + 1),
      entry.date,
    ).confirmedBalance;
    if (balance < 0) return false;
  }

  return true;
}

export function isValidPpfLegacyLink(
  account: PpfAccount,
  state: Pick<PortfolioStoreState, "assets" | "ppfAccounts">,
) {
  if (account.legacyAssetId === undefined) return true;
  return (
    state.assets.some(
      (asset) =>
        asset.id === account.legacyAssetId && asset.instrumentType === "ppf",
    ) &&
    !state.ppfAccounts.some(
      (item) =>
        item.id !== account.id && item.legacyAssetId === account.legacyAssetId,
    )
  );
}

export function isValidOpeningPosition(
  openingPosition: OpeningPosition,
  now: Date,
  assetCurrency?: Currency,
) {
  const conviction = openingPosition.conviction;
  const intendedHoldDays = openingPosition.intendedHoldDays;

  return (
    openingPosition.assetId.trim().length > 0 &&
    Number.isFinite(openingPosition.quantity) &&
    openingPosition.quantity > 0 &&
    Number.isFinite(openingPosition.averageCostPrice) &&
    openingPosition.averageCostPrice > 0 &&
    hasValidManualValuation(openingPosition, now, assetCurrency) &&
    hasValidOpeningPositionDateState(openingPosition, now) &&
    (conviction === undefined ||
      (Number.isInteger(conviction) && conviction >= 1 && conviction <= 5)) &&
    (intendedHoldDays === undefined ||
      (Number.isInteger(intendedHoldDays) && intendedHoldDays > 0))
  );
}

export function hasValidManualValuation(
  openingPosition: OpeningPosition,
  now: Date,
  assetCurrency?: Currency,
) {
  const valuation = openingPosition.manualValuation;

  if (valuation && openingPosition.currentPrice !== undefined) {
    return false;
  }

  if (!valuation) {
    return (
      openingPosition.currentPrice === undefined ||
      (Number.isFinite(openingPosition.currentPrice) &&
        openingPosition.currentPrice > 0)
    );
  }

  const asOf = valuation.asOf === null ? null : new Date(valuation.asOf);
  const hasValidAsOf =
    valuation.provenance === "legacy"
      ? valuation.asOf === null
      : asOf !== null &&
        Number.isFinite(asOf.getTime()) &&
        asOf.getTime() <= now.getTime();

  return (
    valuation.source === "manual" &&
    (valuation.currency === "INR" || valuation.currency === "USD") &&
    (assetCurrency === undefined || valuation.currency === assetCurrency) &&
    Number.isFinite(valuation.price) &&
    valuation.price > 0 &&
    hasValidAsOf
  );
}

export function hasValidOpeningPositionDateState(
  openingPosition: OpeningPosition,
  now: Date,
) {
  const acquisitionDate =
    openingPosition.date === null
      ? null
      : getCalendarDatePart(openingPosition.date);
  const recordedAt = new Date(openingPosition.recordedAt ?? "");
  const hasValidRecordedAt =
    Number.isFinite(recordedAt.getTime()) &&
    recordedAt.getTime() <= now.getTime();
  const recordedOn = getCalendarDatePart(openingPosition.recordedOn ?? "");
  const hasValidRecordedOn =
    recordedOn !== null &&
    recordedOn === openingPosition.recordedOn &&
    !isFutureCalendarDate(recordedOn, now);
  const hasValidDateState =
    openingPosition.date === null
      ? hasValidRecordedAt && hasValidRecordedOn
      : acquisitionDate !== null &&
        !isFutureCalendarDate(openingPosition.date, now);

  return hasValidDateState;
}

export function hasSupportedOpeningPositionPrecision(
  openingPosition: OpeningPosition,
) {
  const manualPrice = openingPosition.manualValuation?.price;
  const legacyPrice = openingPosition.currentPrice;

  return (
    Number.isFinite(openingPosition.quantity) &&
    openingPosition.quantity > 0 &&
    Number.isFinite(openingPosition.averageCostPrice) &&
    openingPosition.averageCostPrice > 0 &&
    (manualPrice === undefined ||
      (Number.isFinite(manualPrice) && manualPrice > 0)) &&
    (legacyPrice === undefined ||
      (Number.isFinite(legacyPrice) && legacyPrice > 0))
  );
}

export function openingPositionMonth(openingPosition: OpeningPosition) {
  return getOpeningPositionHistoryDate(openingPosition)?.slice(0, 7) ?? null;
}

export function prepareOpeningPositionForWrite(
  openingPosition: OpeningPosition,
  currentDate: Date,
  existingPosition?: OpeningPosition,
) {
  if (openingPosition.date !== null) {
    const {
      recordedAt: _recordedAt,
      recordedOn: _recordedOn,
      ...knownDatePosition
    } = openingPosition;
    return knownDatePosition;
  }

  if (existingPosition?.date === null) {
    return {
      ...openingPosition,
      recordedAt: existingPosition.recordedAt,
      recordedOn:
        existingPosition.recordedOn ??
        getOpeningPositionHistoryDate(existingPosition) ??
        formatLocalCalendarDate(currentDate),
    };
  }

  return {
    ...openingPosition,
    recordedAt: currentDate.toISOString(),
    recordedOn: formatLocalCalendarDate(currentDate),
  };
}

export function rebuildPortfolioSnapshots({
  assets,
  cashEntries,
  earliestAffectedMonth,
  now,
  openingPositions,
  ppfAccounts,
  ppfLedgerEntries,
  state,
  trades,
}: {
  assets?: Asset[];
  cashEntries?: CashEntry[];
  earliestAffectedMonth: string;
  now: Date;
  openingPositions?: OpeningPosition[];
  ppfAccounts?: PpfAccount[];
  ppfLedgerEntries?: PpfLedgerEntry[];
  state: PortfolioStoreState;
  trades?: Trade[];
}) {
  const nextAssets = assets ?? state.assets;
  const nextCashEntries = cashEntries ?? state.cashEntries;
  const nextOpeningPositions = openingPositions ?? state.openingPositions;
  const nextPpfAccounts = ppfAccounts ?? state.ppfAccounts;
  const nextPpfLedgerEntries = ppfLedgerEntries ?? state.ppfLedgerEntries;
  const nextTrades = trades ?? state.trades;
  const affectedAutoSnapshots = new Map(
    state.monthlySnapshots
      .filter(
        (snapshot) =>
          snapshot.month >= earliestAffectedMonth &&
          snapshot.generated?.source === "auto",
      )
      .map((snapshot) => [snapshot.month, snapshot]),
  );
  let monthlySnapshots = state.monthlySnapshots.filter(
    (snapshot) =>
      snapshot.month < earliestAffectedMonth ||
      snapshot.generated?.source !== "auto",
  );
  const targetMonths = getMissingCompletedSnapshotMonths({
    cashEntries: nextCashEntries,
    existingSnapshots: monthlySnapshots,
    now,
    openingPositions: nextOpeningPositions,
    ppfAccounts: nextPpfAccounts,
    trades: nextTrades,
  }).filter((month) => month >= earliestAffectedMonth);
  const pendingMonths: string[] = [];
  const refreshedMonths: string[] = [];

  for (const targetMonth of targetMonths) {
    const result = buildGeneratedMonthEndSnapshot({
      assets: nextAssets,
      cashEntries: nextCashEntries,
      existingSnapshots: monthlySnapshots,
      historicalQuotes: state.historicalQuoteCache,
      now,
      openingPositions: nextOpeningPositions,
      ppfAccounts: nextPpfAccounts,
      ppfLedgerEntries: nextPpfLedgerEntries,
      quoteCache: state.quoteCache,
      targetMonth,
      trades: nextTrades,
    });

    if (result.status === "created" && result.snapshot) {
      const previousSnapshot = affectedAutoSnapshots.get(targetMonth);
      monthlySnapshots = [
        ...monthlySnapshots,
        {
          ...result.snapshot,
          id: previousSnapshot?.id ?? result.snapshot.id,
        },
      ];
      refreshedMonths.push(targetMonth);
    } else {
      pendingMonths.push(targetMonth);
    }
  }

  monthlySnapshots.sort((left, right) => compareCodeUnits(left.month, right.month));

  return {
    monthlySnapshots,
    pendingMonths,
    provisionalMonths: monthlySnapshots
      .filter(
        (snapshot) =>
          refreshedMonths.includes(snapshot.month) &&
          getMonthlySnapshotPriceConfidence(snapshot) === "provisional",
      )
      .map((snapshot) => snapshot.month),
    refreshedMonths,
  };
}

export function assetRecordMonth(state: PortfolioStoreState, assetId: string) {
  return [
    ...state.openingPositions
      .filter((position) => position.assetId === assetId)
      .map(openingPositionMonth),
    ...state.trades
      .filter((trade) => trade.assetId === assetId)
      .map(tradeMonth),
  ]
    .filter((month): month is string => Boolean(month))
    .sort()[0];
}

export function normalizedIdentity(value?: string) {
  return value?.trim().toUpperCase() ?? "";
}

export function hasDuplicateAssetIdentity(assets: Asset[], candidate: Asset) {
  return hasCanonicalAssetConflict(assets, candidate);
}

export const validAssetClasses: Asset["assetClass"][] = [
  "cash",
  "crypto",
  "debt",
  "etf",
  "stock",
];
export const validExchanges = ["BSE", "CRYPTO", "NSE"];

export function hasValidAssetIdentity(asset: Asset) {
  try { assertCatalogSplits(asset); } catch { return false; }

  return (
    asset.id.trim().length > 0 &&
    asset.name.trim().length > 0 &&
    asset.symbol.trim().length > 0 &&
    asset.ticker.trim().length > 0 &&
    validAssetClasses.includes(asset.assetClass) &&
    (asset.exchange === undefined || validExchanges.includes(asset.exchange)) &&
    asset.instrumentType !== undefined &&
    isInstrumentType(asset.instrumentType) &&
    asset.sectorType !== undefined &&
    isSectorType(asset.sectorType) &&
    (asset.isTaxEligible === undefined ||
      typeof asset.isTaxEligible === "boolean") &&
    getV1AssetCurrencyIssue(asset) === undefined
  );
}

export function quoteIdentityChanged(previous: Asset, next: Asset) {
  return (
    normalizedIdentity(previous.quoteSourceId) !==
      normalizedIdentity(next.quoteSourceId) ||
    normalizedIdentity(previous.ticker) !== normalizedIdentity(next.ticker) ||
    normalizedIdentity(previous.exchange) !==
      normalizedIdentity(next.exchange) ||
    previous.currency !== next.currency
  );
}

