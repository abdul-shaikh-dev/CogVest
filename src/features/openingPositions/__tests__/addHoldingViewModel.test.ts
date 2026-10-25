import {
  formatSignedINR,
  getInstrumentOptions,
  getReviewQuoteSourceLabel,
  getSectorOptions,
  quoteSourceLabel,
} from "@/src/features/openingPositions/addHoldingViewModel";
import type { AssetLookupResult } from "@/src/services/assetLookup";
import type { Quote } from "@/src/types";

const quote = (overrides: Partial<Quote> = {}): Quote => ({
  asOf: "2026-10-01T10:00:00.000Z",
  assetId: "asset",
  currency: "INR",
  price: 100,
  source: "yahoo",
  ...overrides,
});

const lookupResult = { sourceLabel: "NSE" } as AssetLookupResult;

describe("review quote provenance", () => {
  const base = {
    currentPrice: "100",
    preservesProviderQuote: true,
  };

  it("marks an empty price as pending valuation", () => {
    expect(
      getReviewQuoteSourceLabel({ ...base, currentPrice: "  ", selectedLookupQuote: quote() }),
    ).toBe("Valuation pending");
  });

  it("names a live provider quote only while its price is unchanged", () => {
    expect(
      getReviewQuoteSourceLabel({
        ...base,
        selectedLookupQuote: quote(),
        selectedLookupResult: lookupResult,
      }),
    ).toBe("Live quote • NSE");
    expect(
      getReviewQuoteSourceLabel({
        ...base,
        preservesProviderQuote: false,
        selectedLookupQuote: quote(),
        selectedLookupResult: lookupResult,
      }),
    ).toBe("Manual price • NSE identity");
  });

  it("describes saved quotes by their source", () => {
    expect(
      getReviewQuoteSourceLabel({ ...base, selectedSavedQuote: quote({ source: "amfi" }) }),
    ).toBe("Saved live quote • AMFI");
    expect(
      getReviewQuoteSourceLabel({ ...base, selectedSavedQuote: quote({ source: "manual" }) }),
    ).toBe("Saved manual price");
    expect(
      getReviewQuoteSourceLabel({
        ...base,
        preservesProviderQuote: false,
        selectedSavedQuote: quote(),
      }),
    ).toBe("Manual price");
  });

  it("labels each quote provider", () => {
    expect(quoteSourceLabel(quote({ source: "yahoo" }))).toBe("Yahoo Finance");
    expect(quoteSourceLabel(quote({ source: "coingecko" }))).toBe("CoinGecko");
    expect(quoteSourceLabel(quote({ source: "manual" }))).toBe("manual");
  });
});

describe("classification options", () => {
  it("never offers PPF as a market instrument", () => {
    const values = getInstrumentOptions("debt", "other").map((option) => option.value);
    expect(values).not.toContain("ppf");
  });

  it("keeps an existing out-of-list instrument selectable", () => {
    const options = getInstrumentOptions("crypto", "mutualFund");
    expect(options.at(-1)).toEqual({ label: expect.any(String), value: "mutualFund" });
  });

  it("keeps an existing out-of-list sector selectable without duplicating listed ones", () => {
    const listed = getSectorOptions("other");
    expect(listed.filter((option) => option.value === "other")).toHaveLength(1);
    expect(getSectorOptions("unlisted" as never).at(-1)?.value).toBe("unlisted");
  });
});

describe("signed amounts", () => {
  it("adds a plus sign to gains only", () => {
    expect(formatSignedINR(1200)).toMatch(/^\+/);
    expect(formatSignedINR(-1200)).not.toMatch(/^\+/);
    expect(formatSignedINR(0)).not.toMatch(/^\+/);
  });
});
