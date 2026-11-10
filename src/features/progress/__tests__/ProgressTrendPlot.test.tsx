import { render } from "@testing-library/react-native";

import { colors } from "@/src/theme";

import { ProgressTrendPlot } from "../ProgressTrendPlot";
import { buildProgressTrendModel } from "../progressTrendChartModel";

const plotColors = { label: colors.text.secondary, rule: colors.border.subtle };

async function renderPlot(gapAfterIndices: number[] = []) {
  const model = buildProgressTrendModel({
    colors,
    dashedLabels: ["Invested"],
    drawnSeries: [
      { label: "Portfolio", values: [100, 120, 150] },
      { label: "Invested", values: [90, 100, 110] },
    ],
    endpointsOnly: false,
    fillUnderFirst: true,
    focusedSeries: null,
    gapAfterIndices,
    monthLabels: ["Dec 2025", "Jan 2026", "Feb 2026"],
    reducedMotion: false,
    scaleSeries: [],
    selectedIndex: 2,
  });
  const screen = await render(
    <ProgressTrendPlot colors={plotColors} formatYLabel={String} model={model} onInspect={jest.fn()} />,
  );
  return { model, screen };
}

describe("ProgressTrendPlot", () => {
  it("draws each series per gap-free segment, dashing Invested and filling under Portfolio", async () => {
    const { screen } = await renderPlot([0]);
    const lines = screen.getAllByTestId("victory-line");
    expect(lines.map((line) => line.props.points.map((point: { yValue: number }) => point.yValue))).toEqual([
      [100], [120, 150], [90], [100, 110],
    ]);
    expect(lines.map((line) => line.props.strokeWidth)).toEqual([3, 3, 3, 3]);
    // A gap removes the fill so it never bridges missing months.
    expect(screen.queryByTestId("victory-area")).toBeNull();
    expect(screen.getAllByTestId("skia-dash").map((dash) => dash.props.intervals)).toEqual([[6, 4], [6, 4]]);
    expect(screen.getByTestId("victory-cartesian-chart").props.yAxis[0].linePathEffect.props.intervals)
      .toEqual([4, 4]);
  });

  it("fills under Portfolio, marks months and labels the axis from the model", async () => {
    const { model, screen } = await renderPlot();
    expect(screen.getByTestId("victory-area")).toBeTruthy();
    const chart = screen.getByTestId("victory-cartesian-chart");
    expect(chart.props.yKeys).toEqual(["s0", "s1"]);
    expect(chart.props.domain).toEqual({ x: [0, 2], y: [0, model.maxValue] });
    expect(chart.props.gestureLongPressDelay).toBe(200);
    expect(screen.getAllByTestId("skia-circle").map((circle) => circle.props.r)).toEqual([3, 3, 6, 3, 3, 6]);
    expect(screen.getAllByTestId("progress-trend-axis-label").map((label) => label.props.children))
      .toEqual(["Dec\n2025", "Jan\n2026", "Feb\n2026"]);
  });
});
