import { buildAssetXirrInput, buildInvestmentsXirrInput, type AssetXirrInput, type InvestmentsXirrInput } from "../xirrInputs";
import type { Asset, BuyTrade, Distribution, ImportedTransactionProvenance, Quote, SellTrade } from "@/src/types";

const btc: Asset = { id: "btc", name: "Bitcoin", symbol: "BTC", ticker: "bitcoin", currency: "INR", assetClass: "crypto" };
const eth: Asset = { ...btc, id: "eth", name: "Ether", symbol: "ETH", ticker: "ethereum" };
const stock: Asset = { id: "stock", name: "Synthetic", symbol: "TEST", ticker: "TEST.NS", currency: "INR", assetClass: "stock" };
// Manual totals already include the fee: 2 x 500 + 10 and 1 x 700 - 5.
const buy: BuyTrade = { id: "buy", assetId: "btc", type: "buy", date: "2025-01-02", quantity: 2, pricePerUnit: 500, fees: 10, totalValue: 1010 };
const sell: SellTrade = { id: "sell", assetId: "btc", type: "sell", date: "2025-06-01", quantity: 1, pricePerUnit: 700, fees: 5, totalValue: 695 };
const quote = (overrides: Partial<Quote> = {}): Quote =>
  ({ assetId: "btc", asOf: "2025-12-30T10:00:00Z", currency: "INR", price: 900, source: "coingecko", ...overrides });
const imported = (overrides: Partial<ImportedTransactionProvenance> = {}): ImportedTransactionProvenance =>
  ({ importBatchId: "batch", originalRowNumber: 1, sourceFormat: "transactions-csv", sourceVersion: "1", ...overrides });

function assetInput(overrides: Partial<AssetXirrInput> = {}): AssetXirrInput {
  return {
    asset: btc, assetId: "btc", assets: [btc, eth, stock], trades: [buy, sell], openingPositions: [],
    quote: quote(), distributions: [], coverage: undefined, endDate: "2026-01-01", ...overrides,
  };
}
function investmentsInput(overrides: Partial<InvestmentsXirrInput> = {}): InvestmentsXirrInput {
  return {
    assets: [btc, eth, stock], trades: [buy, sell], openingPositions: [], quotes: { btc: quote() },
    distributions: [], distributionCoverage: [], ppfAccounts: [], ppfLedgerEntries: [], epf: { accounts: [], events: [] }, futuresAccounts: [], cashEntries: [],
    endDate: "2026-01-01", today: "2026-01-01", valuationTime: "2026-01-01T12:00:00Z", ...overrides,
  };
}
const reasons = (result: ReturnType<typeof buildAssetXirrInput>) =>
  result.status === "unavailable" ? result.reasons.map(({ reason }) => reason) : [];

describe("per-asset XIRR input", () => {
  it("uses manual totals as recorded, without counting the fee twice", () => {
    expect(buildAssetXirrInput(assetInput())).toEqual({
      status: "ready",
      flows: [
        { date: "2025-01-02", amountInr: "-1010", source: "trade", id: "buy" },
        { date: "2025-06-01", amountInr: "695", source: "trade", id: "sell" },
        { date: "2026-01-01", amountInr: "900", source: "terminal", id: "btc" },
      ],
      startDate: "2025-01-02", endDate: "2026-01-01", valueAsOf: "2025-12-30", limitations: [], includedAssetIds: ["btc"],
    });
  });

  it("adds imported fees and taxes to the gross total, and labels imports without them", () => {
    const result = buildAssetXirrInput(assetInput({ trades: [
      { ...buy, fees: undefined, totalValue: 1000, importProvenance: imported({ fees: 7, taxes: 3 }) },
      { ...sell, fees: undefined, totalValue: 700, importProvenance: imported({ fees: 4 }) },
      { ...buy, id: "plain", date: "2025-03-01", fees: undefined, totalValue: 1000, importProvenance: imported() },
    ] }));
    expect(result.status === "ready" && result.flows.map(({ id, amountInr }) => [id, amountInr])).toEqual([
      ["buy", "-1010"], ["plain", "-1000"], ["sell", "696"], ["btc", "2700"],
    ]);
    expect(result.status === "ready" && result.limitations).toEqual([{ assetId: "btc", limitation: "fees-not-in-source", recordId: "plain" }]);
  });

  it("measures a fully sold asset without a terminal value or a price", () => {
    const result = buildAssetXirrInput(assetInput({ trades: [buy, { ...sell, quantity: 2, totalValue: 1395 }], quote: undefined }));
    expect(result).toMatchObject({ status: "ready", valueAsOf: null });
    expect(result.status === "ready" && result.flows.map(({ source }) => source)).toEqual(["trade", "trade"]);
  });

  it("ignores trades after the end date", () => {
    const result = buildAssetXirrInput(assetInput({ trades: [buy, { ...sell, date: "2026-02-01" }] }));
    expect(result.status === "ready" && result.flows.map(({ id, amountInr }) => [id, amountInr])).toEqual([["buy", "-1010"], ["btc", "1800"]]);
  });

  it("blocks assets that can pay distributions until distributions are recorded (D1)", () => {
    const result = buildAssetXirrInput(assetInput({ asset: stock, assetId: "stock", trades: [{ ...buy, assetId: "stock" }], quote: quote({ assetId: "stock" }) }));
    expect(reasons(result)).toEqual(["distributions-not-recorded"]);
  });

  describe("payouts (D1-D3)", () => {
    const stockBuy: BuyTrade = { ...buy, id: "stock-buy", assetId: "stock" };
    const stockInput = (overrides: Partial<AssetXirrInput> = {}) => assetInput({
      asset: stock, assetId: "stock", trades: [stockBuy], quote: quote({ assetId: "stock" }),
      coverage: { assetId: "stock", from: "2025-01-02", confirmedAt: "2025-12-31T00:00:00Z" }, ...overrides,
    });
    const payout = (overrides: Partial<Distribution> = {}): Distribution => ({
      id: "div", assetId: "stock", paidOn: "2025-08-01", grossAmount: 50, taxWithheld: 5,
      treatment: "paidOutside", recordedAt: "2025-08-02T00:00:00Z", ...overrides,
    });

    it("needs ongoing coverage from the first purchase, even when none were paid", () => {
      expect(buildAssetXirrInput(stockInput())).toMatchObject({ status: "ready" });
      expect(reasons(buildAssetXirrInput(stockInput({ coverage: undefined })))).toEqual(["distributions-not-recorded"]);
      expect(reasons(buildAssetXirrInput(stockInput({ coverage: { assetId: "stock", from: "2025-01-03", confirmedAt: "x" } }))))
        .toEqual(["distributions-not-recorded"]);
    });

    it.each(["paidToCash", "paidOutside", "reinvested"] as const)("counts a %s payout once, net of tax, on its date", (treatment) => {
      const result = buildAssetXirrInput(stockInput({ distributions: [payout({ treatment }), payout({ id: "other", assetId: "btc" })] }));
      expect(result.status === "ready" && result.flows.map(({ id, amountInr, source }) => [id, amountInr, source])).toEqual([
        ["stock-buy", "-1010", "trade"], ["div", "45", "distribution"], ["stock", "1800", "terminal"],
      ]);
    });

    it("ignores payouts after the end date and rejects one before any purchase", () => {
      expect(buildAssetXirrInput(stockInput({ distributions: [payout({ paidOn: "2026-02-01" })] }))).toMatchObject({ status: "ready" });
      expect(buildAssetXirrInput(stockInput({ distributions: [payout({ paidOn: "2024-12-01" })] })))
        .toEqual({ status: "unavailable", reasons: [{ assetId: "stock", reason: "payout-before-purchase", recordId: "div" }] });
    });

    it("includes payouts in the Investments series", () => {
      const result = buildInvestmentsXirrInput(investmentsInput({
        trades: [buy, sell, stockBuy], quotes: { btc: quote(), stock: quote({ assetId: "stock" }) },
        distributions: [payout()], distributionCoverage: [{ assetId: "stock", from: "2024-01-01", confirmedAt: "x" }],
      }));
      expect(result.status === "ready" && result.flows.map(({ id, amountInr }) => [id, amountInr])).toEqual([
        ["buy", "-1010"], ["stock-buy", "-1010"], ["sell", "695"], ["div", "45"], ["portfolio", "2700"],
      ]);
    });
  });

  it("blocks unknown opening history, valueless transfers and demerger members", () => {
    expect(reasons(buildAssetXirrInput(assetInput({ openingPositions: [{ id: "open", assetId: "btc", quantity: 1, averageCostPrice: 400, date: null }] }))))
      .toEqual(["opening-history"]);
    expect(reasons(buildAssetXirrInput(assetInput({ trades: [buy, { id: "in", assetId: "btc", type: "transferIn", date: "2025-02-01", quantity: 1, acquisitionCostPerUnit: 400 }] }))))
      .toEqual(["transfer-without-value"]);
    const parent = { ...btc, demerger: { childAssetId: "eth", eventId: "event" } };
    expect(reasons(buildAssetXirrInput(assetInput({ asset: parent, assets: [parent, eth] })))).toEqual(["demerger"]);
    expect(reasons(buildAssetXirrInput(assetInput({ asset: eth, assetId: "eth", assets: [parent, eth], trades: [{ ...buy, assetId: "eth" }] }))))
      .toEqual(["demerger"]);
  });

  it("requires an INR price no more than seven days before the end date (D7)", () => {
    expect(buildAssetXirrInput(assetInput({ quote: quote({ asOf: "2025-12-25" }) }))).toMatchObject({ status: "ready", valueAsOf: "2025-12-25" });
    expect(reasons(buildAssetXirrInput(assetInput({ quote: quote({ asOf: "2025-12-24" }) })))).toEqual(["stale-quote"]);
    expect(reasons(buildAssetXirrInput(assetInput({ quote: quote({ asOf: "2026-01-02" }) })))).toEqual(["quote-after-end"]);
    expect(reasons(buildAssetXirrInput(assetInput({ quote: quote({ currency: "USD" }) })))).toEqual(["quote-currency"]);
    expect(reasons(buildAssetXirrInput(assetInput({ quote: undefined })))).toEqual(["missing-quote"]);
    expect(reasons(buildAssetXirrInput(assetInput({ quote: quote({ price: 0 }) })))).toEqual(["missing-quote"]);
    const manual = buildAssetXirrInput(assetInput({ quote: quote({ source: "manual" }) }));
    expect(manual.status === "ready" && manual.limitations).toEqual([{ assetId: "btc", limitation: "manual-price" }]);
  });

  it("reports every invalid record instead of producing a partial series", () => {
    const result = buildAssetXirrInput(assetInput({ trades: [
      { ...buy, id: "dup" }, { ...buy, id: "dup" }, { ...buy, id: "bad-date", date: "not a date" },
      { ...sell, id: "zero", totalValue: 0 }, { ...sell, id: "oversold", quantity: 5, totalValue: 3495 },
    ] }));
    expect(result.status === "unavailable" && result.reasons).toEqual(expect.arrayContaining([
      { assetId: "btc", reason: "duplicate-trade", recordId: "dup" },
      { assetId: "btc", reason: "invalid-trade", recordId: "bad-date" },
      { assetId: "btc", reason: "invalid-trade", recordId: "zero" },
      { assetId: "btc", reason: "no-purchases" },
      { assetId: "btc", reason: "units-mismatch" },
    ]));
  });

  it("rejects a sale dated before the units it sells, even when the final quantity balances", () => {
    const early = { ...sell, date: "2024-12-01" };
    expect(reasons(buildAssetXirrInput(assetInput({ trades: [buy, early] })))).toEqual(["units-mismatch"]);
  });

  it("blocks foreign, Cash and missing assets and an invalid end date", () => {
    expect(reasons(buildAssetXirrInput(assetInput({ asset: { ...btc, currency: "USD" } })))).toEqual(["foreign-currency"]);
    expect(reasons(buildAssetXirrInput(assetInput({ asset: { ...btc, assetClass: "cash" } })))).toEqual(["cash-asset", "distributions-not-recorded"]);
    expect(reasons(buildAssetXirrInput(assetInput({ asset: undefined })))).toEqual(["missing-asset"]);
    expect(reasons(buildAssetXirrInput(assetInput({ endDate: "2026-1-1" })))).toEqual(["invalid-end-date"]);
  });

  it("does not mutate its input", () => {
    const input = assetInput();
    const before = JSON.stringify(input);
    buildAssetXirrInput(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("Investments XIRR input", () => {
  const ethBuy: BuyTrade = { ...buy, id: "eth-buy", assetId: "eth", date: "2025-03-01", quantity: 4, pricePerUnit: 100, fees: 0, totalValue: 400 };

  it("combines every asset's flows with one terminal value dated at the end date", () => {
    const result = buildInvestmentsXirrInput(investmentsInput({
      trades: [buy, sell, ethBuy], quotes: { btc: quote(), eth: quote({ assetId: "eth", asOf: "2025-12-28", price: 150 }) },
    }));
    expect(result).toEqual({
      status: "ready",
      flows: [
        { date: "2025-01-02", amountInr: "-1010", source: "trade", id: "buy" },
        { date: "2025-03-01", amountInr: "-400", source: "trade", id: "eth-buy" },
        { date: "2025-06-01", amountInr: "695", source: "trade", id: "sell" },
        { date: "2026-01-01", amountInr: "1500", source: "terminal", id: "portfolio" },
      ],
      startDate: "2025-01-02", endDate: "2026-01-01", valueAsOf: "2025-12-28", limitations: [], includedAssetIds: ["btc", "eth"],
    });
  });

  it("keeps fully sold assets in the series", () => {
    const result = buildInvestmentsXirrInput(investmentsInput({
      trades: [buy, { ...sell, quantity: 2, totalValue: 1395 }], quotes: {},
    }));
    expect(result).toMatchObject({ status: "ready", valueAsOf: null, includedAssetIds: ["btc"] });
    expect(result.status === "ready" && result.flows.map(({ amountInr }) => amountInr)).toEqual(["-1010", "1395"]);
  });

  it("is unavailable when any asset is, and never drops it silently", () => {
    const result = buildInvestmentsXirrInput(investmentsInput({
      trades: [buy, sell, { ...buy, id: "stock-buy", assetId: "stock" }],
      quotes: { btc: quote(), stock: quote({ assetId: "stock" }) },
    }));
    // Without payout coverage the stock is blocked, and so is the whole series.
    expect(result).toEqual({ status: "unavailable", reasons: [{ assetId: "stock", reason: "distributions-not-recorded" }] });
  });

  it("blocks an empty portfolio (PPF, EPF and Futures are covered in xirrAccountFlows.test.ts)", () => {
    expect(buildInvestmentsXirrInput(investmentsInput({ trades: [] })))
      .toEqual({ status: "unavailable", reasons: [{ assetId: "portfolio", reason: "no-assets" }] });
  });

  it("leaves out an asset whose only activity is after the end date", () => {
    const result = buildInvestmentsXirrInput(investmentsInput({ trades: [buy, sell, { ...ethBuy, date: "2026-02-01" }] }));
    expect(result).toMatchObject({ status: "ready", includedAssetIds: ["btc"] });
  });

  it("counts an asset that only has an opening position", () => {
    const result = buildInvestmentsXirrInput(investmentsInput({
      openingPositions: [{ id: "open", assetId: "eth", quantity: 1, averageCostPrice: 100, date: "2024-01-01" }],
    }));
    expect(result).toEqual({ status: "unavailable", reasons: [
      { assetId: "eth", reason: "opening-history", recordId: "open" },
      { assetId: "eth", reason: "no-purchases" },
    ] });
  });
});
