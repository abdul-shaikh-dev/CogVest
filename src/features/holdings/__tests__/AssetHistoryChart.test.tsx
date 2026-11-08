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

  it("inspects on press-and-hold, zooms time by pinch, and pans only when zoomed", async () => {
    const resting = await renderChart(false);
    expect(resting.chart.props.gestureLongPressDelay).toBe(200);
    expect(resting.chart.props.transformConfig).toMatchObject({
      pan: { dimensions: "x", enabled: false },
      pinch: { dimensions: "x", enabled: true },
    });

    const zoomed = await renderChart(true);
    expect(zoomed.chart.props.transformConfig.pan).toMatchObject({
      enabled: true,
      // Vertical drags still scroll the page.
      failOffsetY: [-12, 12],
    });
  });
});
