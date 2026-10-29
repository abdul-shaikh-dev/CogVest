import { buildPayoutInput, canRecordPayouts, draftNet, emptyPayoutDraft, payoutEffectCopy, payoutsSummary, reinvestmentBuyOptions } from "../payoutForm";
import type { Asset, BuyTrade, Distribution } from "@/src/types";

const now = new Date("2026-10-05T10:00:00Z");
const stock: Asset = { id: "stock", name: "Synthetic Bank", symbol: "SYN", ticker: "SYN.NS", currency: "INR", assetClass: "stock", exchange: "NSE" };
const draft = { ...emptyPayoutDraft(now), paidOn: "2026-06-01", gross: "100", tax: "10" };
const buy = (id: string, date: string): BuyTrade => ({ id, assetId: "stock", type: "buy", date, quantity: 1, pricePerUnit: 90, totalValue: 90 });

describe("payout form", () => {
  it("offers payouts only for INR assets that can pay them", () => {
    expect(canRecordPayouts(stock)).toBe(true);
    expect(canRecordPayouts({ ...stock, assetClass: "crypto" })).toBe(false);
    expect(canRecordPayouts({ ...stock, assetClass: "cash" })).toBe(false);
    expect(canRecordPayouts({ ...stock, currency: "USD" })).toBe(false);
  });

  it("builds a store input with a blank tax treated as none", () => {
    expect(buildPayoutInput({ ...draft, tax: "" }, { assetId: "stock", id: "div", now })).toEqual({ ok: true,
      input: { id: "div", assetId: "stock", paidOn: "2026-06-01", grossAmount: 100, taxWithheld: 0, treatment: "paidToCash" } });
    expect(draftNet(draft)).toBe(90);
  });

  it.each([
    [{ gross: "0" }, "gross"],
    [{ gross: "1.234" }, "gross"],
    [{ tax: "100" }, "tax"],
    [{ tax: "abc" }, "tax"],
    [{ paidOn: "2026-10-06" }, "paidOn"],
    [{ treatment: "reinvested" as const }, "linkedTradeId"],
  ])("rejects %j on the %s field", (change, field) => {
    const result = buildPayoutInput({ ...draft, ...change }, { assetId: "stock", id: "div", now });
    expect(result.ok === false && Object.keys(result.errors)).toEqual([field]);
  });

  it("links a reinvestment only to a later, unclaimed buy of the same asset", () => {
    const taken: Distribution = { id: "old", assetId: "stock", paidOn: "2026-01-01", grossAmount: 1, taxWithheld: 0,
      treatment: "reinvested", linkedTradeId: "b3", recordedAt: "x" };
    const trades = [buy("b1", "2026-05-01"), buy("b2", "2026-06-01"), buy("b3", "2026-07-01"), { ...buy("other", "2026-07-01"), assetId: "x" }];
    expect(reinvestmentBuyOptions(trades, "stock", "2026-06-01", [taken]).map((item) => item.value)).toEqual(["b2"]);
    expect(reinvestmentBuyOptions(trades, "stock", "2026-06-01", [taken], "old").map((item) => item.value)).toEqual(["b2", "b3"]);
  });

  it("explains the effect and summarises completeness", () => {
    expect(payoutEffectCopy(draft)).toMatch(/₹90.00 is added to your tracked Cash/);
    expect(payoutEffectCopy({ ...draft, treatment: "paidOutside" })).toMatch(/Cash is not changed/);
    expect(payoutsSummary([], undefined, "stock")).toBe("None recorded · not confirmed complete");
    expect(payoutsSummary([{ id: "d", assetId: "stock", paidOn: "2026-06-01", grossAmount: 1, taxWithheld: 0, treatment: "paidOutside", recordedAt: "x" }],
      { assetId: "stock", from: "2026-01-05", confirmedAt: "x" }, "stock")).toMatch(/^1 recorded · complete since /);
  });
});
