import { z } from "zod";

import {
  getCalendarDatePart,
  isEffectiveCalendarDate,
  isFutureCalendarDate,
} from "@/src/domain/dates";
import type { OpeningPosition, Trade, TradeType } from "@/src/types";

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
) {
  const openingQuantity = openingPositions
    .filter((position) => isEffectiveCalendarDate(position.date, now))
    .reduce(
    (quantity, position) => quantity + position.quantity,
    0,
  );

  return trades
    .filter((trade) => isEffectiveCalendarDate(trade.date, now))
    .reduce((quantity, trade) => {
    if (trade.type === "sell") {
      return quantity - trade.quantity;
    }

    return quantity + trade.quantity;
    }, openingQuantity);
}

export function validateSellQuantity(
  trades: Trade[],
  sellQuantity: number,
  openingPositions: OpeningPosition[] = [],
  now = new Date(),
): SellQuantityResult {
  const availableQuantity = getAvailableQuantity(
    trades,
    openingPositions,
    now,
  );

  if (sellQuantity > availableQuantity) {
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
