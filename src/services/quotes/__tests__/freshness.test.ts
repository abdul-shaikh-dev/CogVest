import {
  classifyQuoteFreshness,
  QUOTE_FRESHNESS_THRESHOLD_MS,
  summarizeQuoteFreshness,
} from "@/src/services/quotes";
import type { Quote } from "@/src/types";

const now = new Date("2026-07-26T10:30:00.000Z");

function quote(
  assetId: string,
  source: Quote["source"],
  asOf: string,
): Quote {
  return {
    asOf,
    assetId,
    currency: "INR",
    price: 100,
    source,
  };
}

describe("quote freshness", () => {
  it("uses one inclusive 15-minute threshold for live quotes", () => {
    const boundary = new Date(
      now.getTime() - QUOTE_FRESHNESS_THRESHOLD_MS,
    ).toISOString();
    const older = new Date(
      now.getTime() - QUOTE_FRESHNESS_THRESHOLD_MS - 1,
    ).toISOString();

    expect(classifyQuoteFreshness(quote("current", "yahoo", boundary), now)).toBe(
      "current",
    );
    expect(classifyQuoteFreshness(quote("stale", "coingecko", older), now)).toBe(
      "stale",
    );
  });

  it("classifies manual quotes by provenance regardless of age", () => {
    expect(
      classifyQuoteFreshness(
        quote("manual", "manual", "2020-01-01T00:00:00.000Z"),
        now,
      ),
    ).toBe("manual");
  });

  it("treats absent or invalid live quotes as missing", () => {
    expect(classifyQuoteFreshness(undefined, now)).toBe("missing");
    expect(
      classifyQuoteFreshness(quote("invalid", "yahoo", "not-a-date"), now),
    ).toBe("missing");
    expect(
      classifyQuoteFreshness(
        quote("future", "yahoo", "2026-07-26T10:31:00.000Z"),
        now,
      ),
    ).toBe("missing");
  });

  it("reports every held asset and marks mixed freshness as partial", () => {
    const summary = summarizeQuoteFreshness(
      ["current", "stale", "manual", "missing"],
      {
        current: quote("current", "yahoo", "2026-07-26T10:20:00.000Z"),
        manual: quote("manual", "manual", "2020-01-01T00:00:00.000Z"),
        stale: quote("stale", "coingecko", "2026-07-26T10:00:00.000Z"),
      },
      now,
    );

    expect(summary).toEqual({
      current: 1,
      manual: 1,
      missing: 1,
      stale: 1,
      status: "partial",
      total: 4,
    });
  });

  it("does not let one current quote mask stale or missing holdings", () => {
    expect(
      summarizeQuoteFreshness(
        ["current", "stale", "missing"],
        {
          current: quote("current", "yahoo", "2026-07-26T10:29:00.000Z"),
          stale: quote("stale", "yahoo", "2026-07-25T10:00:00.000Z"),
        },
        now,
      ).status,
    ).toBe("partial");
  });
});
