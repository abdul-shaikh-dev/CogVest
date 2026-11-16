import { remainingUnitsByAsset } from "@/src/domain/remainingUnits";
import { indicativeMarginUsdt } from "@/src/domain/usdmFutures";
import { xirrFlowTotals } from "@/src/domain/xirrSummary";
import type { Asset, Trade } from "@/src/types";

const asset = (id: string): Asset => ({
  assetClass: "stock", currency: "INR", exchange: "NSE", id, name: id, symbol: id, ticker: id,
});
const trade = (id: string, assetId: string, type: "buy" | "sell", quantity: number): Trade => ({
  assetId, date: "2026-04-01", id, pricePerUnit: 10, quantity, totalValue: 10 * quantity, type,
} as Trade);

describe("calculations moved out of screens (#666)", () => {
  it("works out remaining units for every asset", () => {
    const units = remainingUnitsByAsset({
      assets: [asset("a"), asset("b")],
      openingPositions: [],
      trades: [trade("t1", "a", "buy", 5), trade("t2", "a", "sell", 2), trade("t3", "b", "buy", 1)],
    });
    expect(Object.fromEntries(units)).toEqual({ a: 3, b: 1 });
  });

  it("gives an indicative margin only with a mark and leverage", () => {
    expect(indicativeMarginUsdt({ leverage: "3", notionalUsdt: "100" })).toBe("33.33");
    expect(indicativeMarginUsdt({ leverage: null, notionalUsdt: "100" })).toBeNull();
    expect(indicativeMarginUsdt({ leverage: "3", notionalUsdt: null })).toBeNull();
  });

  it("totals the flows behind a rate", () => {
    const flows = [
      { amountInr: -1000, source: "trade" },
      { amountInr: -500, source: "cash" },
      { amountInr: 200, source: "trade" },
      { amountInr: 1600, source: "terminal" },
    ];
    expect(xirrFlowTotals({ flows } as never)).toEqual({ count: 3, current: 1600, paidIn: 1500, returned: 200 });
  });
});
