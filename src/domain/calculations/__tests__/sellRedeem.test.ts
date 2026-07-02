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
