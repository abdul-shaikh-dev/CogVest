import { z } from "zod";

import {
  isFutureDate,
  isValidDateString,
  tradeTypeSchema,
  validateSellQuantity,
} from "@/src/domain/validators";
import type { Trade, TradeType } from "@/src/types";

export type TradeFormValues = {
  assetId: string;
  conviction?: string;
  date: string;
  pricePerUnit: string;
  quantity: string;
  type: TradeType;
};

export type ValidTradeFormValue = {
  assetId: string;
  conviction?: number;
  date: string;
  pricePerUnit: number;
  quantity: number;
  type: TradeType;
};

type TradeFormValidationResult =
  | { isValid: true; value: ValidTradeFormValue }
  | { errors: Partial<Record<keyof TradeFormValues, string>>; isValid: false };

function parsePositiveNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? Number(trimmedValue) : Number.NaN;
  }

  return Number.NaN;
}

function positiveNumberField(invalidMessage: string, positiveMessage: string) {
  return z.unknown().transform((value, context) => {
    const parsedValue = parsePositiveNumber(value);

    if (!Number.isFinite(parsedValue)) {
      context.addIssue({
        code: "custom",
        message: invalidMessage,
      });

      return z.NEVER;
    }

    if (parsedValue <= 0) {
      context.addIssue({
        code: "custom",
        message: positiveMessage,
      });

      return z.NEVER;
    }

    return parsedValue;
  });
}

function optionalConvictionField() {
  return z.unknown().transform((value, context) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === "string" && value.trim().length === 0) {
      return undefined;
    }

    const parsedValue = parsePositiveNumber(value);

    if (
      !Number.isInteger(parsedValue) ||
      parsedValue < 1 ||
      parsedValue > 5
    ) {
      context.addIssue({
        code: "custom",
        message: "Conviction must be between 1 and 5.",
      });

      return z.NEVER;
    }

    return parsedValue;
  });
}

export function createTradeFormSchema(now = new Date()) {
  return z.object({
    assetId: z.string().trim().min(1, "Asset is required."),
    conviction: optionalConvictionField(),
    date: z
      .string()
      .trim()
      .min(1, "Date is required.")
      .refine(isValidDateString, "Date must be valid.")
      .refine((value) => !isFutureDate(value, now), "Date cannot be in the future."),
    pricePerUnit: positiveNumberField(
      "Price must be a valid number.",
      "Price must be greater than zero.",
    ),
    quantity: positiveNumberField(
      "Quantity must be a valid number.",
      "Quantity must be greater than zero.",
    ),
    type: tradeTypeSchema,
  });
}

export const tradeFormSchema = createTradeFormSchema();

export function validateTradeForm(
  values: TradeFormValues,
  existingTrades: Trade[],
  now = new Date(),
): TradeFormValidationResult {
  const result = createTradeFormSchema(now).safeParse(values);

  if (!result.success) {
    return {
      errors: issuesToFieldErrors(result.error.issues),
      isValid: false,
    };
  }

  const value = result.data;

  if (value.type === "sell") {
    const assetTrades = existingTrades.filter(
      (trade) => trade.assetId === value.assetId,
    );
    const sellQuantityResult = validateSellQuantity(assetTrades, value.quantity);

    if (!sellQuantityResult.isValid) {
      return {
        errors: {
          quantity: sellQuantityResult.message,
        },
        isValid: false,
      };
    }
  }

  return {
    isValid: true,
    value,
  };
}

function issuesToFieldErrors(issues: z.core.$ZodIssue[]) {
  const errors: Partial<Record<keyof TradeFormValues, string>> = {};

  for (const issue of issues) {
    const field = issue.path[0];

    if (typeof field === "string" && !(field in errors)) {
      errors[field as keyof TradeFormValues] = issue.message;
    }
  }

  return errors;
}
