import { act, fireEvent, render } from "@testing-library/react-native";

import { AssetHistoryPanel, getVisiblePriceScale } from "../AssetHistoryPanel";
import { useAssetHistory } from "../useAssetHistory";
import type { DailyPriceEntry } from "@/src/services/quotes/dailyPriceCache";
import type { Asset, OpeningPosition } from "@/src/types";
import { queryAllComponents } from "@/src/testing/componentQueries";

jest.mock("../useAssetHistory", () => ({
  useAssetHistory: jest.fn(),
}));
jest.mock("../AssetHistoryChart", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { AssetHistoryChart: (props: Record<string, unknown>) => React.createElement(View, { ...props, testID: "history-chart" }) };
});

const chartOf = (screen: Awaited<ReturnType<typeof render>>) =>
  queryAllComponents(screen, (component) => component.props.testID === "history-chart")[0];

const mockUseAssetHistory = jest.mocked(useAssetHistory);
const retry = jest.fn();

const asset: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "asset-history",
  instrumentType: "stock",
  name: "History Asset",
  sectorType: "other",
  symbol: "HISTORY",
  ticker: "HISTORY.NS",
};

const opening: OpeningPosition = {
  assetId: asset.id,
  averageCostPrice: 100,
  date: "2026-01-02",
  id: "opening-history",
  quantity: 10,
};

function entry(
  points = [
    { close: 100, date: "2026-01-01" },
    { close: 110, date: "2026-01-02" },
    { close: 120, date: "2026-01-03" },
  ],
  overrides: Partial<DailyPriceEntry> = {},
): DailyPriceEntry {
  return {
    basis: "close",
    complete: true,
    currency: "INR",
    fetchedAt: "2026-09-10T10:00:00.000Z",
    from: points[0]?.date ?? "2026-01-01",
    points,
    provider: "yahoo",
    providerId: asset.ticker,
    to: points.at(-1)?.date ?? "2026-01-01",
    ...overrides,
  };
}

function mockHistory(overrides: Partial<ReturnType<typeof useAssetHistory>> = {}) {
  mockUseAssetHistory.mockReturnValue({
    entry: entry(),
    freshness: "current",
    key: "history",
    loading: false,
    supported: true,
    retry,
    ...overrides,
  });
}

async function renderPanel(overrides: Partial<React.ComponentProps<typeof AssetHistoryPanel>> = {}) {
  return await render(
    <AssetHistoryPanel
      asset={asset}
      openingPositions={[opening]}
      trades={[]}
      masked={false}
      minimal={false}
      {...overrides}
    />,
  );
}

describe("AssetHistoryPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHistory();
  });

  it("labels only the endpoints of a ten-year series and does not rebuild it to move the selection", async () => {
    const points = Array.from({ length: 3653 }, (_, index) => ({
      date: new Date(Date.UTC(2016, 0, 1 + index)).toISOString().slice(0, 10),
      close: 100 + index,
    }));
    mockHistory({ entry: entry(points) });
    const openingPositions = [opening];
    const trades: never[] = [];
    const screen = await renderPanel({ openingPositions, trades });
    expect(screen.getByTestId("asset-history-chart", { includeHiddenElements: true })).toBeTruthy();
    const model = chartOf(screen).props.model;
    expect(model.xTicks).toHaveLength(2);
    expect(chartOf(screen).props.formatX(model.xTicks[0])).toBe("Jan 16");

    await fireEvent.press(screen.getByTestId("asset-history-previous"));
    expect(chartOf(screen).props.model).toBe(model);
    // A re-read of identical cached content arrives as a new object.
    mockHistory({ entry: entry(points.map((point) => ({ ...point }))) });
    await screen.rerender(
      <AssetHistoryPanel asset={asset} openingPositions={openingPositions} trades={trades} masked={false} minimal={false} />,
    );
    expect(chartOf(screen).props.model).toBe(model);
  });

  it("switches between price and holding-value history using real transformed values", async () => {
    const screen = await renderPanel();

    expect(screen.getByTestId("asset-history-selected-value")).toHaveTextContent("₹120.00");
    await fireEvent.press(screen.getByTestId("asset-history-mode-holdingValue"));
    expect(screen.getByTestId("asset-history-selected-value")).toHaveTextContent("₹1,200.00");
    expect(screen.getByText(/Includes purchases and disposals; not investment return/u)).toBeTruthy();
    expect(screen.getByTestId("asset-history-mode-holdingValue").props.accessibilityState).toEqual({ selected: true });
  });

  it("hides chart and monetary readout from visual and accessibility output when masked", async () => {
    const screen = await renderPanel({ masked: true });

    expect(screen.getByTestId("asset-history-masked")).toHaveTextContent("History values hidden");
    expect(screen.queryByTestId("asset-history-chart")).toBeNull();
    expect(screen.queryByTestId("asset-history-selected-value")).toBeNull();
    expect(screen.queryByText(/₹120/u)).toBeNull();
  });

  it("moves across observed dates without inventing intermediate observations", async () => {
    const screen = await renderPanel();

    expect(screen.getByTestId("asset-history-selected-date")).toHaveTextContent(
      "Observed date03 Jan 2026",
    );
    expect(screen.queryByText("3 / 3")).toBeNull();
    expect(screen.getByTestId("asset-history-next").props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId("asset-history-previous"));
    expect(screen.getByTestId("asset-history-selected-date")).toHaveTextContent(
      "Observed date02 Jan 2026",
    );
    await fireEvent.press(screen.getByTestId("asset-history-next"));
    expect(screen.getByTestId("asset-history-selected-date")).toHaveTextContent(
      "Observed date03 Jan 2026",
    );
  });

  it("uses a disclosed visible-range scale for price without changing source values", async () => {
    mockHistory({
      entry: entry([
        { close: 100, date: "2026-01-01" },
        { close: 101, date: "2026-01-02" },
        { close: 102, date: "2026-01-03" },
      ]),
    });
    const screen = await renderPanel();
    const chart = chartOf(screen);

    expect(chart.props.model.data.map((point: { value: number }) => point.value)).toEqual([100, 101, 102]);
    expect(chart.props.model.yDomain[0]).toBeGreaterThan(0);
    expect(chart.props.model.yDomain[1] - chart.props.model.yDomain[0]).toBeLessThan(10);
    expect(chart.props.model.yTicks).toHaveLength(4);
    expect(chart.props.selectedIndex).toBe(2);
    expect(screen.getByTestId("asset-history-visible-range")).toHaveTextContent(
      /Axis starts at .*not zero/u,
    );

    await fireEvent.press(screen.getByTestId("asset-history-mode-holdingValue"));
    expect(chartOf(screen).props.model.yDomain[0]).toBe(0);
    expect(screen.queryByTestId("asset-history-visible-range")).toBeNull();
  });

  it("keeps a zero baseline when the visible price range includes zero", () => {
    expect(getVisiblePriceScale([0, 0.01, 0.02]).yAxisOffset).toBe(0);
    expect(getVisiblePriceScale([])).toEqual({
      maxValue: 1,
      stepValue: 1 / 3,
      yAxisOffset: 0,
    });
  });

  it("leaves missing-date gaps disconnected", async () => {
    mockHistory({
      entry: entry([
        { close: 100, date: "2026-01-01" },
        { close: 110, date: "2026-01-10" },
      ]),
    });
    const screen = await renderPanel();
    expect(chartOf(screen).props.model.segments).toEqual([[0, 0], [1, 1]]);
  });

  it("requests a new date range when a range control changes", async () => {
    const screen = await renderPanel();
    const initial = mockUseAssetHistory.mock.calls.at(-1)!;

    await fireEvent.press(screen.getByTestId("asset-history-range-1Y"));
    const updated = mockUseAssetHistory.mock.calls.at(-1)!;

    expect(updated[0]).toEqual(asset);
    expect(updated[1]).not.toBe(initial[1]);
    expect(updated[2]).toBe(initial[2]);
    expect(screen.getByTestId("asset-history-range-1Y").props.accessibilityState).toEqual({ selected: true });
  });

  it("communicates loading, partial cached, and offline states", async () => {
    mockHistory({ loading: true, entry: undefined });
    const screen = await renderPanel();
    expect(screen.getByTestId("asset-history-loading")).toHaveTextContent("Loading history…");

    mockHistory({
      entry: entry(undefined, { complete: false }),
      freshness: "stale",
      loading: false,
      message: "History refresh timed out. Cached observations remain available.",
    });
    await screen.rerender(
      <AssetHistoryPanel asset={asset} openingPositions={[opening]} trades={[]} masked={false} minimal={false} />,
    );
    expect(screen.getByTestId("asset-history-message")).toHaveTextContent("History refresh timed out. Cached observations remain available.");
    expect(screen.getByText(/Saved history may be out of date/u)).toBeTruthy();
    expect(screen.getByText(/Partial history/u)).toBeTruthy();
  });

  it("renders honest empty states and never fabricates a zero holding value", async () => {
    mockHistory({ entry: entry([]), loading: false });
    const screen = await renderPanel();
    expect(screen.getByTestId("asset-history-empty")).toHaveTextContent("No price observations in this range.");

    mockHistory();
    await screen.rerender(
      <AssetHistoryPanel asset={asset} openingPositions={[]} trades={[]} masked={false} minimal={false} />,
    );
    await fireEvent.press(screen.getByTestId("asset-history-mode-holdingValue"));
    expect(screen.getByText("No ownership record is available for this price history.")).toBeTruthy();
    expect(screen.getByTestId("asset-history-empty")).toHaveTextContent("Not enough recorded history to reconstruct your holding value in this range.");
    expect(screen.queryByTestId("asset-history-selected-value")).toBeNull();
    expect(screen.queryByTestId("asset-history-chart")).toBeNull();
  });

  it("renders no more than 500 chart points for long history", async () => {
    const points = Array.from({ length: 700 }, (_, index) => ({
      close: 100 + index,
      date: new Date(Date.UTC(2020, 0, index + 1)).toISOString().slice(0, 10),
    }));
    mockHistory({ entry: entry(points) });
    const screen = await renderPanel({ openingPositions: [{ ...opening, date: points[0]!.date }] });

    const chart = chartOf(screen);
    expect(chart.props.model.data).toHaveLength(500);
    expect(chart.props.model.data[0].value).toBe(100);
    expect(chart.props.model.data.at(-1).value).toBe(799);
  });

  it("shows the observation under the finger and keeps it selected on release", async () => {
    const screen = await renderPanel();
    expect(screen.getByTestId("asset-history-selected-value")).toHaveTextContent("₹120.00");

    await act(() => chartOf(screen).props.onInspect(0));
    expect(screen.getByTestId("asset-history-selected-value")).toHaveTextContent("₹100.00");
    await act(() => chartOf(screen).props.onInspect(null));
    expect(screen.getByTestId("asset-history-selected-value")).toHaveTextContent("₹100.00");
    expect(chartOf(screen).props.selectedIndex).toBe(0);

    await fireEvent.press(screen.getByTestId("asset-history-next"));
    expect(screen.getByTestId("asset-history-selected-value")).toHaveTextContent("₹110.00");
  });

  it("redraws a zoomed window from the daily observations and resets", async () => {
    const points = Array.from({ length: 700 }, (_, index) => ({
      close: 100 + index,
      date: new Date(Date.UTC(2020, 0, index + 1)).toISOString().slice(0, 10),
    }));
    mockHistory({ entry: entry(points) });
    const screen = await renderPanel({ openingPositions: [{ ...opening, date: points[0]!.date }] });
    expect(chartOf(screen).props.zoomed).toBe(false);

    const day = (index: number) => Date.parse(`${points[index]!.date}T12:00:00Z`);
    await act(() => chartOf(screen).props.onZoom(day(100), day(160)));
    const zoomed = chartOf(screen);
    expect(zoomed.props.zoomed).toBe(true);
    // Every daily observation in the window, not the 500-point sample of all 700.
    expect(zoomed.props.model.data.map((point: { value: number }) => point.value)).toEqual(
      Array.from({ length: 61 }, (_, index) => 200 + index),
    );
    expect(screen.getByText(/first to last visible observation/u)).toBeTruthy();

    await fireEvent.press(screen.getByTestId("asset-history-reset-zoom"));
    expect(chartOf(screen).props.zoomed).toBe(false);
    expect(chartOf(screen).props.model.data).toHaveLength(500);
  });

  it("ignores a zoom narrower than a week or wider than the range", async () => {
    const screen = await renderPanel();
    await act(() => chartOf(screen).props.onZoom(Date.parse("2026-01-01T12:00:00Z"), Date.parse("2026-01-02T12:00:00Z")));
    expect(chartOf(screen).props.zoomed).toBe(false);
    await act(() => chartOf(screen).props.onZoom(0, Date.parse("2030-01-01T00:00:00Z")));
    expect(chartOf(screen).props.zoomed).toBe(false);
  });
});
