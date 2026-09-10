import { act, fireEvent, render } from "@testing-library/react-native";
import { Linking } from "react-native";
import { createPortfolioStore } from "@/src/store";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { HoldingDurationScreen } from "../HoldingDurationScreen";
const now = new Date(2026, 8, 8);
function fixture() {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
  store
    .getState()
    .addAsset({
      id: "a",
      name: "Example stock",
      ticker: "EX.NS",
      symbol: "EX",
      currency: "INR",
      assetClass: "stock",
      instrumentType: "stock",
      exchange: "NSE",
    });
  store
    .getState()
    .addOpeningPosition({
      id: "o",
      assetId: "a",
      date: "2025-01-01",
      quantity: 1,
      averageCostPrice: 100,
    });
  return store;
}
describe("Holding duration screen", () => {
  it("recomputes corrected dates and deleted records without stale results", () => {
    const store = fixture();
    const screen = render(
      <HoldingDurationScreen store={store} now={now} onClose={jest.fn()} />,
    );
    expect(screen.getByText("More than 12 months recorded")).toBeTruthy();
    act(() =>
      store.setState({
        openingPositions: [
          { ...store.getState().openingPositions[0], date: "2026-08-01" },
        ],
      }),
    );
    expect(screen.getByText("Within the 12-month reference")).toBeTruthy();
    act(() => store.setState({ openingPositions: [] }));
    expect(screen.getByText("No stock or ETF holdings")).toBeTruthy();
    expect(screen.queryByText("Example stock")).toBeNull();
  });
  it("masks names and dates, suppresses Minimal analysis and has a safe exit", () => {
    const store = fixture();
    const onClose = jest.fn();
    const screen = render(
      <HoldingDurationScreen store={store} now={now} onClose={onClose} />,
    );
    fireEvent.press(screen.getByTestId("duration-mask"));
    expect(screen.queryByText("Example stock")).toBeNull();
    expect(screen.queryByText("01 Jan 2025")).toBeNull();
    expect(screen.queryByText("08 Sep 2026")).toBeNull();
    act(() => store.getState().updatePreferences({ displayMode: "minimal" }));
    expect(screen.getByText("Optional analysis is paused")).toBeTruthy();
    fireEvent.press(screen.getByTestId("duration-back"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("does not trust the legacy tax flag or unknown ETF classification", () => {
    const store = fixture();
    store.setState({
      assets: [
        {
          ...store.getState().assets[0],
          assetClass: "etf",
          instrumentType: "etf",
          isTaxEligible: true,
        },
      ],
    });
    const screen = render(
      <HoldingDurationScreen store={store} now={now} onClose={jest.fn()} />,
    );
    expect(screen.getByText("Comparison unavailable")).toBeTruthy();
    expect(screen.queryByText("More than 12 months recorded")).toBeNull();
  });
  it("handles unavailable external guidance without crashing", async () => {
    const open = jest
      .spyOn(Linking, "openURL")
      .mockRejectedValue(new Error("No browser"));
    const screen = render(
      <HoldingDurationScreen store={fixture()} now={now} onClose={jest.fn()} />,
    );
    await act(async () =>
      fireEvent.press(screen.getByText("Read official guidance")),
    );
    expect(screen.getByText(/Could not open the guidance/)).toBeTruthy();
    open.mockRestore();
  });
});
