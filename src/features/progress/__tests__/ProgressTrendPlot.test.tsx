import { render } from "@testing-library/react-native";

import { pressChartAt } from "@/src/testing/chartPress";
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
  const onInspect = jest.fn();
  const screen = await render(
    <ProgressTrendPlot colors={plotColors} formatYLabel={String} model={model} onInspect={onInspect} />,
  );
  return { model, onInspect, screen };
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
    // Month markers per series, then one press marker per series.
    expect(screen.getAllByTestId("skia-circle").map((circle) => circle.props.r)).toEqual([3, 3, 6, 3, 3, 6, 6, 6]);
    expect(screen.getAllByTestId("progress-trend-axis-label").map((label) => label.props.children))
      .toEqual(["Dec\n2025", "Jan\n2026", "Feb\n2026"]);
  });

  it("inspects the pressed month and hides the committed markers while pressed (#673)", async () => {
    const { onInspect, screen } = await renderPlot();
    const opacity = (value: unknown) => (typeof value === "number" ? value : (value as { value: number }).value);
    const circles = () => screen.getAllByTestId("skia-circle").map((circle) => opacity(circle.props.opacity));
    // The plot ignores the mount-time reaction, so nothing is inspected yet.
    expect(onInspect).not.toHaveBeenCalled();
    expect(circles()).toEqual([1, 1, 1, 1, 1, 1, 0, 0]);

    await pressChartAt(0);
    expect(onInspect).toHaveBeenLastCalledWith(0);
    // The selected month (r 6) steps aside; the press markers and guide show.
    expect(circles()).toEqual([1, 1, 0, 1, 1, 0, 1, 1]);
    expect(opacity(screen.getByTestId("skia-line").props.opacity)).toBe(1);

    await pressChartAt(null);
    expect(onInspect).toHaveBeenLastCalledWith(null);
    expect(circles()).toEqual([1, 1, 1, 1, 1, 1, 0, 0]);
  });
});
