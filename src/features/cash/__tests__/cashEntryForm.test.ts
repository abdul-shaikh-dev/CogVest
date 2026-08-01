import { validateCashEntryForm } from "@/src/features/cash/cashEntryForm";

describe("cash entry precision", () => {
  const baseInput = {
    date: "2026-07-26",
    label: "Contribution",
    now: new Date("2026-07-26T12:00:00.000Z"),
  };

  it("normalizes entered INR amounts to paise using half-up rounding", () => {
    expect(
      validateCashEntryForm({
        ...baseInput,
        amount: "100.005",
      }),
    ).toEqual({
      errors: {},
      parsedAmount: 100.01,
    });
  });

  it("rejects positive amounts below one paise after normalization", () => {
    expect(
      validateCashEntryForm({
        ...baseInput,
        amount: "0.001",
      }),
    ).toEqual({
      errors: { amount: "Amount precision is limited to paise." },
      parsedAmount: 0,
    });
  });
});
