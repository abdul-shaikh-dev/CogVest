import { getBehaviorInsightDetails } from "../behaviorInsightDetails";
import type { Asset, Trade } from "@/src/types";

const assets: Asset[] = [
  {
    id: "asset",
    name: "Example",
    symbol: "EX",
    ticker: "EX.NS",
    currency: "INR",
    assetClass: "stock",
  },
];
const buy: Trade = {
  id: "buy",
  assetId: "asset",
  type: "buy",
  date: "2026-01-01",
  quantity: 5,
  totalValue: 500,
  pricePerUnit: 100,
  conviction: 4,
  intendedHoldDays: 30,
};
const project = (trades: Trade[], sourceAssets = assets) =>
  getBehaviorInsightDetails({
    assets: sourceAssets,
    trades,
    openingPositions: [],
    asOf: "2026-09-08",
  });

describe("insight evidence projection", () => {
  it("keeps insufficient states typed without manufacturing observations", () => {
    expect(project([]).map((item) => item.availability)).toEqual([
      "insufficientData",
      "insufficientData",
      "insufficientData",
    ]);
    expect(project([]).every((item) => item.records.length === 0)).toBe(true);
  });
  it("lists only contributing sales for patience and windowed trades for frequency", () => {
    const trades: Trade[] = [
      buy,
      ...[1, 2, 3].map((i): Trade => ({
        id: `sale-${i}`,
        assetId: "asset",
        type: "sell",
        date: `2026-08-0${i}`,
        quantity: 1,
        pricePerUnit: 110,
        totalValue: 110,
      })),
    ];
    const details = project(trades);
    expect(details[1].availability).toBe("available");
    expect(details[1].records.map((record) => record.id)).toEqual([
      "trade:sale-3",
      "trade:sale-2",
      "trade:sale-1",
    ]);
    expect(details[2].records).toHaveLength(3);
    expect(details[2].records.some((record) => record.id === "trade:buy")).toBe(
      false,
    );
  });
  it("excludes future and orphaned records and reflects current asset names", () => {
    const trades: Trade[] = [
      buy,
      { ...buy, id: "future", date: "2027-01-01" },
      { ...buy, id: "orphan", assetId: "missing" },
    ];
    expect(project(trades)[0].records.map((record) => record.id)).toEqual([
      "trade:buy",
    ]);
    expect(
      project(trades, [{ ...assets[0], name: "Corrected" }])[0].records[0]
        .assetName,
    ).toBe("Corrected");
    expect(project(trades, [])[0].records).toEqual([]);
  });
  it("allows a zero-activity observation when older history establishes coverage", () => {
    const frequency = project([buy])[2];
    expect(frequency.availability).toBe("available");
    expect(frequency.records).toEqual([]);
    expect(frequency.facts.find((fact) => fact.label === "Buys")?.value).toBe(
      0,
    );
  });
});
