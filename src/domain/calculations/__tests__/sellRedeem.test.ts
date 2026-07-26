import {
  calculateSellRedeemPreview,
  validateSellRedeemFees,
} from "@/src/domain/calculations";

describe("sell/redeem calculations", () => {
  it("calculates proceeds and remaining position preview", () => {
    expect(
      calculateSellRedeemPreview({
        availableUnits: 10,
        currentPrice: 150,
        fees: 25,
        quantity: 4,
        sellPrice: 200,
      }),
    ).toEqual({
      fees: 25,
      grossProceeds: 800,
      netProceeds: 775,
      remainingUnits: 6,
      remainingValue: 900,
    });
  });

  it("defaults fees to zero", () => {
    expect(
      calculateSellRedeemPreview({
        availableUnits: 2,
        currentPrice: 100,
        quantity: 1,
        sellPrice: 125,
      }),
    ).toMatchObject({
      fees: 0,
      grossProceeds: 125,
      netProceeds: 125,
    });
  });

  it("reconciles fractional crypto proceeds, fees, and remaining value", () => {
    const input = {
      availableUnits: 0.12345678,
      currentPrice: 6_123_456.78,
      fees: 12.34,
      quantity: 0.02345678,
      sellPrice: 6_234_567.89,
    };

    const preview = calculateSellRedeemPreview(input);

    expect(preview.remainingUnits).toBeCloseTo(0.1, 12);
    expect(preview.grossProceeds).toBeCloseTo(
      input.quantity * input.sellPrice,
      8,
    );
    expect(preview.netProceeds).toBeCloseTo(
      preview.grossProceeds - input.fees,
      8,
    );
    expect(preview.remainingValue).toBeCloseTo(
      preview.remainingUnits * input.currentPrice,
      8,
    );
  });

  it("rejects fees above gross proceeds", () => {
    expect(validateSellRedeemFees({ fees: 801, grossProceeds: 800 })).toEqual({
      isValid: false,
      message: "Fees cannot exceed gross proceeds.",
    });
    expect(validateSellRedeemFees({ fees: 800, grossProceeds: 800 })).toEqual({
      isValid: true,
    });
  });
});
