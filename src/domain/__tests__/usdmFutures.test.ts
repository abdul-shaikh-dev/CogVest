import {
  replayUsdmFutures,
  type UsdmFuturesAccount,
  type UsdmFuturesExecution,
} from "@/src/domain/usdmFutures";

const openingAt = "2026-01-01T00:00:00Z";
const asOf = "2026-02-01T00:00:00Z";
const currentAt = "2026-01-31T23:00:00Z";
const base: UsdmFuturesAccount = {
  id: "futures-main",
  settlementAsset: "USDT",
  marginMode: "cross",
  positionMode: "one-way",
  openingAt,
  openingWalletUsdt: "1000",
  events: [],
};
const execution = (id: string, side: "buy" | "sell", quantity: string, price: string, at = currentAt): UsdmFuturesExecution => ({
  type: "execution", id, at, contract: "BTCUSDT", side, quantity, price, feeUsdt: "0.001",
});
const rate = { inrPerUsdt: "90.125", observedAt: currentAt, source: "manual" };
const marks = [{ contract: "BTCUSDT", priceUsdt: "120", observedAt: currentAt, source: "manual" }];
const replay = (account: UsdmFuturesAccount, options: Partial<Parameters<typeof replayUsdmFutures>[1]> = {}) =>
  replayUsdmFutures(account, { asOf, marks, inrRate: rate, walletReconciled: true, ...options });

describe("USDT cross-margin one-way futures replay", () => {
  it("derives long partial-close P&L and values equity, never notional, in INR", () => {
    const result = replay({ ...base, events: [execution("open", "buy", "2", "100"), execution("close", "sell", "0.5", "110")] });
    expect(result.walletUsdt).toBe("1004.998");
    expect(result.realizedPnlUsdt).toBe("5");
    expect(result.positions[0]).toMatchObject({ signedQuantity: "1.5", unrealizedPnlUsdt: "30", notionalUsdt: "180" });
    expect(result.equityUsdt).toBe("1034.998");
    expect(result.equityInr).toBe("93279.19");
  });

  it("preserves closed short cycles and fees without needing a mark", () => {
    const events = [
      execution("a", "sell", "1", "120", "2026-01-02T00:00:00Z"),
      execution("b", "buy", "1", "100", "2026-01-03T00:00:00Z"),
      execution("c", "buy", "2", "80", "2026-01-04T00:00:00Z"),
      execution("d", "sell", "2", "90", "2026-01-05T00:00:00Z"),
    ];
    const result = replay({ ...base, events }, { marks: [] });
    expect(result.positions[0]).toMatchObject({ signedQuantity: "0", realizedPnlUsdt: "40", notionalUsdt: null });
    expect(result.walletUsdt).toBe("1039.996");
    expect(result.equityUsdt).toBe("1039.996");
  });

  it("keeps sub-cent funding, fees and transfer boundaries separate", () => {
    const result = replay({ ...base, events: [
      { type: "funding", id: "fund", at: currentAt, contract: "BTCUSDT", amountUsdt: "-0.00000001" },
      { type: "transfer", id: "spot", at: currentAt, amountUsdt: "100", transferBoundary: "internal" },
      { type: "transfer", id: "deposit", at: currentAt, amountUsdt: "50", transferBoundary: "external" },
    ] }, { marks: [] });
    expect(result.walletUsdt).toBe("1149.99999999");
    expect(result.fundingUsdt).toBe("-0.00000001");
    expect(result.internalTransfersUsdt).toBe("100");
    expect(result.externalTransfersUsdt).toBe("50");
  });

  it("refuses to publish INR when coverage, mark or rate is missing or stale", () => {
    const account = { ...base, events: [execution("a", "buy", "1", "100")] };
    expect(replay(account, { marks: [] })).toMatchObject({ valuationStatus: "missing-mark", equityInr: null });
    expect(replay(account, { marks: [{ ...marks[0], observedAt: openingAt }] })).toMatchObject({ valuationStatus: "stale-mark", equityInr: null });
    expect(replay(account, { walletReconciled: false })).toMatchObject({ valuationStatus: "unreconciled", equityInr: null });
    expect(replay(account, { inrRate: undefined })).toMatchObject({ valuationStatus: "missing-rate", equityInr: null });
    expect(replay(account, { inrRate: { ...rate, observedAt: openingAt } })).toMatchObject({ valuationStatus: "stale-rate", equityInr: null });
  });

  it("does not count pre-cutover trades again", () => {
    expect(() => replay({ ...base, events: [execution("old", "buy", "1", "100", "2025-12-31T00:00:00Z")] })).toThrow("outside the wallet replay window");
  });

  it("rejects impossible dates rather than normalizing execution history", () => {
    expect(() => replay({ ...base, events: [execution("bad", "buy", "1", "100", "2026-02-30T00:00:00Z")] })).toThrow("ISO timestamp");
  });

  it("rejects a reversal, duplicate ID, unsupported precision and wrong currency", () => {
    expect(() => replay({ ...base, events: [execution("a", "buy", "1", "100"), execution("b", "sell", "2", "100")] })).toThrow("Reversal");
    expect(() => replay({ ...base, events: [execution("a", "buy", "1", "100"), execution("a", "sell", "1", "100")] })).toThrow("IDs must be unique");
    expect(() => replay({ ...base, events: [execution("a", "buy", "0.000000001", "100")] })).toThrow("at most 8 places");
    expect(() => replay({ ...base, settlementAsset: "USDC" as "USDT" })).toThrow("Only cross-margin");
  });

  it("preserves two legitimate identical fills with distinct IDs", () => {
    const result = replay({ ...base, events: [execution("a", "buy", "1", "100"), execution("b", "buy", "1", "100")] });
    expect(result.positions[0].signedQuantity).toBe("2");
    expect(result.feesUsdt).toBe("0.002");
  });

  it("revalues unchanged native wallet equity at a different explicit INR rate", () => {
    const oldRate = replay(base, { marks: [], inrRate: rate });
    const newRate = replay(base, { marks: [], inrRate: { ...rate, inrPerUsdt: "91.125" } });
    expect(oldRate.equityUsdt).toBe(newRate.equityUsdt);
    expect(oldRate.equityInr).toBe("90125.00");
    expect(newRate.equityInr).toBe("91125.00");
  });

  it("recomputes corrected partial closes from raw execution records", () => {
    const open = execution("open", "buy", "2", "100");
    const first = replay({ ...base, events: [open, execution("close", "sell", "0.5", "110")] });
    const corrected = replay({ ...base, events: [open, execution("close", "sell", "1", "110")] });
    expect(first.realizedPnlUsdt).toBe("5");
    expect(corrected.realizedPnlUsdt).toBe("10");
    expect(corrected.positions[0].signedQuantity).toBe("1");
  });
});
