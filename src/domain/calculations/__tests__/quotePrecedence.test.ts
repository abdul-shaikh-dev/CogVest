import { calculateHoldings } from "@/src/domain/calculations";
import { withQuoteMetadata } from "@/src/hooks/useQuoteRefresh";
import type { Asset, OpeningPosition, Quote } from "@/src/types";

// #717: a manual price saved after the cached quote wins; an older one does not.
const now = new Date("2026-11-10T12:00:00Z");
const asset: Asset = {
  assetClass: "stock", currency: "INR", exchange: "NSE", id: "stock", name: "Suspended",
  symbol: "SUS", ticker: "SUS.NS",
};
const staleQuote: Quote = {
  asOf: "2026-03-02T10:00:00.000Z", assetId: asset.id, currency: "INR", dayChangePct: 2, price: 150, source: "yahoo",
};
const position = (asOf: string | null): OpeningPosition => ({
  assetId: asset.id, averageCostPrice: 100, date: "2026-01-05", id: "op", quantity: 10,
  manualValuation: { asOf, currency: "INR", price: 20, provenance: asOf ? "user" : "legacy", source: "manual" },
} as OpeningPosition);
const holdingFor = (openingPosition: OpeningPosition, quote: Quote | null = staleQuote) => {
  const quoteCache = quote ? { [asset.id]: quote } : {};
  const holdings = calculateHoldings({ assets: [asset], now, openingPositions: [openingPosition], quoteCache, trades: [] });
  return withQuoteMetadata(holdings, quoteCache)[0];
};

describe("manual price versus cached quote (#717)", () => {
  it("uses a manual price saved after a stale fetched quote, and labels it manual", () => {
    const holding = holdingFor(position("2026-11-10T09:00:00.000Z"));

    expect(holding.currentPrice).toBe(20);
    expect(holding.currentValue).toBe(200);
    expect(holding.valuation).toMatchObject({ asOf: "2026-11-10T09:00:00.000Z", source: "manual", status: "manual" });
    expect(holding).toMatchObject({ lastUpdated: "2026-11-10T09:00:00.000Z", quoteSource: "manual" });
    expect(holding.dayChangePct).toBeUndefined();
  });

  it("keeps a fetched quote that is newer than the manual price", () => {
    const holding = holdingFor(position("2026-02-01T09:00:00.000Z"));

    expect(holding.currentPrice).toBe(150);
    expect(holding.valuation).toMatchObject({ source: "yahoo", status: "fetched" });
    expect(holding).toMatchObject({ dayChangePct: 2, lastUpdated: staleQuote.asOf, quoteSource: "yahoo" });
  });

  it("keeps the quote when the manual price has no date or the same instant", () => {
    expect(holdingFor(position(null)).currentPrice).toBe(150);
    expect(holdingFor(position(staleQuote.asOf)).currentPrice).toBe(150);
  });

  it("still falls back to the manual price when there is no quote", () => {
    expect(holdingFor(position("2026-02-01T09:00:00.000Z"), null).valuation)
      .toMatchObject({ price: 20, status: "manual" });
  });
});
