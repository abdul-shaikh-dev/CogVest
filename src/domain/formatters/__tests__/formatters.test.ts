import {
  formatCompactAxisValue,
  formatCompactINR,
  formatCurrency,
  formatDate,
  formatINR,
  formatPercentage,
  formatPrice,
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

  describe("compact values round before choosing the unit (#668)", () => {
    it.each([
      [999.49, "₹999"],
      [999.5, "₹1K"],
      [99_994.99, "₹99.99K"],
      [99_995, "₹1L"],
      [99_999.99, "₹1L"],
      [100_000, "₹1L"],
      [99_99_499, "₹99.99L"],
      [99_99_500, "₹1Cr"],
      [99_99_999, "₹1Cr"],
      [-99_999.99, "-₹1L"],
    ])("shows %p as %s", (value, expected) => {
      expect(formatCompactINR(value)).toBe(expected);
    });
  });

  describe("chart axis values (#668)", () => {
    it("uses lakh and crore for INR, rounding before the unit", () => {
      expect(formatCompactAxisValue(0.12345, "INR")).toBe("₹0.123");
      expect(formatCompactAxisValue(950, "INR")).toBe("₹950");
      expect(formatCompactAxisValue(99_960, "INR")).toBe("₹1.0L");
      expect(formatCompactAxisValue(2_50_00_000, "INR")).toBe("₹2.5Cr");
    });

    it("uses K, M and B for USD, never lakh or crore", () => {
      expect(formatCompactAxisValue(98_500, "USD")).toBe("$98.5K");
      expect(formatCompactAxisValue(99_960, "USD")).toBe("$100.0K");
      expect(formatCompactAxisValue(999_960, "USD")).toBe("$1.0M");
      expect(formatCompactAxisValue(2_500_000_000, "USD")).toBe("$2.5B");
      expect(formatCompactAxisValue(-1_500, "USD")).toBe("-$1.5K");
    });
  });

  it("formats prices in their own currency and grouping, with more digits below one", () => {
    expect(formatPrice(123456.789, "INR")).toBe("₹1,23,456.79");
    expect(formatPrice(123456.789, "USD")).toBe("$123,456.79");
    expect(formatPrice(0.00012345, "USD")).toBe("$0.000123");
  });
});
