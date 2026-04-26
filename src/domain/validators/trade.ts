import type { Trade, TradeType } from "@/src/types";

type ValidationResult =
  | { isValid: true }
  | { errors: string[]; isValid: false };

type SellQuantityResult =
  | { availableQuantity: number; isValid: true }
  | { availableQuantity: number; isValid: false; message: string };

type TradeInput = {
  date: string;
  pricePerUnit: number;
  quantity: number;
  type: TradeType;
};

export function getAvailableQuantity(trades: Trade[]) {
  return trades.reduce((quantity, trade) => {
    if (trade.type === "sell") {
      return quantity - trade.quantity;
    }

    return quantity + trade.quantity;
  }, 0);
}

export function validateSellQuantity(
  trades: Trade[],
  sellQuantity: number,
): SellQuantityResult {
  const availableQuantity = getAvailableQuantity(trades);

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

export function validateTradeInput(input: TradeInput): ValidationResult {
  const errors: string[] = [];

  if (input.quantity <= 0) {
    errors.push("Quantity must be greater than zero.");
  }

  if (input.pricePerUnit <= 0) {
    errors.push("Price must be greater than zero.");
  }

  if (Number.isNaN(new Date(input.date).getTime())) {
    errors.push("Date must be valid.");
  }

  if (errors.length > 0) {
    return { errors, isValid: false };
  }

  return { isValid: true };
}
