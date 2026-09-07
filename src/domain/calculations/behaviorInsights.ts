import { getCalendarDatePart } from "@/src/domain/dates";
import { decimal, normalizeQuantity } from "@/src/domain/precision";
import {
  getOpeningPositionHistoryDate,
  isTransactionAfterOpeningCutover,
} from "@/src/domain/openingPositions";
import {
  compareTransactionsChronologically,
  isManualTrade,
} from "@/src/domain/transactionSemantics";
import type {
  ConvictionScore,
  OpeningPosition,
  Trade,
} from "@/src/types";

import { getConvictionReadiness } from "./holdings";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CONVICTION_THRESHOLD = 5;
const DEFAULT_PATIENCE_THRESHOLD = 3;
const DEFAULT_FREQUENCY_WINDOW_DAYS = 90;
const DEFAULT_FREQUENCY_MINIMUM_DAYS = 30;

export type AnalysisAvailability = "available" | "insufficientData";

export type ConvictionAnalysis = {
  availability: AnalysisAvailability;
  distribution: Record<ConvictionScore, number>;
  eligibleDecisionCount: number;
  highCount: number;
  lowCount: number;
  neutralCount: number;
  ratedDecisionCount: number;
  requiredDecisionCount: number;
  unratedDecisionCount: number;
};

export type PatienceAnalysis = {
  availability: AnalysisAvailability;
  closedEarlierCount: number;
  metPlanCount: number;
  mixedOutcomeCount: number;
  observedSaleCount: number;
  observedSaleIds: string[];
  plannedMatchedQuantity: number;
  requiredSaleCount: number;
  uncoveredSaleQuantity: number;
};

export type TradeFrequencyAnalysis = {
  activeTradingDays: number;
  availability: AnalysisAvailability;
  buyCount: number;
  minimumObservableDays: number;
  observableDays: number;
  sellCount: number;
  tradesPer30Days: number;
  transactionCount: number;
  windowDays: number;
  windowEnd: string;
  windowStart: string;
};

export type BehaviorInsight = {
  evidence: string;
  kind: "conviction" | "patience" | "frequency";
  summary: string;
  title: string;
};

type BehaviorAnalysisSet = {
  conviction: ConvictionAnalysis;
  frequency: TradeFrequencyAnalysis;
  patience: PatienceAnalysis;
};

type PatienceLot = {
  acquiredOn: string | null;
  intendedHoldDays?: number;
  quantity: number;
};

function calendarOrdinal(value: string) {
  const date = getCalendarDatePart(value);
  if (date === null) return null;

  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function addCalendarDays(value: string, days: number) {
  const ordinal = calendarOrdinal(value);
  if (ordinal === null) return value;

  return new Date((ordinal + days) * DAY_MS).toISOString().slice(0, 10);
}

function inclusiveCalendarDays(from: string, to: string) {
  const fromOrdinal = calendarOrdinal(from);
  const toOrdinal = calendarOrdinal(to);
  if (fromOrdinal === null || toOrdinal === null || toOrdinal < fromOrdinal) {
    return 0;
  }

  return toOrdinal - fromOrdinal + 1;
}

function elapsedCalendarDays(from: string, to: string) {
  const fromOrdinal = calendarOrdinal(from);
  const toOrdinal = calendarOrdinal(to);
  if (fromOrdinal === null || toOrdinal === null || toOrdinal < fromOrdinal) {
    return null;
  }

  return toOrdinal - fromOrdinal;
}

export function analyseConviction(
  trades: Trade[],
  openingPositions: OpeningPosition[] = [],
  requiredDecisionCount = DEFAULT_CONVICTION_THRESHOLD,
): ConvictionAnalysis {
  const decisions = [
    ...trades.filter(isManualTrade),
    ...openingPositions,
  ];
  const ratings = decisions
    .map((decision) => decision.conviction)
    .filter((score): score is ConvictionScore => score !== undefined);
  const readiness = getConvictionReadiness(
    trades.filter(isManualTrade),
    requiredDecisionCount,
    openingPositions,
  );
  const distribution: Record<ConvictionScore, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  ratings.forEach((score) => {
    distribution[score] += 1;
  });

  return {
    availability: readiness.isReady ? "available" : "insufficientData",
    distribution,
    eligibleDecisionCount: decisions.length,
    highCount: readiness.highConvictionCount,
    lowCount: readiness.lowConvictionCount,
    neutralCount: distribution[3],
    ratedDecisionCount: readiness.ratedTradeCount,
    requiredDecisionCount,
    unratedDecisionCount: decisions.length - ratings.length,
  };
}

function consumeLots(lots: PatienceLot[], quantity: number) {
  const consumed: Array<PatienceLot & { consumedQuantity: number }> = [];
  let remaining = quantity;

  while (remaining > 0 && lots.length > 0) {
    const lot = lots[0];
    const consumedQuantity = Math.min(lot.quantity, remaining);
    consumed.push({ ...lot, consumedQuantity });
    lot.quantity = normalizeQuantity(decimal(lot.quantity).minus(consumedQuantity));
    remaining = normalizeQuantity(decimal(remaining).minus(consumedQuantity));

    if (lot.quantity <= 0) lots.shift();
  }

  return { consumed, unmatchedQuantity: remaining };
}

export function analysePatienceFromSells(
  trades: Trade[],
  openingPositions: OpeningPosition[] = [],
  requiredSaleCount = DEFAULT_PATIENCE_THRESHOLD,
): PatienceAnalysis {
  const assetIds = new Set([
    ...trades.map((trade) => trade.assetId),
    ...openingPositions.map((position) => position.assetId),
  ]);
  let closedEarlierCount = 0;
  let metPlanCount = 0;
  let mixedOutcomeCount = 0;
  let observedSaleCount = 0;
  const observedSaleIds: string[] = [];
  let plannedMatchedQuantity = decimal(0);
  let uncoveredSaleQuantity = decimal(0);

  assetIds.forEach((assetId) => {
    const positions = openingPositions.filter(
      (position) => position.assetId === assetId,
    );
    const lots: PatienceLot[] = [];
    const relevantTrades = trades
      .filter(
        (trade) =>
          trade.assetId === assetId &&
          isTransactionAfterOpeningCutover(trade.date, positions),
      )
      .sort(compareTransactionsChronologically);

    // Introduce openings when history says they exist, not before every trade.
    const events = [
      ...positions.map((position) => ({
        date: getOpeningPositionHistoryDate(position),
        position,
        type: "opening" as const,
      })),
      ...relevantTrades.map((trade) => ({
        date: getCalendarDatePart(trade.date),
        trade,
        type: "trade" as const,
      })),
    ]
      .filter((event) => event.date !== null)
      .sort((left, right) => left.date!.localeCompare(right.date!));

    events.forEach((event) => {
      if (event.type === "opening") {
        lots.push({
          acquiredOn: getCalendarDatePart(event.position.date ?? ""),
          intendedHoldDays: event.position.intendedHoldDays,
          quantity: event.position.quantity,
        });
        lots.sort((left, right) =>
          (left.acquiredOn ?? "").localeCompare(right.acquiredOn ?? ""),
        );
        return;
      }
      const trade = event.trade;
      const tradeDate = getCalendarDatePart(trade.date);

      if (trade.type === "buy" || trade.type === "transferIn") {
        lots.push({
          acquiredOn: tradeDate,
          intendedHoldDays:
            trade.type === "buy" ? trade.intendedHoldDays : undefined,
          quantity: trade.quantity,
        });
        return;
      }

      const { consumed, unmatchedQuantity } = consumeLots(lots, trade.quantity);
      if (trade.type === "transferOut") return;

      let metPlan = false;
      let closedEarlier = false;

      consumed.forEach((lot) => {
        if (
          tradeDate === null ||
          lot.acquiredOn === null ||
          lot.intendedHoldDays === undefined ||
          !Number.isInteger(lot.intendedHoldDays) ||
          lot.intendedHoldDays <= 0
        ) {
          uncoveredSaleQuantity = uncoveredSaleQuantity.plus(lot.consumedQuantity);
          return;
        }

        const heldDays = elapsedCalendarDays(lot.acquiredOn, tradeDate);
        if (heldDays === null) {
          uncoveredSaleQuantity = uncoveredSaleQuantity.plus(lot.consumedQuantity);
          return;
        }

        plannedMatchedQuantity = plannedMatchedQuantity.plus(lot.consumedQuantity);
        if (heldDays >= lot.intendedHoldDays) {
          metPlan = true;
        } else {
          closedEarlier = true;
        }
      });

      uncoveredSaleQuantity = uncoveredSaleQuantity.plus(unmatchedQuantity);
      if (!metPlan && !closedEarlier) return;

      observedSaleCount += 1;
      observedSaleIds.push(trade.id);
      if (metPlan && closedEarlier) mixedOutcomeCount += 1;
      else if (metPlan) metPlanCount += 1;
      else closedEarlierCount += 1;
    });
  });

  return {
    availability:
      observedSaleCount >= requiredSaleCount
        ? "available"
        : "insufficientData",
    closedEarlierCount,
    metPlanCount,
    mixedOutcomeCount,
    observedSaleCount,
    observedSaleIds,
    plannedMatchedQuantity: normalizeQuantity(plannedMatchedQuantity),
    requiredSaleCount,
    uncoveredSaleQuantity: normalizeQuantity(uncoveredSaleQuantity),
  };
}

export function analyseTradeFrequency({
  asOf,
  minimumObservableDays = DEFAULT_FREQUENCY_MINIMUM_DAYS,
  openingPositions = [],
  trades,
  windowDays = DEFAULT_FREQUENCY_WINDOW_DAYS,
}: {
  asOf: string;
  minimumObservableDays?: number;
  openingPositions?: OpeningPosition[];
  trades: Trade[];
  windowDays?: number;
}): TradeFrequencyAnalysis {
  const windowEnd = getCalendarDatePart(asOf);
  if (windowEnd === null) {
    throw new Error("Trade frequency requires a valid as-of calendar date.");
  }

  const windowStart = addCalendarDays(windowEnd, -(windowDays - 1));
  const activity = trades.filter(isManualTrade).filter((trade) => {
    const date = getCalendarDatePart(trade.date);
    return date !== null && date >= windowStart && date <= windowEnd;
  });
  const knownHistoryDates = [
    ...trades
      .filter(isManualTrade)
      .map((trade) => getCalendarDatePart(trade.date)),
    ...openingPositions.map(getOpeningPositionHistoryDate),
  ].filter((date): date is string => date !== null && date <= windowEnd);
  const historyStart = knownHistoryDates.sort()[0];
  const observableStart = historyStart
    ? historyStart > windowStart
      ? historyStart
      : windowStart
    : windowEnd;
  const observableDays = historyStart
    ? inclusiveCalendarDays(observableStart, windowEnd)
    : 0;
  const activeTradingDays = new Set(
    activity.map((trade) => getCalendarDatePart(trade.date)),
  ).size;
  const buyCount = activity.filter((trade) => trade.type === "buy").length;
  const sellCount = activity.length - buyCount;

  return {
    activeTradingDays,
    availability:
      observableDays >= minimumObservableDays
        ? "available"
        : "insufficientData",
    buyCount,
    minimumObservableDays,
    observableDays,
    sellCount,
    tradesPer30Days:
      observableDays === 0
        ? 0
        : Number(((activity.length * 30) / observableDays).toFixed(2)),
    transactionCount: activity.length,
    windowDays,
    windowEnd,
    windowStart,
  };
}

export function generateInsights({
  conviction,
  frequency,
  patience,
}: BehaviorAnalysisSet): BehaviorInsight[] {
  const insights: BehaviorInsight[] = [];

  if (conviction.availability === "available") {
    insights.push({
      evidence: `${conviction.ratedDecisionCount} rated decisions`,
      kind: "conviction",
      summary: `${conviction.highCount} were rated 4-5, ${conviction.neutralCount} were rated 3, and ${conviction.lowCount} were rated 1-2.`,
      title: "Conviction pattern",
    });
  }

  if (patience.availability === "available") {
    const mixedSummary =
      patience.mixedOutcomeCount > 0
        ? ` ${patience.mixedOutcomeCount} included both timings.`
        : "";
    insights.push({
      evidence: `${patience.observedSaleCount} sales with planned lots`,
      kind: "patience",
      summary: `${patience.metPlanCount} met or passed the intended holding period and ${patience.closedEarlierCount} closed earlier.${mixedSummary}`,
      title: "Planned holding periods",
    });
  }

  if (frequency.availability === "available") {
    const buyLabel = frequency.buyCount === 1 ? "buy" : "buys";
    const sellLabel = frequency.sellCount === 1 ? "sell" : "sells";
    insights.push({
      evidence: `${frequency.observableDays} observable days`,
      kind: "frequency",
      summary: `${frequency.buyCount} ${buyLabel} and ${frequency.sellCount} ${sellLabel} were recorded across ${frequency.activeTradingDays} active days.`,
      title: "Trading frequency",
    });
  }

  return insights;
}
