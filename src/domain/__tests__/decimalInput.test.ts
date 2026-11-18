import { parseDecimalInput } from "@/src/domain/decimalInput";
import { parseHoldingsCsv } from "@/src/domain/holdingsCsv";
import { validateCashEntryForm } from "@/src/features/cash/cashEntryForm";
import { validateTradeForm } from "@/src/features/trades/tradeForm";

// #719: one strict decimal parser for CSV cells and form fields.
describe("parseDecimalInput", () => {
  it.each([["12", 12], ["12.5", 12.5], ["12.", 12], [".5", 0.5], [" 7 ", 7], ["0", 0]])("accepts %p", (input, expected) => {
    expect(parseDecimalInput(input)).toBe(expected);
  });

  it.each(["0x10", "0b11", "0o7", "1e5", "1E-2", "+5", "-5", "1,000", "Infinity", "NaN", "", " ", "1.2.3", "₹100", "١٢"])(
    "rejects %p",
    (input) => {
      expect(parseDecimalInput(input)).toBeNaN();
    },
  );

  it("admits a leading minus only when asked", () => {
    expect(parseDecimalInput("-12.5", { allowNegative: true })).toBe(-12.5);
    expect(parseDecimalInput("-0x10", { allowNegative: true })).toBeNaN();
    expect(parseDecimalInput("--1", { allowNegative: true })).toBeNaN();
  });
});

describe("strict parsing at the edges (#719)", () => {
  const header =
    "cogvest_version,name,ticker,symbol,asset_class,instrument_type,sector,currency,exchange,quantity,average_cost,current_price,valuation_as_of,first_purchase_date";
  const now = new Date("2026-08-15T12:00:00.000Z");

  it.each(["0x10", "1e5", "+10"])("rejects a holdings CSV quantity of %p", (quantity) => {
    const result = parseHoldingsCsv(
      `${header}\n1,Fund,FUND.NS,FUND,etf,etf,diversified,INR,NSE,${quantity},125.50,140,2026-08-14,unknown\n`,
      now,
    );
    expect(result.errors).toContainEqual(expect.objectContaining({ code: "invalidNumber", column: "quantity" }));
  });

  it("rejects hex and exponent Cash amounts", () => {
    for (const amount of ["0x10", "1e5"]) {
      expect(validateCashEntryForm({ amount, date: "2026-08-01", label: "Deposit", now }).errors.amount).toBe("Amount must be a valid number.");
    }
  });

  it("rejects hex and exponent trade quantities and prices", () => {
    const base = { assetId: "a", date: "2026-08-01", fees: "", pricePerUnit: "100", quantity: "2", type: "buy" };
    const quantityErrors = validateTradeForm({ ...base, quantity: "0x2" } as never, [], now);
    const priceErrors = validateTradeForm({ ...base, pricePerUnit: "1e2" } as never, [], now);
    expect(quantityErrors.isValid).toBe(false);
    expect(priceErrors.isValid).toBe(false);
  });
});
