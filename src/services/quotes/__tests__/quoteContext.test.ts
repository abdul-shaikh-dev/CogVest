import { calculateHoldings } from "@/src/domain/calculations";
import { getHoldingQuoteContext } from "@/src/services/quotes";
import type { Asset, OpeningPosition, Quote } from "@/src/types";

const asset: Asset = {
  assetClass: "stock",
  currency: "INR",
  id: "asset",
  name: "Example",
  symbol: "EXAMPLE",
  ticker: "EXAMPLE.NS",
};
const position: OpeningPosition = {
  assetId: asset.id,
  averageCostPrice: 100,
  date: "2026-05-01",
  id: "opening",
  quantity: 2,
};

function holdingFor(quote?: Quote) {
  return calculateHoldings({
    assets: [asset],
    openingPositions: [position],
    quoteCache: quote ? { [asset.id]: quote } : {},
    trades: [],
    now: new Date("2026-05-20T10:10:00.000Z"),
  })[0];
}

function quote(asOf: string, source: Quote["source"] = "yahoo"): Quote {
  return { asOf, assetId: asset.id, currency: "INR", price: 125, source };
}

describe("getHoldingQuoteContext", () => {
  it.each([
    ["current", quote("2026-05-20T10:05:00.000Z"), /^Fresh · Yahoo Finance · as of/],
    ["stale", quote("2026-05-19T10:05:00.000Z"), /^Stale · Yahoo Finance · as of/],
    ["manual", quote("2026-05-20", "manual"), /^Manual price · recorded/],
  ] as const)("labels a %s quote beside the value", (freshness, savedQuote, label) => {
    expect(
      getHoldingQuoteContext(
        holdingFor(savedQuote),
        savedQuote,
        new Date("2026-05-20T10:10:00.000Z"),
      ),
    ).toMatchObject({ freshness, label: expect.stringMatching(label) });
  });

  it("labels a holding without a usable quote as unavailable", () => {
    expect(getHoldingQuoteContext(holdingFor(), undefined)).toEqual({
      asOf: null,
      freshness: "missing",
      label: "Unavailable · no saved quote",
      source: null,
    });
  });

  it("does not throw when persisted quote provenance has an invalid date", () => {
    const invalidQuote = quote("not-a-date", "manual");
    expect(getHoldingQuoteContext(holdingFor(quote("2026-05-20T10:05:00.000Z")), invalidQuote)).toMatchObject({
      freshness: "manual",
      label: "Manual price · date unavailable",
    });
  });
});
