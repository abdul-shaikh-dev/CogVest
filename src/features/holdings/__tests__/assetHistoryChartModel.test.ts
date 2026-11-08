import type { AssetHistoryPoint } from "@/src/domain/calculations/assetHistory";

import {
  buildAssetHistoryChartModel,
  getVisiblePriceScale,
  nearestObservationIndex,
} from "../assetHistoryChartModel";

const day = (date: string) => Date.parse(`${date}T12:00:00Z`);
const price = (date: string, value: number, holdingValue: number | null = null): AssetHistoryPoint => ({
  date,
  holdingValue,
  price: value,
});

describe("buildAssetHistoryChartModel", () => {
  it("maps observed dates to calendar time and keeps source values", () => {
    const model = buildAssetHistoryChartModel({
      crypto: false,
      holdingSafe: true,
      mode: "price",
      points: [price("2026-01-01", 100), price("2026-01-02", 101), price("2026-01-05", 102)],
    });

    expect(model.data).toEqual([
      { value: 100, x: day("2026-01-01") },
      { value: 101, x: day("2026-01-02") },
      { value: 102, x: day("2026-01-05") },
    ]);
    expect(model.segments).toEqual([[0, 2]]);
    expect(model.xTicks).toEqual([day("2026-01-01"), day("2026-01-05")]);
  });

  it("breaks the line across a missing-date gap instead of joining it", () => {
    const stock = buildAssetHistoryChartModel({
      crypto: false,
      holdingSafe: true,
      mode: "price",
      points: [price("2026-01-01", 100), price("2026-01-02", 101), price("2026-01-10", 105), price("2026-01-11", 106)],
    });
    expect(stock.segments).toEqual([[0, 1], [2, 3]]);

    // Crypto trades daily, so even a two-day hole is a gap.
    const crypto = buildAssetHistoryChartModel({
      crypto: true,
      holdingSafe: true,
      mode: "price",
      points: [price("2026-01-01", 100), price("2026-01-03", 101)],
    });
    expect(crypto.segments).toEqual([[0, 0], [1, 1]]);
  });

  it("starts holding value at zero and breaks it where ownership is unknown", () => {
    const model = buildAssetHistoryChartModel({
      crypto: false,
      holdingSafe: true,
      mode: "holdingValue",
      points: [
        price("2026-01-01", 100, 1000),
        price("2026-01-02", 101, null),
        price("2026-01-05", 102, 1020),
        price("2026-01-06", 103, 1030),
      ],
    });

    expect(model.data.map((datum) => datum.value)).toEqual([1000, 1020, 1030]);
    expect(model.segments).toEqual([[0, 0], [1, 2]]);
    expect(model.yDomain[0]).toBe(0);
  });

  it("withholds unverified holding value but keeps price", () => {
    const points = [price("2026-01-01", 100, 1000), price("2026-01-02", 101, 1010)];
    expect(buildAssetHistoryChartModel({ crypto: false, holdingSafe: false, mode: "holdingValue", points }).data).toEqual([]);
    expect(buildAssetHistoryChartModel({ crypto: false, holdingSafe: false, mode: "price", points }).data).toHaveLength(2);
  });

  it("draws at most 500 observations and keeps both endpoints", () => {
    const points = Array.from({ length: 3653 }, (_, index) =>
      price(new Date(Date.UTC(2016, 0, 1 + index)).toISOString().slice(0, 10), 100 + index));
    const model = buildAssetHistoryChartModel({ crypto: false, holdingSafe: true, mode: "price", points });

    expect(model.data).toHaveLength(500);
    expect(model.data[0].value).toBe(100);
    expect(model.data.at(-1)!.value).toBe(3752);
  });

  it("uses the disclosed visible-range price axis with three equal sections", () => {
    const model = buildAssetHistoryChartModel({
      crypto: false,
      holdingSafe: true,
      mode: "price",
      points: [price("2026-01-01", 100), price("2026-01-02", 110)],
    });
    const scale = getVisiblePriceScale([100, 110]);

    expect(model.yDomain).toEqual([scale.yAxisOffset, scale.yAxisOffset + scale.maxValue]);
    expect(model.yTicks).toEqual([0, 1, 2, 3].map((step) => scale.yAxisOffset + scale.stepValue * step));
  });

  it("returns an empty chart for no observations", () => {
    expect(buildAssetHistoryChartModel({ crypto: false, holdingSafe: true, mode: "price", points: [] })).toMatchObject({
      data: [],
      segments: [],
      xTicks: [],
    });
  });
});

describe("nearestObservationIndex", () => {
  const data = [10, 20, 40].map((x) => ({ value: x, x }));

  it("finds the closest observation, preferring the earlier one on a tie", () => {
    expect(nearestObservationIndex(data, 0)).toBe(0);
    expect(nearestObservationIndex(data, 14)).toBe(0);
    expect(nearestObservationIndex(data, 15)).toBe(0);
    expect(nearestObservationIndex(data, 31)).toBe(2);
    expect(nearestObservationIndex(data, 99)).toBe(2);
    expect(nearestObservationIndex([], 5)).toBe(-1);
  });
});
