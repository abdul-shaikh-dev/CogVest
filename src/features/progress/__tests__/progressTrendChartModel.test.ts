import { colors } from "@/src/theme";

import {
  buildProgressTrendModel,
  getGapSegments,
  getProgressAxisLabels,
} from "../progressTrendChartModel";

const portfolio = { label: "Portfolio", values: [100, 120, 150] };
const invested = { label: "Invested", values: [90, 100, 110] };

function build(overrides: Partial<Parameters<typeof buildProgressTrendModel>[0]> = {}) {
  return buildProgressTrendModel({
    colors,
    dashedLabels: ["Invested"],
    drawnSeries: [portfolio, invested],
    endpointsOnly: false,
    fillUnderFirst: true,
    focusedSeries: null,
    gapAfterIndices: [],
    monthLabels: ["Jan 2026", "Feb 2026", "Mar 2026"],
    reducedMotion: false,
    scaleSeries: [portfolio, invested],
    selectedIndex: 2,
    ...overrides,
  });
}

describe("getGapSegments", () => {
  it("splits the line after each missing month and ignores out-of-range gaps", () => {
    expect(getGapSegments(0, [])).toEqual([]);
    expect(getGapSegments(4, [])).toEqual([[0, 3]]);
    expect(getGapSegments(4, [1])).toEqual([[0, 1], [2, 3]]);
    expect(getGapSegments(4, [2, 0])).toEqual([[0, 0], [1, 2], [3, 3]]);
    expect(getGapSegments(4, [3, -1])).toEqual([[0, 3]]);
  });
});

describe("getProgressAxisLabels", () => {
  it("labels the first, middle and latest month and aligns endpoints inward", () => {
    const months = ["Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026", "May 2026"];
    expect(getProgressAxisLabels(months, false)).toEqual([
      { align: "left", index: 0, text: "Jan" },
      { align: "center", index: 2, text: "Mar" },
      { align: "right", index: 4, text: "May" },
    ]);
    expect(getProgressAxisLabels(months, true).map((label) => label.index)).toEqual([0, 4]);
  });

  it("puts the year on a second line when the range spans years", () => {
    expect(getProgressAxisLabels(["Dec 2025", "Jan 2026"], false).map((label) => label.text))
      .toEqual(["Dec\n2025", "Jan\n2026"]);
  });
});

describe("buildProgressTrendModel", () => {
  it("draws Portfolio solid with a fill and Invested dashed on a shared zero-based scale", () => {
    const model = build();
    expect(model.lines.map(({ dashed, label }) => ({ dashed, label }))).toEqual([
      { dashed: false, label: "Portfolio" },
      { dashed: true, label: "Invested" },
    ]);
    expect(model.fillUnderFirst).toBe(true);
    expect(model.maxValue).toBe(200);
    expect(model.yTicks).toEqual([0, 100, 200]);
    expect(model.animate).toBe(true);
  });

  it("enlarges the inspected month and thins markers as ranges grow", () => {
    expect(build().lines[0].pointRadii).toEqual([3, 3, 6]);
    expect(build({ selectedIndex: 0 }).lines[0].pointRadii).toEqual([6, 3, 3]);
    const long = { label: "Portfolio", values: Array.from({ length: 30 }, (_, index) => index + 1) };
    const radii = build({ drawnSeries: [long], scaleSeries: [long], monthLabels: [], selectedIndex: 29 })
      .lines[0].pointRadii;
    expect(radii.filter((radius) => radius > 0)).toEqual([6]);
  });

  it("drops the fill across missing months rather than bridging them", () => {
    const model = build({ gapAfterIndices: [0] });
    expect(model.segments).toEqual([[0, 0], [1, 2]]);
    expect(model.fillUnderFirst).toBe(false);
  });

  it("dims unfocused lines but keeps their markers in the series colour", () => {
    const [line] = build({ focusedSeries: "Invested" }).lines;
    expect(line.color).not.toBe(line.pointColor);
    expect(line.color.startsWith(line.pointColor)).toBe(true);
  });

  it("does not animate under reduced motion", () => {
    expect(build({ reducedMotion: true }).animate).toBe(false);
  });
});
