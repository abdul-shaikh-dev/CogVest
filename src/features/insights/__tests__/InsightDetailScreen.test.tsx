import { act, fireEvent, render } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { InsightDetailScreen } from "../InsightDetailScreen";
import { InsightCards } from "../InsightCards";

const now = new Date(2026, 8, 8);
function fixture() {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
  store
    .getState()
    .addAsset({
      id: "asset",
      name: "Example fund",
      symbol: "EXAMPLE",
      ticker: "EXAMPLE.NS",
      assetClass: "stock",
      currency: "INR",
    });
  for (let i = 1; i <= 5; i++)
    store.getState().addTrade({
      id: `buy-${i}`,
      assetId: "asset",
      type: "buy",
      date: `2026-06-0${i}`,
      quantity: 1,
      pricePerUnit: 100,
      totalValue: 100,
      conviction: 4,
    });
  return store;
}

describe("Insight details", () => {
  it("stacks evidence labels and values at larger text sizes", async () => {
    const dimensions = jest.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({ width: 360, height: 800, scale: 3, fontScale: 1.3 });
    try {
      const screen = await render(<InsightDetailScreen kind="conviction" store={fixture()} now={now} onClose={jest.fn()} />);
      const facts = screen.getAllByTestId(/^insight-fact-/);
      expect(facts.length).toBeGreaterThan(0);
      for (const fact of facts) expect(fact).toHaveStyle({ flexDirection: "column" });
      expect(screen.getAllByText("Conviction pattern")).toHaveLength(1);
    } finally {
      dimensions.mockRestore();
    }
  });
  it.each([
    ["conviction", "Conviction pattern"],
    ["patience", "Planned holding periods"],
    ["frequency", "Trading frequency"],
  ])("opens and closes %s with evidence and limitations", async (kind, title) => {
    const onClose = jest.fn();
    const screen = await render(
      <InsightDetailScreen
        kind={kind}
        store={fixture()}
        now={now}
        onClose={onClose}
      />,
    );
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText("What contributed")).toBeTruthy();
    expect(screen.getByText("How to read this")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("insight-back"));
    await fireEvent.press(screen.getByTestId("insight-done"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("reveals supporting records only on request and masks evidence", async () => {
    const store = fixture();
    const screen = await render(
      <InsightDetailScreen
        kind="conviction"
        store={store}
        now={now}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByText("Example fund")).toBeNull();
    await fireEvent.press(screen.getByTestId("insight-show-records"));
    expect(screen.getAllByText("Example fund")).toHaveLength(5);
    await fireEvent.press(screen.getByTestId("insight-mask-toggle"));
    expect(store.getState().preferences.maskWealthValues).toBe(true);
    expect(screen.queryByTestId("insight-evidence")).toBeNull();
    expect(screen.queryByText("Example fund")).toBeNull();
    await fireEvent.press(screen.getByTestId("insight-mask-toggle"));
    expect(screen.getByTestId("insight-evidence")).toBeTruthy();
  });

  it("recomputes after source corrections and deletions", async () => {
    const store = fixture();
    const screen = await render(
      <InsightDetailScreen
        kind="conviction"
        store={store}
        now={now}
        onClose={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByTestId("insight-show-records"));
    await act(() =>
      store.setState({
        assets: [{ ...store.getState().assets[0], name: "Corrected fund" }],
      }),
    );
    expect(screen.queryByText("Example fund")).toBeNull();
    expect(screen.getAllByText("Corrected fund")).toHaveLength(5);
    await act(() => store.setState({ trades: [] }));
    expect(screen.queryByText("Corrected fund")).toBeNull();
    expect(screen.getByText("Not enough data yet")).toBeTruthy();
    expect(screen.queryByTestId("insight-show-records")).toBeNull();
  });

  it("renders an available patience observation and drops it when plans are corrected", async () => {
    const store = fixture();
    store.setState({
      trades: store
        .getState()
        .trades.map((trade) => ({ ...trade, intendedHoldDays: 30 })),
    });
    for (let i = 1; i <= 3; i++)
      store.getState().addTrade({
        id: `sale-${i}`,
        assetId: "asset",
        type: "sell",
        date: `2026-08-0${i}`,
        quantity: 1,
        pricePerUnit: 120,
        totalValue: 120,
      });
    const screen = await render(
      <InsightDetailScreen
        kind="patience"
        store={store}
        now={now}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByText("Not enough data yet")).toBeNull();
    await fireEvent.press(screen.getByTestId("insight-show-records"));
    expect(screen.getAllByText("Sale with planned lots")).toHaveLength(3);
    await act(() =>
      store.setState({
        trades: store
          .getState()
          .trades.map((trade) => ({ ...trade, intendedHoldDays: undefined })),
      }),
    );
    expect(screen.getByText("Not enough data yet")).toBeTruthy();
    expect(screen.queryByText("Sale with planned lots")).toBeNull();
  });

  it("provides a safe exit for an unknown kind and suppresses insights in Minimal Mode", async () => {
    const store = fixture();
    const onClose = jest.fn();
    const screen = await render(
      <InsightDetailScreen
        kind="unknown"
        store={store}
        now={now}
        onClose={onClose}
      />,
    );
    await fireEvent.press(screen.getByText("Back to Dashboard"));
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(() => store.getState().updatePreferences({ displayMode: "minimal" }));
    await screen.rerender(
      <InsightDetailScreen
        kind="conviction"
        store={store}
        now={now}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("Insights are paused")).toBeTruthy();
    expect(screen.queryByTestId("insight-evidence")).toBeNull();
  });

  it("routes each entry by kind and hides the entire entry in Minimal Mode", async () => {
    const store = fixture();
    const onOpen = jest.fn();
    const screen = await render(
      <InsightCards store={store} now={now} onOpen={onOpen} />,
    );
    for (const kind of ["conviction", "patience", "frequency"]) {
      await fireEvent.press(screen.getByTestId(`open-insight-${kind}`));
      expect(onOpen).toHaveBeenLastCalledWith(kind);
    }
    await act(() => store.getState().updatePreferences({ displayMode: "minimal" }));
    expect(screen.queryByTestId("dashboard-insights")).toBeNull();
  });
});
