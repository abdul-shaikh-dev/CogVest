import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { MASKED_INR_VALUE } from "@/src/components/common";
import { DashboardScreen } from "@/src/features/dashboard";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset, Trade } from "@/src/types";

const asset: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "asset-reliance",
  name: "Reliance Industries",
  symbol: "RELIANCE",
  ticker: "RELIANCE.NS",
};

const buyTrade: Trade = {
  assetId: asset.id,
  date: "2026-04-20",
  id: "trade-buy",
  pricePerUnit: 100,
  quantity: 2,
  totalValue: 200,
  type: "buy",
};

describe("DashboardScreen", () => {
  it("shows the empty dashboard with a zero total and Add Holding action", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onAddTrade = jest.fn();

    const { getAllByText, getByTestId, getByText } = render(
      <DashboardScreen store={store} onAddTrade={onAddTrade} />,
    );

    expect(getByTestId("dashboard-screen")).toBeTruthy();
    expect(getByTestId("add-trade-button")).toBeTruthy();
    expect(getAllByText("₹0.00").length).toBeGreaterThan(0);
    expect(getByText("No allocation yet")).toBeTruthy();
    expect(
      getByText("Add your first portfolio entry to build holdings automatically."),
    ).toBeTruthy();

    fireEvent.press(getByText("Add Holding"));

    expect(onAddTrade).toHaveBeenCalledTimes(1);
  });

  it("wires Dashboard header value masking and quote refresh actions", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(buyTrade);
    const refreshQuotes = jest.fn().mockResolvedValue({
      failures: [],
      quoteCache: {
        [asset.id]: {
          asOf: "2026-05-16T10:00:00.000Z",
          assetId: asset.id,
          currency: "INR",
          price: 175,
          source: "yahoo",
        },
      },
    });

    const { getByLabelText, getByText } = render(
      <DashboardScreen
        refreshQuotes={refreshQuotes}
        store={store}
      />,
    );

    fireEvent.press(getByLabelText("Mask values"));
    expect(store.getState().preferences.maskWealthValues).toBe(true);

    await act(async () => {
      fireEvent.press(getByLabelText("Refresh quotes"));
    });

    await waitFor(() => {
      expect(refreshQuotes).toHaveBeenCalledTimes(1);
    });
    expect(
      getByText("Quotes updated 16 May 2026 • Live refresh available"),
    ).toBeTruthy();
  });

  it("shows portfolio totals, allocation, quote freshness, monthly metrics, and conviction guidance", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade({ ...buyTrade, conviction: 4 });
    store.getState().addCashEntry({
      amount: 50,
      date: "2026-04-22",
      id: "cash-1",
      label: "Broker cash",
      type: "addition",
    });
    store.getState().addCashEntry({
      amount: 20,
      date: "2026-05-05",
      id: "cash-2",
      label: "Withdrawal",
      type: "withdrawal",
    });
    store.getState().upsertQuote({
      asOf: "2026-04-22T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR",
      dayChangePct: 10,
      price: 150,
      source: "yahoo",
    });

    const { getByText, queryByText } = render(<DashboardScreen store={store} />);

    expect(getByText("₹330.00")).toBeTruthy();
    expect(getByText("Portfolio Rollups")).toBeTruthy();
    expect(getByText("Top sectors")).toBeTruthy();
    expect(getByText("Top instruments")).toBeTruthy();
    expect(getByText("+₹27.27 (+10.00%) today")).toBeTruthy();
    expect(getByText("Equity")).toBeTruthy();
    expect(getByText("90.91%")).toBeTruthy();
    expect(getByText("Cash")).toBeTruthy();
    expect(getByText("9.09%")).toBeTruthy();
    expect(getByText("Quotes updated 22 Apr 2026 • Live refresh available")).toBeTruthy();
    expect(getByText("This Month")).toBeTruthy();
    expect(getByText("Cash change")).toBeTruthy();
    expect(getByText("Not enough data")).toBeTruthy();
    expect(queryByText("Cash balance")).toBeNull();
    expect(queryByText("Holdings")).toBeNull();
    expect(getByText("Conviction data needs more trades")).toBeTruthy();
    expect(getByText("1 of 5 trades rated. Keep conviction optional, but useful.")).toBeTruthy();
    expect(queryByText(/LTCG/i)).toBeNull();
    expect(queryByText(/Minimal Mode/i)).toBeNull();
  });

  it("keeps portfolio rollups below the primary dashboard decision sections", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade({ ...buyTrade, conviction: 4 });
    store.getState().addCashEntry({
      amount: 50,
      date: "2026-04-22",
      id: "cash-1",
      label: "Broker cash",
      type: "addition",
    });
    store.getState().upsertQuote({
      asOf: "2026-04-22T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR",
      price: 150,
      source: "yahoo",
    });

    const screen = render(<DashboardScreen store={store} />);
    const textNodes = screen.UNSAFE_getAllByType(Text)
      .map((node) => textContent(node.props.children))
      .filter(Boolean);

    const allocationIndex = indexOfText(textNodes, "Allocation");
    const thisMonthIndex = indexOfText(textNodes, "This Month");
    const quoteStatusIndex = indexOfText(textNodes, "Quote Status");
    const convictionIndex = indexOfText(
      textNodes,
      "Conviction data needs more trades",
    );
    const rollupsIndex = indexOfText(textNodes, "Portfolio Rollups");

    expect(rollupsIndex).toBeGreaterThan(allocationIndex);
    expect(rollupsIndex).toBeGreaterThan(thisMonthIndex);
    expect(rollupsIndex).toBeGreaterThan(quoteStatusIndex);
    expect(rollupsIndex).toBeGreaterThan(convictionIndex);
  });

  it("masks wealth values when value masking is enabled", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().updatePreferences({ maskWealthValues: true });
    store.getState().addAsset(asset);
    store.getState().addTrade(buyTrade);
    store.getState().upsertQuote({
      asOf: "2026-04-22T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR",
      price: 150,
      source: "yahoo",
    });

    const { getAllByText, queryByText } = render(<DashboardScreen store={store} />);

    expect(getAllByText(MASKED_INR_VALUE).length).toBeGreaterThan(0);
    expect(queryByText("₹300.00")).toBeNull();
    expect(queryByText("+₹100.00")).toBeNull();
    expect(getAllByText("100.00%").length).toBeGreaterThan(0);
  });
});

function textContent(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(textContent).join("");
  }

  return "";
}

function indexOfText(textNodes: string[], expectedText: string) {
  const index = textNodes.indexOf(expectedText);
  expect(index).toBeGreaterThanOrEqual(0);

  return index;
}
