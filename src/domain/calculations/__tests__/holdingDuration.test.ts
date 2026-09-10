import {
  getHoldingDuration,
  INDIA_HOLDING_DURATION_RULE,
} from "../holdingDuration";
import type { Asset, Holding, OpeningPosition, Trade } from "@/src/types";

const asset: Asset = {
  id: "a",
  name: "Example",
  symbol: "EX",
  ticker: "EX.NS",
  currency: "INR",
  exchange: "NSE",
  assetClass: "stock",
  instrumentType: "stock",
};
const buy: Trade = {
  id: "b",
  assetId: "a",
  type: "buy",
  date: "2025-09-08",
  quantity: 1,
  pricePerUnit: 100,
  totalValue: 100,
};
const run = (
  asOf = "2026-09-08",
  trades: Trade[] = [buy],
  openingPositions: OpeningPosition[] = [],
  candidate = asset,
) => getHoldingDuration({ asset: candidate, trades, openingPositions, asOf });

describe("informational holding duration", () => {
  it.each([
    ["2026-09-07", false],
    ["2026-09-08", false],
    ["2026-09-09", true],
  ] as const)(
    "compares calendar boundary %s strictly",
    (asOf, beyondReference) => {
      expect(run(asOf)).toMatchObject({
        status: "available",
        anniversary: "2026-09-08",
        beyondReference,
      });
    },
  );
  it("handles leap anniversaries without adding a fixed 365 days", () => {
    expect(run("2025-02-28", [{ ...buy, date: "2024-02-29" }])).toMatchObject({
      anniversary: "2025-02-28",
      beyondReference: false,
    });
    expect(run("2025-03-01", [{ ...buy, date: "2024-02-29" }])).toMatchObject({
      beyondReference: true,
    });
    expect(run("2024-03-01", [{ ...buy, date: "2023-03-01" }])).toMatchObject({
      elapsedDays: 366,
      beyondReference: false,
    });
  });
  it.each(["crypto", "debt", "cash", "etf"] as const)(
    "does not infer tax treatment for %s",
    (assetClass) => {
      expect(
        run(undefined, [buy], [], { ...asset, assetClass, isTaxEligible: true })
          .status,
      ).toBe("unavailable");
    },
  );
  it("requires an explicit stock instrument, Indian exchange and native INR", () => {
    for (const change of [
      { instrumentType: undefined },
      { currency: "USD" as const },
      { exchange: undefined },
    ]) {
      expect(run(undefined, [buy], [], { ...asset, ...change }).status).toBe(
        "unavailable",
      );
    }
  });
  it("fails closed on multiple acquisitions, sales, transfers and aggregate openings", () => {
    expect(run(undefined, [buy, { ...buy, id: "second" }]).status).toBe(
      "unavailable",
    );
    expect(
      run(undefined, [buy, { ...buy, id: "sale", type: "sell" }]).status,
    ).toBe("unavailable");
    expect(
      run(undefined, [
        {
          id: "transfer",
          assetId: "a",
          type: "transferIn",
          date: buy.date,
          quantity: 1,
        },
      ]).status,
    ).toBe("unavailable");
    expect(
      run(
        undefined,
        [],
        [
          {
            id: "o",
            assetId: "a",
            quantity: 1,
            averageCostPrice: 100,
            date: buy.date,
            measuredAsOf: "2026-01-01",
          },
        ],
      ).status,
    ).toBe("unavailable");
  });
  it("does not derive a holding date from weighted-average accounting after a partial sale", () => {
    const duration = run(undefined, [
      { ...buy, quantity: 2, totalValue: 200 },
      {
        ...buy,
        id: "partial-sale",
        type: "sell",
        date: "2026-01-01",
        quantity: 1,
        totalValue: 120,
        pricePerUnit: 120,
      },
    ]);

    expect(duration).toMatchObject({
      status: "unavailable",
      reason: expect.stringContaining("Lot matching"),
    });
  });
  it("supports one dated opening but never substitutes its recording date for acquisition", () => {
    const opening: OpeningPosition = {
      id: "o",
      assetId: "a",
      quantity: 1,
      averageCostPrice: 100,
      date: buy.date,
    };
    expect(run(undefined, [], [opening]).status).toBe("available");
    expect(
      run(undefined, [], [{ ...opening, date: null, recordedOn: buy.date }])
        .status,
    ).toBe("unavailable");
  });
  it("rejects invalid dates and ignores future purchases rather than changing current duration", () => {
    expect(run("invalid").status).toBe("unavailable");
    expect(run(undefined, [{ ...buy, date: "2025-02-30" }]).status).toBe(
      "unavailable",
    );
    expect(
      run(undefined, [buy, { ...buy, id: "future", date: "2027-01-01" }]),
    ).toEqual(run());
    expect(run(undefined, []).status).toBe("unavailable");
  });
  it("uses the supplied as-of date and leaves unknown historical dates unavailable", () => {
    const asOf = "2026-09-08";
    expect(
      run(asOf, [
        { ...buy, date: asOf },
        {
          ...buy,
          id: "future-sale",
          type: "sell",
          date: "2026-09-09",
          pricePerUnit: 120,
          totalValue: 120,
        },
      ]),
    ).toMatchObject({
      status: "available",
      acquiredOn: asOf,
      elapsedDays: 0,
      observedOn: asOf,
    });
    expect(
      run(asOf, [], [
        {
          id: "unknown-opening",
          assetId: asset.id,
          quantity: 1,
          averageCostPrice: 100,
          date: null,
          recordedOn: asOf,
        },
      ]),
    ).toMatchObject({ status: "unavailable" });
  });
  it("records the rule source and removes legacy derived semantics", () => {
    expect(INDIA_HOLDING_DURATION_RULE).toMatchObject({
      jurisdiction: "India",
      rulesAsOf: "2026-09-08",
      months: 12,
    });
    expect(INDIA_HOLDING_DURATION_RULE.sourceUrl).toContain(
      "incometaxindia.gov.in",
    );
    const legacyKeys: Extract<
      keyof Holding,
      "heldDays" | "daysToLtcg" | "ltcgEligible"
    >[] = [];
    // Compile-time guard: restoring these public fields makes this assignment fail.
    const noLegacyKeys: never[] = legacyKeys;
    expect(noLegacyKeys).toEqual([]);
  });
});
