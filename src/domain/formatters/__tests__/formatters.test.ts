import { formatDate, formatINR, formatPercentage } from "@/src/domain/formatters";

describe("formatters", () => {
  it("formats INR values with Indian grouping", () => {
    expect(formatINR(1234567.8)).toBe("₹12,34,567.80");
  });

  it("formats negative INR values", () => {
    expect(formatINR(-4500)).toBe("-₹4,500.00");
  });

  it("formats percentages with sign and two decimals", () => {
    expect(formatPercentage(12.345)).toBe("+12.35%");
    expect(formatPercentage(-2)).toBe("-2.00%");
  });

  it("formats ISO dates for India locale", () => {
    expect(formatDate("2026-04-26T00:00:00.000Z")).toBe("26 Apr 2026");
  });
});
