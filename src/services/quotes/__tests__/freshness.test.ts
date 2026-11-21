import {
  AMFI_QUOTE_FRESHNESS_THRESHOLD_MS,
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

describe("market time and fetch time (#658)", () => {
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  const marketQuote = (asOf: string, fetchedAt: string): Quote => ({ ...quote("asset", "yahoo", asOf), fetchedAt });

  it("keeps a Friday close current when it was just fetched on Sunday", () => {
    expect(classifyQuoteFreshness(marketQuote(minutesAgo(2 * 24 * 60), minutesAgo(1)), now)).toBe("current");
  });

  it("marks a just-fetched price stale when its market time is over four days old", () => {
    expect(classifyQuoteFreshness(marketQuote(minutesAgo(5 * 24 * 60), minutesAgo(1)), now)).toBe("stale");
  });

  it("marks a recent market price stale when it was fetched over 15 minutes ago", () => {
    expect(classifyQuoteFreshness(marketQuote(minutesAgo(20), minutesAgo(16)), now)).toBe("stale");
  });

  it("treats a fetch time in the future as missing", () => {
    expect(classifyQuoteFreshness(marketQuote(minutesAgo(1), new Date(now.getTime() + 60_000).toISOString()), now)).toBe("missing");
  });
});

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

  it("uses daily freshness semantics for AMFI NAVs", () => {
    const boundary = new Date(
      now.getTime() - AMFI_QUOTE_FRESHNESS_THRESHOLD_MS,
    ).toISOString();
    const older = new Date(
      now.getTime() - AMFI_QUOTE_FRESHNESS_THRESHOLD_MS - 1,
    ).toISOString();

    expect(classifyQuoteFreshness(quote("current", "amfi", boundary), now)).toBe(
      "current",
    );
    expect(classifyQuoteFreshness(quote("stale", "amfi", older), now)).toBe(
      "stale",
    );
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

describe("AMFI NAVs published ahead for a weekend or holiday (#755)", () => {
  // Local times, so the check holds in any time zone: Friday 20 Nov 2026, 9 pm.
  const friday = new Date(2026, 10, 20, 21, 0);
  const nav = (date: string) => quote("liquid", "amfi", `${date}T00:00:00.000Z`);

  it("treats Saturday's and Sunday's NAVs, published on Friday, as current", () => {
    expect(classifyQuoteFreshness(nav("2026-11-21"), friday)).toBe("current");
    expect(classifyQuoteFreshness(nav("2026-11-22"), friday)).toBe("current");
  });

  it("treats a Monday holiday's NAV, three days ahead, as current", () => {
    expect(classifyQuoteFreshness(nav("2026-11-23"), friday)).toBe("current");
  });

  it("still marks a NAV dated more than three days ahead missing", () => {
    expect(classifyQuoteFreshness(nav("2026-11-24"), friday)).toBe("missing");
  });

  it("keeps today's NAV current before its UTC midnight has passed locally", () => {
    expect(classifyQuoteFreshness(nav("2026-11-21"), new Date(2026, 10, 21, 1, 0))).toBe("current");
  });

  it("keeps an exchange price dated in the future missing", () => {
    const ahead = { ...quote("stock", "yahoo", "2026-11-22T00:00:00.000Z"), fetchedAt: friday.toISOString() };
    expect(classifyQuoteFreshness(ahead, friday)).toBe("missing");
  });
});
