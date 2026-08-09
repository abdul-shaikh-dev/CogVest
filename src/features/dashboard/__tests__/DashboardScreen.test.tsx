import {
  act,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react-native";

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

const unsupportedForeignAsset: Asset = {
  assetClass: "stock",
  currency: "USD",
  id: "asset-aapl",
  name: "Apple",
  symbol: "AAPL",
  ticker: "AAPL",
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
  it("shows incomplete valuation honestly and resolves it after quote refresh", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addOpeningPosition({
      assetId: asset.id,
      averageCostPrice: 100,
      date: "2026-04-20",
      id: "opening-pending",
      quantity: 2,
    });
    const refreshQuotes = jest.fn().mockResolvedValue({
      failed: [],
      quoteCache: {
        [asset.id]: {
          asOf: "2026-08-09T10:00:00.000Z",
          assetId: asset.id,
          currency: "INR",
          price: 125,
          source: "yahoo",
        },
      },
      timedOut: [],
    });
    const { getAllByText, getByTestId, getByText, queryByText } = render(
      <DashboardScreen refreshQuotes={refreshQuotes} store={store} />,
    );

    expect(getByText(/1 holding need a price/u)).toBeTruthy();
    expect(getByText("Allocation unavailable")).toBeTruthy();
    expect(getAllByText("Unavailable").length).toBeGreaterThan(0);

    fireEvent.press(getByTestId("dashboard-mask-toggle"));
    expect(getByText(/1 holding need a price/u)).toBeTruthy();

    fireEvent.press(getByTestId("dashboard-refresh-pending-prices"));

    await waitFor(() => {
      expect(refreshQuotes).toHaveBeenCalledTimes(1);
      expect(queryByText(/holding need a price/u)).toBeNull();
    });
  });

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

  it("warns about retained foreign data and excludes it from INR totals", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.setState({
      assets: [unsupportedForeignAsset],
      quoteCache: {
        [unsupportedForeignAsset.id]: {
          asOf: "2026-05-16T10:00:00.000Z",
          assetId: unsupportedForeignAsset.id,
          currency: "USD",
          price: 200,
          source: "yahoo",
        },
      },
      trades: [
        {
          ...buyTrade,
          assetId: unsupportedForeignAsset.id,
        },
      ],
    });

    const { getAllByText, getByTestId, getByText } = render(
      <DashboardScreen store={store} />,
    );

    expect(getByTestId("dashboard-currency-warning")).toBeTruthy();
    expect(getByText("Unsupported data excluded")).toBeTruthy();
    expect(getByText(/Apple uses USD/u)).toBeTruthy();
    expect(getAllByText("₹0").length).toBeGreaterThan(0);
  });

  it("wires Dashboard header value masking and quote refresh actions", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(buyTrade);
    const refreshQuotes = jest.fn().mockResolvedValue({
      failed: [],
      quoteCache: {
        [asset.id]: {
          asOf: "2026-05-16T10:00:00.000Z",
          assetId: asset.id,
          currency: "INR",
          price: 175,
          source: "yahoo",
        },
      },
      timedOut: [],
      updated: [asset.id],
    });

    const { getByLabelText, getByText } = render(
      <DashboardScreen
        now={new Date("2026-05-16T10:05:00.000Z")}
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
    expect(getByText("Prices up to date")).toBeTruthy();
    expect(getByText("Current 1 · Stale 0 · Manual 0 · Missing 0")).toBeTruthy();
  });

  it("describes failed refreshes as last-known prices", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(buyTrade);
    const cachedQuote = {
      asOf: "2026-05-15T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR" as const,
      price: 165,
      source: "yahoo" as const,
    };
    store.getState().upsertQuote(cachedQuote);
    const refreshQuotes = jest.fn().mockResolvedValue({
      failed: [{ assetId: asset.id, error: "Provider unavailable." }],
      quoteCache: { [asset.id]: cachedQuote },
      timedOut: [],
      updated: [],
    });

    const { getByLabelText, getByText, queryByText } = render(
      <DashboardScreen
        now={new Date("2026-05-16T10:05:00.000Z")}
        refreshQuotes={refreshQuotes}
        store={store}
      />,
    );

    await act(async () => {
      fireEvent.press(getByLabelText("Refresh quotes"));
    });

    await waitFor(() => {
      expect(
        getByText("Refresh partially completed"),
      ).toBeTruthy();
    });
    expect(
      getByText(
        "Current 0 · Stale 1 · Manual 0 · Missing 0. 1 failed. Existing prices remain available.",
      ),
    ).toBeTruthy();
    expect(queryByText(/Prices up to date/u)).toBeNull();
  });

  it("does not promise cached prices when the first refresh fails", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(buyTrade);
    const refreshQuotes = jest.fn().mockResolvedValue({
      failed: [{ assetId: asset.id, error: "Provider unavailable." }],
      quoteCache: {},
      timedOut: [],
      updated: [],
    });

    const { getByLabelText, getByText } = render(
      <DashboardScreen
        now={new Date("2026-05-16T10:05:00.000Z")}
        refreshQuotes={refreshQuotes}
        store={store}
      />,
    );

    await act(async () => {
      fireEvent.press(getByLabelText("Refresh quotes"));
    });

    await waitFor(() => {
      expect(getByText("Quote refresh failed")).toBeTruthy();
    });
    expect(
      getByText(
        "Current 0 · Stale 0 · Manual 0 · Missing 1. 1 failed. No usable prices are available.",
      ),
    ).toBeTruthy();
  });

  it("shows partial coverage when one current quote masks a missing holding", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addAsset(etfAsset);
    store.getState().addTrade(buyTrade);
    store.getState().addTrade(etfBuyTrade);
    store.getState().upsertQuote({
      asOf: "2026-05-16T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR",
      price: 175,
      source: "yahoo",
    });

    const { getByText } = render(
      <DashboardScreen
        now={new Date("2026-05-16T10:05:00.000Z")}
        store={store}
      />,
    );

    expect(getByText("Price coverage needs attention")).toBeTruthy();
    expect(
      getByText("Current 1 · Stale 0 · Manual 0 · Missing 1"),
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
      purpose: "capitalContribution",
      type: "addition",
    });
    store.getState().addCashEntry({
      amount: 20,
      date: "2026-05-05",
      id: "cash-2",
      label: "Withdrawal",
      purpose: "withdrawal",
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
    expect(getByText("Using saved prices")).toBeTruthy();
    expect(getByText("Current 0 · Stale 1 · Manual 0 · Missing 0")).toBeTruthy();
    expect(getByText("Month-end snapshot")).toBeTruthy();
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

  it("shows a negative cash liability and reconciles it to net portfolio value", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(buyTrade);
    store.getState().addCashEntry({
      amount: 400,
      date: "2026-04-22",
      id: "cash-overdraft",
      label: "Broker overdraft",
      purpose: "withdrawal",
      type: "withdrawal",
    });
    store.getState().upsertQuote({
      asOf: "2026-04-22T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR",
      price: 150,
      source: "yahoo",
    });

    const { getByTestId, getByText } = render(
      <DashboardScreen
        now={new Date("2026-04-22T10:05:00.000Z")}
        store={store}
      />,
    );

    const liabilityCard = within(getByTestId("dashboard-cash-liability"));
    expect(liabilityCard.getByText("Negative cash balance")).toBeTruthy();
    expect(liabilityCard.getByText("Gross holdings")).toBeTruthy();
    expect(liabilityCard.getByText("₹300")).toBeTruthy();
    expect(liabilityCard.getByText("Cash balance")).toBeTruthy();
    expect(liabilityCard.getByText("-₹400")).toBeTruthy();
    expect(liabilityCard.getByText("Net portfolio")).toBeTruthy();
    expect(liabilityCard.getByText("-₹100")).toBeTruthy();
    expect(getByText("Portfolio composition")).toBeTruthy();
    expect(
      getByText(
        "Allocation percentages are unavailable while net portfolio value is zero or negative.",
      ),
    ).toBeTruthy();
    expect(getByText("Cash")).toBeTruthy();
    expect(
      within(getByTestId("dashboard-allocation-card")).getByText("-₹400"),
    ).toBeTruthy();
  });

  it("shows signed net exposure when negative cash does not exhaust holdings", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(buyTrade);
    store.getState().addCashEntry({
      amount: 100,
      date: "2026-04-22",
      id: "cash-small-overdraft",
      label: "Temporary overdraft",
      purpose: "withdrawal",
      type: "withdrawal",
    });
    store.getState().upsertQuote({
      asOf: "2026-04-22T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR",
      price: 150,
      source: "yahoo",
    });

    const { getByText, queryByTestId } = render(
      <DashboardScreen
        now={new Date("2026-04-22T10:05:00.000Z")}
        store={store}
      />,
    );

    expect(getByText("Net exposure")).toBeTruthy();
    expect(
      getByText(
        "Percentages show signed exposure against net portfolio value.",
      ),
    ).toBeTruthy();
    expect(getByText("150.00% · ₹300")).toBeTruthy();
    expect(getByText("-50.00% · -₹100")).toBeTruthy();
    expect(queryByTestId("dashboard-allocation-visual")).toBeNull();
  });

  it("masks a cash-only liability without hiding its reconciliation state", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().updatePreferences({ maskWealthValues: true });
    store.getState().addCashEntry({
      amount: 500,
      date: "2026-04-22",
      id: "cash-only-overdraft",
      label: "Temporary overdraft",
      purpose: "withdrawal",
      type: "withdrawal",
    });

    const { getAllByText, getByText, queryByText } = render(
      <DashboardScreen
        now={new Date("2026-04-22T10:05:00.000Z")}
        store={store}
      />,
    );

    expect(getByText("Negative cash balance")).toBeTruthy();
    expect(getByText("Portfolio composition")).toBeTruthy();
    expect(getByText("Cash")).toBeTruthy();
    expect(getAllByText(MASKED_INR_VALUE).length).toBeGreaterThanOrEqual(4);
    expect(queryByText("-₹500")).toBeNull();
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
      purpose: "capitalContribution",
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
    const supportIndex = indexOfText(testIds, "dashboard-support-card");

    expect(metricsIndex).toBeGreaterThan(heroIndex);
    expect(allocationIndex).toBeGreaterThan(metricsIndex);
    expect(supportIndex).toBeGreaterThan(allocationIndex);
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
