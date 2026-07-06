import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

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

const etfAsset: Asset = {
  assetClass: "etf",
  currency: "INR",
  exchange: "NSE",
  id: "asset-niftybees",
  name: "Nifty 50 ETF",
  symbol: "NIFTYBEES",
  ticker: "NIFTYBEES.NS",
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

const etfBuyTrade: Trade = {
  assetId: etfAsset.id,
  date: "2026-04-20",
  id: "trade-etf-buy",
  pricePerUnit: 100,
  quantity: 1,
  totalValue: 100,
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
    expect(getAllByText("₹0").length).toBeGreaterThan(0);
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
    expect(getByText("Quotes updated")).toBeTruthy();
    expect(
      getByText("16 May 2026 • Live refresh available"),
    ).toBeTruthy();
  });

  it("wires Dashboard allocation and progress actions", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onOpenHoldings = jest.fn();
    const onOpenProgress = jest.fn();

    store.getState().addAsset(asset);
    store.getState().addTrade({ ...buyTrade, conviction: 4 });
    store.getState().upsertQuote({
      asOf: "2026-04-22T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR",
      price: 150,
      source: "yahoo",
    });

    const { getByTestId } = render(
      <DashboardScreen
        onOpenHoldings={onOpenHoldings}
        onOpenProgress={onOpenProgress}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("dashboard-open-holdings"));
    fireEvent.press(getByTestId("dashboard-open-progress"));

    expect(onOpenHoldings).toHaveBeenCalledTimes(1);
    expect(onOpenProgress).toHaveBeenCalledTimes(1);
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

    const { getByText, queryByTestId, queryByText } = render(
      <DashboardScreen store={store} />,
    );

    expect(getByText("₹330")).toBeTruthy();
    expect(getByText("Portfolio value")).toBeTruthy();
    expect(getByText("+₹27.27 (+10.00%) today")).toBeTruthy();
    expect(getByText("Allocation")).toBeTruthy();
    expect(getByText("Equity")).toBeTruthy();
    expect(getByText("Open Holdings")).toBeTruthy();
    expect(getByText("Cash")).toBeTruthy();
    expect(getByText("Quotes updated")).toBeTruthy();
    expect(getByText("22 Apr 2026 • Live refresh available")).toBeTruthy();
    expect(getByText("Record monthly snapshot")).toBeTruthy();
    expect(getByText("Open Progress")).toBeTruthy();
    expect(getByText("This Month")).toBeTruthy();
    expect(getByText("Cash change")).toBeTruthy();
    expect(getByText("Not enough data")).toBeTruthy();
    expect(queryByText("Cash balance")).toBeNull();
    expect(queryByText("Holdings")).toBeNull();
    expect(queryByText("Quote Status")).toBeNull();
    expect(queryByText("Portfolio Rollups")).toBeNull();
    expect(queryByText("View details")).toBeNull();
    expect(queryByTestId("add-trade-button")).toBeNull();
    expect(getByText("Conviction data needs more trades")).toBeTruthy();
    expect(getByText("1 of 5 trades rated. Keep conviction optional, but useful.")).toBeTruthy();
    expect(queryByText(/LTCG/i)).toBeNull();
    expect(queryByText(/Minimal Mode/i)).toBeNull();
  });

  it("groups stock and ETF allocation into one Equity row for Dashboard display", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addAsset(etfAsset);
    store.getState().addTrade(buyTrade);
    store.getState().addTrade(etfBuyTrade);
    store.getState().upsertQuote({
      asOf: "2026-04-22T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR",
      price: 150,
      source: "yahoo",
    });
    store.getState().upsertQuote({
      asOf: "2026-04-22T10:00:00.000Z",
      assetId: etfAsset.id,
      currency: "INR",
      price: 120,
      source: "yahoo",
    });

    const { getAllByText, getByTestId } = render(<DashboardScreen store={store} />);

    expect(getByTestId("dashboard-allocation-visual")).toBeTruthy();
    expect(getAllByText("Equity")).toHaveLength(1);
    expect(getAllByText("100.00% · ₹420")).toHaveLength(1);
  });

  it("keeps portfolio answer, allocation, quotes, and next review in the accepted order", () => {
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
    const testIds = collectTestIds(screen.toJSON());

    const heroIndex = indexOfText(testIds, "dashboard-portfolio-hero");
    const metricsIndex = indexOfText(testIds, "dashboard-top-metrics");
    const allocationIndex = indexOfText(testIds, "dashboard-allocation-card");
    const quotesIndex = indexOfText(testIds, "dashboard-quote-card");
    const reviewIndex = indexOfText(testIds, "dashboard-next-review-card");

    expect(metricsIndex).toBeGreaterThan(heroIndex);
    expect(allocationIndex).toBeGreaterThan(metricsIndex);
    expect(quotesIndex).toBeGreaterThan(allocationIndex);
    expect(reviewIndex).toBeGreaterThan(quotesIndex);
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
    expect(getAllByText("+50.00%").length).toBeGreaterThan(0);
  });
});

function collectTestIds(node: unknown): string[] {
  if (!node || typeof node !== "object") {
    return [];
  }

  if (Array.isArray(node)) {
    return node.flatMap(collectTestIds);
  }

  const candidate = node as {
    children?: unknown;
    props?: { testID?: unknown };
  };
  const ownTestId =
    typeof candidate.props?.testID === "string" ? [candidate.props.testID] : [];

  return [...ownTestId, ...collectTestIds(candidate.children)];
}

function indexOfText(textNodes: string[], expectedText: string) {
  const index = textNodes.indexOf(expectedText);
  expect(index).toBeGreaterThanOrEqual(0);

  return index;
}
