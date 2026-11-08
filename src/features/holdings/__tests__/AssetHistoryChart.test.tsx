import { render } from "@testing-library/react-native";

import { AssetHistoryChart } from "../AssetHistoryChart";
import { buildAssetHistoryChartModel } from "../assetHistoryChartModel";

const point = (date: string, price: number) => ({ date, holdingValue: null, price });
const colors = { guide: "#888", label: "#999", line: "#0a0", marker: "#fff", rule: "#333" };

async function renderChart(zoomed = false) {
  const model = buildAssetHistoryChartModel({
    crypto: false,
    holdingSafe: true,
    mode: "price",
    points: [point("2026-01-01", 100), point("2026-01-02", 101), point("2026-01-12", 103), point("2026-01-13", 104)],
  });
  const screen = await render(
    <AssetHistoryChart
      colors={colors}
      formatX={String}
      formatY={String}
      model={model}
      onInspect={jest.fn()}
      onZoom={jest.fn()}
      selectedIndex={3}
      zoomed={zoomed}
    />,
  );
  const chart = screen.getByTestId("victory-cartesian-chart");
  return { chart, model, screen };
}

describe("AssetHistoryChart", () => {
  it("draws one line per gap-free segment over the model's data and axes", async () => {
    const { chart, model, screen } = await renderChart();

    expect(chart.props.yKeys).toEqual(["value"]);
    expect(chart.props.domain).toEqual({ x: [model.data[0].x, model.data[3].x], y: model.yDomain });
    expect(chart.props.xAxis.tickValues).toEqual(model.xTicks);
    expect(chart.props.yAxis[0].tickValues).toEqual(model.yTicks);
    const lines = screen.getAllByTestId("victory-line");
    expect(lines.map((line) => line.props.points.map((datum: { yValue: number }) => datum.yValue))).toEqual([
      [100, 101],
      [103, 104],
    ]);
  });

  it("keeps one finger for inspecting and two fingers for zoom and pan", async () => {
    const timeGestures = (chart: { props: Record<string, any> }) => {
      const [pinch, pan] = chart.props.customGestures.gestures;
      return { pan: pan.config, pinch: pinch.config };
    };

    const resting = await renderChart(false);
    // One finger: press and hold, then drag, to inspect.
    expect(resting.chart.props.gestureLongPressDelay).toBe(200);
    // Victory's one-finger pan would race the inspection, so its transforms are off.
    expect(resting.chart.props.transformConfig).toEqual({ pan: { enabled: false }, pinch: { enabled: false } });
    expect(timeGestures(resting.chart).pan).toMatchObject({ enabled: false, minPointers: 2 });

    const zoomed = await renderChart(true);
    expect(timeGestures(zoomed.chart).pan).toMatchObject({ enabled: true, minPointers: 2 });
  });
});
