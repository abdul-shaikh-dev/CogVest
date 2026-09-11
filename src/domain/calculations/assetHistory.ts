import { getCalendarDatePart } from "@/src/domain/dates";
import {
  getOpeningPositionHistoryDate,
  isTransactionAfterOpeningCutover,
} from "@/src/domain/openingPositions";
import { decimal, normalizeMoney } from "@/src/domain/precision";
import { getTradeQuantityDelta } from "@/src/domain/transactionSemantics";
import { positionEvents, splitQuantity, StockSplitError } from "@/src/domain/stockSplits";
import type { DailyPriceEntry } from "@/src/services/quotes/dailyPriceCache";
import type { Asset, OpeningPosition, Trade } from "@/src/types";

export type AssetHistoryPoint = {
  date: string;
  holdingValue: number | null;
  price: number;
};

export type AssetHistoryResult = {
  holdingStart: string | null;
  points: AssetHistoryPoint[];
  warning: string | null;
};

type AssetHistoryInput = {
  asset: Asset;
  entry: DailyPriceEntry;
  openingPositions: OpeningPosition[];
  trades: Trade[];
};

const maximumHistoryPoints = 500;

export function downsampleAssetHistory(
  points: AssetHistoryPoint[],
  maximum = maximumHistoryPoints,
) {
  if (points.length <= maximum) return points;
  if (maximum < 2) return [];

  const required = new Set<number>([0, points.length - 1]);
  for (let index = 1; index < points.length; index += 1) {
    if ((points[index - 1].holdingValue === null) !== (points[index].holdingValue === null)) {
      required.add(index - 1);
      required.add(index);
    }
  }
  if (required.size > maximum) return [];

  const selected = new Set(required);
  const available = maximum - selected.size;
  for (let index = 1; index <= available; index += 1) {
    selected.add(Math.round((index * (points.length - 1)) / (available + 1)));
  }
  return [...selected].sort((left, right) => left - right).map((index) => points[index]);
}

export function buildAssetHistory({
  asset,
  entry,
  openingPositions,
  trades,
}: AssetHistoryInput): AssetHistoryResult {
  if (entry.currency !== asset.currency) {
    return { holdingStart: null, points: [], warning: "Price currency does not match the asset currency." };
  }
  if (entry.basis !== "close") {
    return { holdingStart: null, points: [], warning: "Only close-price history is supported." };
  }

  const openings = openingPositions.filter((position) => position.assetId === asset.id);
  if (openings.some((position) => getOpeningPositionHistoryDate(position) === null)) {
    return {
      holdingStart: null,
      points: entry.points.map((point) => ({ date: point.date, holdingValue: null, price: point.close })),
      warning: "An opening quantity has no reliable history date.",
    };
  }

  const assetTrades = trades.filter((trade) => trade.assetId === asset.id);
  if (assetTrades.some((trade) => getCalendarDatePart(trade.date) === null)) {
    return {
      holdingStart: null,
      points: entry.points.map((point) => ({
        date: point.date,
        holdingValue: null,
        price: point.close,
      })),
      warning: "A transaction has no reliable history date.",
    };
  }

  if (asset.stockSplits?.length) {
    if (asset.stockSplits.some((event) => event.effectiveDate > (entry.points[0]?.date ?? ""))) {
      return { holdingStart: null, points: [], warning: "Price units across this stock split need reconciliation." };
    }
    try {
      const events = positionEvents({ openingPositions: openings, trades: assetTrades, stockSplits: asset.stockSplits });
      const holdingStart = events.find((event) => event.type !== "split")?.date ?? null;
      let quantity = decimal(0);
      let index = 0;
      const points = entry.points.map((point) => {
        while (index < events.length && (getCalendarDatePart(events[index].date) ?? "") <= point.date) {
          const event = events[index++];
          quantity = event.type === "split" ? splitQuantity(quantity, event.split) : quantity.plus(
            event.type === "opening" ? event.position.quantity : getTradeQuantityDelta(event.trade));
          if (quantity.isNegative()) throw new StockSplitError("inventory", "Transaction history would produce a negative quantity.");
        }
        return { date: point.date, price: point.close, holdingValue: holdingStart === null || point.date < holdingStart ? null : normalizeMoney(quantity.times(point.close)) };
      });
      return { holdingStart, points, warning: null };
    } catch (error) {
      if (!(error instanceof StockSplitError)) throw error;
      return { holdingStart: null, points: [], warning: error.message };
    }
  }

  const datedEvents = [
    ...openings.map((position) => ({
      date: getOpeningPositionHistoryDate(position)!,
      delta: position.quantity,
    })),
    ...assetTrades
      .filter((trade) => isTransactionAfterOpeningCutover(trade.date, openings))
      .map((trade) => ({ date: getCalendarDatePart(trade.date)!, delta: getTradeQuantityDelta(trade) })),
  ];
  const deltasByDate = new Map<string, ReturnType<typeof decimal>>();
  for (const event of datedEvents) {
    deltasByDate.set(
      event.date,
      (deltasByDate.get(event.date) ?? decimal(0)).plus(event.delta),
    );
  }
  const events = [...deltasByDate.entries()]
    .map(([date, delta]) => ({ date, delta }))
    .sort((left, right) => left.date.localeCompare(right.date));

  const holdingStart = events[0]?.date ?? null;
  let quantity = decimal(0);
  let eventIndex = 0;
  let negativeQuantity = false;
  const points = entry.points.map((point) => {
    while (eventIndex < events.length && events[eventIndex].date <= point.date) {
      quantity = quantity.plus(events[eventIndex].delta);
      eventIndex += 1;
      if (quantity.isNegative()) negativeQuantity = true;
    }
    return {
      date: point.date,
      holdingValue: holdingStart === null || point.date < holdingStart || negativeQuantity
        ? null
        : normalizeMoney(quantity.times(point.close)),
      price: point.close,
    };
  });

  if (negativeQuantity) {
    return { holdingStart, points: points.map((point) => ({ ...point, holdingValue: null })), warning: "Transaction history would produce a negative quantity." };
  }
  return {
    holdingStart,
    points,
    warning:
      holdingStart === null
        ? "No ownership record is available for this price history."
        : null,
  };
}
