import { z } from "zod";

import {
  getCalendarDatePart,
  formatLocalCalendarDate,
  isEffectiveCalendarDate,
  isFutureCalendarDate,
} from "@/src/domain/dates";
import type { OpeningPosition, StockSplitEvent, Trade, TradeType } from "@/src/types";
import {
  isOpeningPositionEffective,
  isTransactionAfterOpeningCutover,
} from "@/src/domain/openingPositions";
import { positionQuantity, StockSplitError } from "@/src/domain/stockSplits";
import {
  decimal,
  normalizeQuantity,
} from "@/src/domain/precision";

type ValidationResult =
  | { isValid: true }
  | { errors: string[]; isValid: false };

type SellQuantityResult =
  | { availableQuantity: number; isValid: true }
  | { availableQuantity: number; isValid: false; message: string };

export type TradeInput = {
  date: string;
  pricePerUnit: number;
  quantity: number;
  type: TradeType;
};

const tradeTypes = ["buy", "sell"] as const;

export const tradeTypeSchema = z.enum(tradeTypes);

export function isValidDateString(value: string) {
  return getCalendarDatePart(value) !== null;
}

export function isFutureDate(value: string, now = new Date()) {
  return isFutureCalendarDate(value, now);
}

export function createTradeInputSchema(now = new Date()) {
  return z.object({
    date: z
      .string()
      .trim()
      .min(1, "Date is required.")
      .refine(isValidDateString, "Date must be valid.")
      .refine((value) => !isFutureDate(value, now), "Date cannot be in the future."),
    quantity: z
      .number()
      .finite("Quantity must be a valid number.")
      .positive("Quantity must be greater than zero."),
    pricePerUnit: z
      .number()
      .finite("Price must be a valid number.")
      .positive("Price must be greater than zero."),
    type: tradeTypeSchema,
  });
}

export const tradeInputSchema = createTradeInputSchema();

export function getAvailableQuantity(
  trades: Trade[],
  openingPositions: OpeningPosition[] = [],
  now = new Date(),
  stockSplits?: readonly StockSplitEvent[],
) {
  const effectiveOpenings = openingPositions.filter((position) =>
    isOpeningPositionEffective(position, now),
  );

  const effectiveTrades = trades
    .filter(
      (trade) =>
        isEffectiveCalendarDate(trade.date, now) &&
        isTransactionAfterOpeningCutover(trade.date, effectiveOpenings),
    );

  try {
    return normalizeQuantity(positionQuantity({
      openingPositions: effectiveOpenings,
      trades: effectiveTrades,
      stockSplits,
      through: formatLocalCalendarDate(now),
    }));
  } catch (error) {
    if (!(error instanceof StockSplitError)) throw error;
    return Number.NaN;
  }
}

export function validateSellQuantity(
  trades: Trade[],
  sellQuantity: number,
  openingPositions: OpeningPosition[] = [],
  now = new Date(),
  stockSplits?: readonly StockSplitEvent[],
): SellQuantityResult {
  const availableQuantity = getAvailableQuantity(
    trades,
    openingPositions,
    now,
    stockSplits,
  );

  if (!Number.isFinite(availableQuantity)) {
    return {
      availableQuantity,
      isValid: false,
      message: "Available units are unavailable until the stock split is resolved.",
    };
  }

  if (
    decimal(sellQuantity)
      .minus(availableQuantity)
      .greaterThan(0)
  ) {
    return {
      availableQuantity,
      isValid: false,
      message: "Sell quantity exceeds available units.",
    };
  }

  return {
    availableQuantity,
    isValid: true,
  };
}

export function validateTradeInput(input: TradeInput, now = new Date()): ValidationResult {
  const result = createTradeInputSchema(now).safeParse(input);

  if (result.success) {
    return { isValid: true };
  }

  return {
    errors: result.error.issues.map((issue) => issue.message),
    isValid: false,
  };
}
