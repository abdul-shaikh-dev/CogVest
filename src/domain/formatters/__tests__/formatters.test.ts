import {
  formatCompactINR,
  formatCurrency,
  formatDate,
  formatINR,
  formatPercentage,
} from "@/src/domain/formatters";

describe("formatters", () => {
  it("formats native INR and USD values explicitly", () => {
    expect(formatCurrency(1234.5, "INR")).toBe("₹1,234.50");
    expect(formatCurrency(1234.5, "USD")).toBe("$1,234.50");
  });

  it("formats INR values with Indian grouping", () => {
    expect(formatINR(1234567.8)).toBe("₹12,34,567.80");
  });

  it("formats negative INR values", () => {
    expect(formatINR(-4500)).toBe("-₹4,500.00");
  });

  it("formats compact INR values for dense mobile metric cards", () => {
    expect(formatCompactINR(0)).toBe("₹0");
    expect(formatCompactINR(999)).toBe("₹999");
    expect(formatCompactINR(12000)).toBe("₹12K");
    expect(formatCompactINR(62000)).toBe("₹62K");
    expect(formatCompactINR(123456)).toBe("₹1.23L");
    expect(formatCompactINR(1234567)).toBe("₹12.35L");
    expect(formatCompactINR(12345678)).toBe("₹1.23Cr");
    expect(formatCompactINR(-2000)).toBe("-₹2K");
  });

  it("formats percentages with sign and two decimals", () => {
    expect(formatPercentage(12.345)).toBe("+12.35%");
    expect(formatPercentage(-2)).toBe("-2.00%");
  });

  it("formats ISO dates for India locale", () => {
    expect(formatDate("2026-04-26T00:00:00.000Z")).toBe("26 Apr 2026");
  });

  it("preserves rounding, negative zero, currency separation and UTC dates on reuse", () => {
    for (let pass = 0; pass < 2; pass += 1) {
      expect(formatINR(1.005)).toBe("₹1.01");
      expect(formatINR(-1.005)).toBe("-₹1.01");
      expect(formatINR(-0)).toBe("₹0.00");
      expect(formatCurrency(1234567.8, "USD")).toBe("$1,234,567.80");
      expect(formatCurrency(1234567.8, "INR")).toBe("₹12,34,567.80");
      expect(formatDate("2026-04-26T23:30:00-04:00")).toBe("27 Apr 2026");
      expect(() => formatDate("not a date")).toThrow(RangeError);
      expect(formatDate("2026-04-26")).toBe("26 Apr 2026");
    }
  });

  it("constructs fixed formatters only once across repeated portfolio renders", () => {
    const numberConstructor = jest.spyOn(Intl, "NumberFormat");
    const dateConstructor = jest.spyOn(Intl, "DateTimeFormat");
    try {
      jest.isolateModules(() => {
        const formatters = require("../formatters") as typeof import("../formatters");
        for (let row = 0; row < 750; row += 1) {
          formatters.formatINR(row);
          formatters.formatCurrency(row, "INR");
          formatters.formatCurrency(row, "USD");
          formatters.formatDate("2026-04-26");
        }
      });
      expect(numberConstructor).toHaveBeenCalledTimes(3);
      expect(dateConstructor).toHaveBeenCalledTimes(1);
    } finally {
      numberConstructor.mockRestore();
      dateConstructor.mockRestore();
    }
  });
});
