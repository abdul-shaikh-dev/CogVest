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
  const grossProceeds = quantity * sellPrice;
  const netProceeds = grossProceeds - fees;
  const remainingUnits = Math.max(0, availableUnits - quantity);

  return {
    fees,
    grossProceeds,
    netProceeds,
    remainingUnits,
    remainingValue: remainingUnits * currentPrice,
  };
}

export function validateSellRedeemFees({
  fees,
  grossProceeds,
}: {
  fees: number;
  grossProceeds: number;
}) {
  if (fees > grossProceeds) {
    return {
      isValid: false as const,
      message: "Fees cannot exceed gross proceeds.",
    };
  }

  return { isValid: true as const };
}
