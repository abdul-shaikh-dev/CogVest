import {
  decimal,
  normalizeMoney,
  normalizeQuantity,
} from "@/src/domain/precision";

export type SellRedeemPreviewInput = {
  availableUnits: number;
  currentPrice: number;
  fees?: number;
  quantity: number;
  sellPrice: number;
};

export type SellRedeemPreview = {
  fees: number;
  grossProceeds: number;
  netProceeds: number;
  remainingUnits: number;
  remainingValue: number;
};

export function calculateSellRedeemPreview({
  availableUnits,
  currentPrice,
  fees = 0,
  quantity,
  sellPrice,
}: SellRedeemPreviewInput): SellRedeemPreview {
  const normalizedFees = normalizeMoney(fees);
  const grossValue = decimal(quantity).times(sellPrice);
  const grossProceeds = normalizeMoney(grossValue);
  const netProceeds = normalizeMoney(
    grossValue.minus(normalizedFees),
  );
  const remainder = decimal(availableUnits).minus(quantity);
  const remainingUnits = normalizeQuantity(
    remainder.isNegative() ? 0 : remainder,
  );

  return {
    fees: normalizedFees,
    grossProceeds,
    netProceeds,
    remainingUnits,
    remainingValue: normalizeMoney(
      decimal(remainingUnits).times(currentPrice),
    ),
  };
}

export function validateSellRedeemFees({
  fees,
  grossProceeds,
}: {
  fees: number;
  grossProceeds: number;
}) {
  const normalizedFees = normalizeMoney(fees);
  const normalizedGrossProceeds = normalizeMoney(grossProceeds);

  if (decimal(normalizedFees).greaterThanOrEqualTo(normalizedGrossProceeds)) {
    return {
      isValid: false as const,
      message: "Fees must be less than gross proceeds.",
    };
  }

  return { isValid: true as const };
}
