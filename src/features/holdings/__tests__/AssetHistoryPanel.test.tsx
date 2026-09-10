import { fireEvent, render } from "@testing-library/react-native";

import { AssetHistoryPanel } from "../AssetHistoryPanel";
import { useAssetHistory } from "../useAssetHistory";
import type { DailyPriceEntry } from "@/src/services/quotes/dailyPriceCache";
import type { Asset, OpeningPosition } from "@/src/types";

jest.mock("../useAssetHistory", () => ({
  useAssetHistory: jest.fn(),
}));

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

function renderPanel(overrides: Partial<React.ComponentProps<typeof AssetHistoryPanel>> = {}) {
  return render(
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

  it("switches between price and holding-value history using real transformed values", () => {
    const screen = renderPanel();

    expect(screen.getByTestId("asset-history-selected-value")).toHaveTextContent("₹120.00");
    fireEvent.press(screen.getByTestId("asset-history-mode-holdingValue"));
    expect(screen.getByTestId("asset-history-selected-value")).toHaveTextContent("₹1,200.00");
    expect(screen.getByText(/Includes purchases and disposals; not investment return/u)).toBeTruthy();
    expect(screen.getByTestId("asset-history-mode-holdingValue").props.accessibilityState).toEqual({ selected: true });
  });

  it("hides chart and monetary readout from visual and accessibility output when masked", () => {
    const screen = renderPanel({ masked: true });

    expect(screen.getByTestId("asset-history-masked")).toHaveTextContent("History values hidden");
    expect(screen.queryByTestId("asset-history-chart")).toBeNull();
    expect(screen.queryByTestId("asset-history-selected-value")).toBeNull();
    expect(screen.queryByText(/₹120/u)).toBeNull();
  });

  it("moves across observed dates without inventing intermediate observations", () => {
    const screen = renderPanel();

    expect(screen.getByText("2026-01-03")).toBeTruthy();
    expect(screen.getByTestId("asset-history-next").props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(screen.getByTestId("asset-history-previous"));
    expect(screen.getByText("2026-01-02")).toBeTruthy();
    fireEvent.press(screen.getByTestId("asset-history-next"));
    expect(screen.getByText("2026-01-03")).toBeTruthy();
  });

  it("requests a new date range when a range control changes", () => {
    const screen = renderPanel();
    const initial = mockUseAssetHistory.mock.calls.at(-1)!;

    fireEvent.press(screen.getByTestId("asset-history-range-1Y"));
    const updated = mockUseAssetHistory.mock.calls.at(-1)!;

    expect(updated[0]).toEqual(asset);
    expect(updated[1]).not.toBe(initial[1]);
    expect(updated[2]).toBe(initial[2]);
    expect(screen.getByTestId("asset-history-range-1Y").props.accessibilityState).toEqual({ selected: true });
  });

  it("communicates loading, partial cached, and offline states", () => {
    mockHistory({ loading: true, entry: undefined });
    const screen = renderPanel();
    expect(screen.getByTestId("asset-history-loading")).toHaveTextContent("Loading history…");

    mockHistory({
      entry: entry(undefined, { complete: false }),
      freshness: "stale",
      loading: false,
      message: "History refresh timed out. Cached observations remain available.",
    });
    screen.rerender(
      <AssetHistoryPanel asset={asset} openingPositions={[opening]} trades={[]} masked={false} minimal={false} />,
    );
    expect(screen.getByTestId("asset-history-message")).toHaveTextContent("History refresh timed out. Cached observations remain available.");
    expect(screen.getByText(/Saved history may be out of date/u)).toBeTruthy();
    expect(screen.getByText(/Partial history/u)).toBeTruthy();
  });

  it("renders honest empty states and never fabricates a zero holding value", () => {
    mockHistory({ entry: entry([]), loading: false });
    const screen = renderPanel();
    expect(screen.getByTestId("asset-history-empty")).toHaveTextContent("No price observations in this range.");

    mockHistory();
    screen.rerender(
      <AssetHistoryPanel asset={asset} openingPositions={[]} trades={[]} masked={false} minimal={false} />,
    );
    fireEvent.press(screen.getByTestId("asset-history-mode-holdingValue"));
    expect(screen.getByText("No ownership record is available for this price history.")).toBeTruthy();
    expect(screen.getByTestId("asset-history-empty")).toHaveTextContent("Not enough recorded history to reconstruct your holding value in this range.");
    expect(screen.queryByTestId("asset-history-selected-value")).toBeNull();
    expect(screen.queryByTestId("asset-history-chart")).toBeNull();
  });

  it("renders no more than 500 chart points for long history", () => {
    const points = Array.from({ length: 700 }, (_, index) => ({
      close: 100 + index,
      date: new Date(Date.UTC(2020, 0, index + 1)).toISOString().slice(0, 10),
    }));
    mockHistory({ entry: entry(points) });
    const screen = renderPanel({ openingPositions: [{ ...opening, date: points[0]!.date }] });

    const chart = screen.UNSAFE_getByProps({ testID: "gifted-line-chart" });
    expect(chart.props.data).toHaveLength(500);
    expect(chart.props.data[0].value).toBe(100);
    expect(chart.props.data.at(-1).value).toBe(799);
  });
});
