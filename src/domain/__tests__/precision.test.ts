import {
  decimal,
  financialPrecision,
  isAtOrBeyondNegativeQuantum,
  isWithinQuantum,
  moneyQuantum,
  normalizeMoney,
  normalizePercentage,
  normalizeQuantity,
  normalizeUnitPrice,
  quantityQuantum,
} from "@/src/domain/precision";

describe("financial precision contract", () => {
  it("uses decimal half-up rounding for positive and negative money boundaries", () => {
    expect(normalizeMoney("1.005")).toBe(1.01);
    expect(normalizeMoney("-1.005")).toBe(-1.01);
  });

  it("normalizes quantities and prices without binary floating-point drift", () => {
    expect(normalizeQuantity("0.123456785")).toBe(0.12345679);
    expect(normalizeUnitPrice("0.000000125")).toBe(0.00000013);
  });

  it("rounds percentages only at their output boundary", () => {
    const percentage = decimal(1).dividedBy(6).times(100);

    expect(normalizePercentage(percentage)).toBe(16.67);
    expect(financialPrecision.percentage).toBe(2);
  });

  it("compares money and quantities against explicit quanta", () => {
    expect(isWithinQuantum("10.009", 10, moneyQuantum)).toBe(true);
    expect(isWithinQuantum("10.01", 10, moneyQuantum)).toBe(false);
    expect(isWithinQuantum("10.011", 10, moneyQuantum)).toBe(false);
    expect(isWithinQuantum("0.100000005", 0.1, quantityQuantum)).toBe(true);
    expect(isWithinQuantum("0.10000001", 0.1, quantityQuantum)).toBe(false);
    expect(isWithinQuantum("0.10000002", 0.1, quantityQuantum)).toBe(false);
  });

  it("tolerates only negative legacy residues below the owning quantum", () => {
    expect(isAtOrBeyondNegativeQuantum("-0.009", moneyQuantum)).toBe(false);
    expect(isAtOrBeyondNegativeQuantum("-0.01", moneyQuantum)).toBe(true);
    expect(
      isAtOrBeyondNegativeQuantum("-0.000000001", quantityQuantum),
    ).toBe(false);
    expect(
      isAtOrBeyondNegativeQuantum("-0.00000001", quantityQuantum),
    ).toBe(true);
  });
});
