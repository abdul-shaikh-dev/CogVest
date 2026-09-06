import {
  act,
  fireEvent,
  render,
  waitFor,
  within,
  type RenderAPI,
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
    expect(getByText("Price coverage needs attention")).toBeTruthy();
    expect(queryByText("Current 0 · Stale 0 · Manual 0 · Missing 1")).toBeNull();
    expect(queryByText("Current holdings, cash and recorded PPF balances, using available prices. Not a month-end snapshot.")).toBeNull();
    fireEvent.press(getByTestId("dashboard-price-details-toggle"));
    expect(getByTestId("dashboard-price-details")).toBeTruthy();
    expect(getByText("Current 0 · Stale 0 · Manual 0 · Missing 1")).toBeTruthy();
    expect(queryByText(/at saved quotes/u)).toBeNull();
    expect(getByText("Allocation unavailable")).toBeTruthy();
    expect(getAllByText("Unavailable").length).toBeGreaterThan(0);

    fireEvent.press(getByTestId("dashboard-mask-toggle"));
    expect(getByText(/1 holding need a price/u)).toBeTruthy();
    expect(getByText("Valuation pending")).toBeTruthy();

    fireEvent.press(getByTestId("dashboard-refresh-pending-prices"));

    await waitFor(() => {
      expect(refreshQuotes).toHaveBeenCalledTimes(1);
      expect(queryByText(/holding need a price/u)).toBeNull();
    });
  });

  it("shows the empty dashboard with a zero total and Add Holding action", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onAddTrade = jest.fn();

    const { getAllByText, getByTestId, getByText, queryByText } = render(
      <DashboardScreen store={store} onAddTrade={onAddTrade} />,
    );

    expect(getByTestId("dashboard-screen")).toBeTruthy();
    expect(getByTestId("add-trade-button")).toBeTruthy();
    expect(getByText("No market prices needed")).toBeTruthy();
    expect(queryByText("Cash and recorded PPF balances do not need market quotes.")).toBeNull();
    fireEvent.press(getByTestId("dashboard-price-details-toggle"));
    expect(getByText("Cash and recorded PPF balances do not need market quotes.")).toBeTruthy();
    expect(getAllByText("₹0").length).toBeGreaterThan(0);
    expect(getByText("No allocation yet")).toBeTruthy();
    expect(
      getByText("Add your first portfolio entry to build holdings automatically."),
    ).toBeTruthy();

    fireEvent.press(getByText("Add Holding"));

    expect(onAddTrade).toHaveBeenCalledTimes(1);
  });

  it("toggles price basis and saved-quote movement through an accessible disclosure", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(buyTrade);
    store.getState().upsertQuote({
      asOf: "2026-05-16T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR",
      dayChangePct: 10,
      price: 150,
      source: "yahoo",
    });

    const screen = render(
      <DashboardScreen
        now={new Date("2026-05-16T10:05:00.000Z")}
        store={store}
      />,
    );
    const toggle = screen.getByTestId("dashboard-price-details-toggle");

    expect(toggle.props.accessibilityLabel).toBe("Price details. Prices up to date");
    expect(toggle.props.accessibilityState).toEqual({ expanded: false });
    expect(screen.getByText("Prices up to date")).toBeTruthy();
    expect(screen.getByText("Details")).toBeTruthy();
    expect(screen.queryByTestId("dashboard-price-details")).toBeNull();
    expect(screen.queryByText(/Current holdings, cash/u)).toBeNull();
    expect(screen.queryByText(/Current 1 · Stale 0 · Manual 0 · Missing 0/u)).toBeNull();
    expect(screen.queryByText(/at saved quotes/u)).toBeNull();

    fireEvent.press(toggle);

    expect(toggle.props.accessibilityState).toEqual({ expanded: true });
    const details = within(screen.getByTestId("dashboard-price-details"));
    expect(screen.getByText("Hide details")).toBeTruthy();
    expect(
      details.getByText(
        "Current holdings, cash and recorded PPF balances, using available prices. Not a month-end snapshot.",
      ),
    ).toBeTruthy();
    expect(details.getByText("Current 1 · Stale 0 · Manual 0 · Missing 0")).toBeTruthy();
    expect(details.getByText("+₹27.27 (+10.00%) at saved quotes")).toBeTruthy();
    expect(
      details.getByText(
        "Saved-quote movement is not your portfolio return and may cover different price dates.",
      ),
    ).toBeTruthy();

    fireEvent.press(toggle);

    expect(toggle.props.accessibilityState).toEqual({ expanded: false });
    expect(screen.queryByTestId("dashboard-price-details")).toBeNull();
    expect(screen.queryByText("Current 1 · Stale 0 · Manual 0 · Missing 0")).toBeNull();
    expect(screen.queryByText("+₹27.27 (+10.00%) at saved quotes")).toBeNull();
  });

  it("labels a manual quote and keeps its count behind the disclosure", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(buyTrade);
    store.getState().upsertQuote({
      asOf: "2026-05-16T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR",
      dayChangePct: 4,
      price: 125,
      source: "manual",
    });

    const screen = render(
      <DashboardScreen
        now={new Date("2026-05-16T10:05:00.000Z")}
        store={store}
      />,
    );

    expect(screen.getByText("Using manual prices")).toBeTruthy();
    expect(screen.queryByText("Current 0 · Stale 0 · Manual 1 · Missing 0")).toBeNull();
    expandPriceDetails(screen);
    expect(screen.getByText("Current 0 · Stale 0 · Manual 1 · Missing 0")).toBeTruthy();
  });

  it("offers resumable setup before the single-holding action", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onAddTrade = jest.fn();
    const onQuickSetup = jest.fn();
    const { getByTestId, getByText } = render(
      <DashboardScreen
        onAddTrade={onAddTrade}
        onQuickSetup={onQuickSetup}
        quickSetupSavedCount={2}
        store={store}
      />,
    );

    expect(getByText("Continue portfolio setup")).toBeTruthy();
    expect(getByText("2 holdings are already saved. Continue when ready.")).toBeTruthy();
    fireEvent.press(getByTestId("quick-setup-button"));
    fireEvent.press(getByTestId("add-trade-button"));

    expect(onQuickSetup).toHaveBeenCalledTimes(1);
    expect(onAddTrade).toHaveBeenCalledTimes(1);
  });

  it("keeps active setup discoverable after the portfolio is populated", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addOpeningPosition({
      assetId: asset.id,
      averageCostPrice: 100,
      date: null,
      id: "opening-visible-setup",
      quantity: 2,
    });
    store.getState().upsertQuote({
      asOf: "2026-08-15T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR",
      price: 125,
      source: "yahoo",
    });
    const onQuickSetup = jest.fn();
    const { getByTestId } = render(
      <DashboardScreen
        onQuickSetup={onQuickSetup}
        quickSetupSavedCount={1}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("dashboard-continue-setup-button"));
    expect(onQuickSetup).toHaveBeenCalledTimes(1);
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

    const screen = render(
      <DashboardScreen
        now={new Date("2026-05-16T10:05:00.000Z")}
        refreshQuotes={refreshQuotes}
        store={store}
      />,
    );

    fireEvent.press(screen.getByLabelText("Mask values"));
    expect(store.getState().preferences.maskWealthValues).toBe(true);

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Refresh quotes"));
    });

    await waitFor(() => {
      expect(refreshQuotes).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Prices up to date")).toBeTruthy();
    expect(screen.queryByText("Current 1 · Stale 0 · Manual 0 · Missing 0")).toBeNull();
    expandPriceDetails(screen);
    expect(screen.getByText("Current 1 · Stale 0 · Manual 0 · Missing 0")).toBeTruthy();
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

    const screen = render(
      <DashboardScreen
        now={new Date("2026-05-16T10:05:00.000Z")}
        refreshQuotes={refreshQuotes}
        store={store}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Refresh quotes"));
    });

    await waitFor(() => {
      expect(
        screen.getByText("Refresh partially completed"),
      ).toBeTruthy();
    });
    expect(screen.queryByText(/Current 0 · Stale 1/u)).toBeNull();
    expandPriceDetails(screen);
    expect(
      screen.getByText(
        "Current 0 · Stale 1 · Manual 0 · Missing 0. 1 failed. Existing prices remain available.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Prices up to date/u)).toBeNull();
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

    const screen = render(
      <DashboardScreen
        now={new Date("2026-05-16T10:05:00.000Z")}
        refreshQuotes={refreshQuotes}
        store={store}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Refresh quotes"));
    });

    await waitFor(() => {
      expect(screen.getByText("Quote refresh failed")).toBeTruthy();
    });
    expandPriceDetails(screen);
    expect(
      screen.getByText(
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

    const screen = render(
      <DashboardScreen
        now={new Date("2026-05-16T10:05:00.000Z")}
        store={store}
      />,
    );

    expect(screen.getByText("Price coverage needs attention")).toBeTruthy();
    expect(screen.queryByText("Current 1 · Stale 0 · Manual 0 · Missing 1")).toBeNull();
    expandPriceDetails(screen);
    expect(
      screen.getByText("Current 1 · Stale 0 · Manual 0 · Missing 1"),
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

    const screen = render(
      <DashboardScreen store={store} />,
    );

    expect(screen.getByText("₹330")).toBeTruthy();
    expect(screen.getByText("Portfolio value")).toBeTruthy();
    expect(screen.getByText("Allocation")).toBeTruthy();
    expect(screen.getByText("Equity")).toBeTruthy();
    expect(screen.getByText("Open Holdings")).toBeTruthy();
    expect(screen.getByText("Cash")).toBeTruthy();
    expect(screen.getByText("Using older saved prices")).toBeTruthy();
    expect(screen.queryByText("Current 0 · Stale 1 · Manual 0 · Missing 0")).toBeNull();
    expect(screen.queryByText("+₹27.27 (+10.00%) at saved quotes")).toBeNull();
    expandPriceDetails(screen);
    expect(screen.getByText("+₹27.27 (+10.00%) at saved quotes")).toBeTruthy();
    expect(screen.getByText("Current 0 · Stale 1 · Manual 0 · Missing 0")).toBeTruthy();
    expect(screen.getByText("Month-end snapshot")).toBeTruthy();
    expect(screen.getByText("Open Progress")).toBeTruthy();
    expect(screen.getByText("This Month")).toBeTruthy();
    expect(screen.getByText("Cash change")).toBeTruthy();
    expect(screen.getByText("Not enough data")).toBeTruthy();
    expect(screen.queryByText("Cash balance")).toBeNull();
    expect(screen.queryByText("Holdings")).toBeNull();
    expect(screen.queryByText("Quote Status")).toBeNull();
    expect(screen.queryByText("Portfolio Rollups")).toBeNull();
    expect(screen.queryByText("View details")).toBeNull();
    expect(screen.queryByTestId("add-trade-button")).toBeNull();
    expect(screen.getByText("Conviction data needs more trades")).toBeTruthy();
    expect(screen.getByText("1 of 5 trades rated. Keep conviction optional, but useful.")).toBeTruthy();
    expect(screen.queryByText(/LTCG/i)).toBeNull();
    expect(screen.queryByText(/Minimal Mode/i)).toBeNull();
  });

  it("keeps essential portfolio evidence while removing optional commentary in Minimal mode", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade({ ...buyTrade, conviction: 4 });
    store.getState().upsertQuote({
      asOf: "2026-04-22T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR",
      dayChangePct: 10,
      price: 150,
      source: "yahoo",
    });
    store.getState().updatePreferences({ displayMode: "minimal" });

    const screen = render(
      <DashboardScreen store={store} />,
    );

    expect(screen.getByText("Portfolio value")).toBeTruthy();
    expect(screen.getByText("Holdings P&L")).toBeTruthy();
    expect(screen.getByText("Allocation")).toBeTruthy();
    expect(screen.getByText("Month-end snapshot")).toBeTruthy();
    expect(screen.queryByText("This Month")).toBeNull();
    expect(screen.queryByText(/Conviction data/u)).toBeNull();
    expect(screen.queryByText("+₹27.27 (+10.00%) at saved quotes")).toBeNull();
    expandPriceDetails(screen);
    expect(screen.getByText("+₹27.27 (+10.00%) at saved quotes")).toBeTruthy();
  });

  it.each(["standard", "minimal"] as const)("hides the daily monetary change in masked %s mode", (displayMode) => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(buyTrade);
    store.getState().upsertQuote({
      asOf: "2026-04-22T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR",
      dayChangePct: 10,
      price: 150,
      source: "yahoo",
    });
    store.getState().updatePreferences({ displayMode, maskWealthValues: true });

    const screen = render(<DashboardScreen store={store} />);

    expect(screen.queryByText("+10.00% at saved quotes")).toBeNull();
    expandPriceDetails(screen);
    expect(screen.getByText("+10.00% at saved quotes")).toBeTruthy();
    expect(screen.queryByText(/today/u)).toBeNull();
    expect(screen.queryByText(/27\.27/u)).toBeNull();
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

    const { getByTestId, getByText, queryByTestId } = render(
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
    const allocationCard = within(getByTestId("dashboard-allocation-card"));
    expect(allocationCard.getByText("150.00% ·")).toBeTruthy();
    expect(allocationCard.getByText("₹300")).toBeTruthy();
    expect(allocationCard.getByText("-50.00% ·")).toBeTruthy();
    expect(allocationCard.getByText("-₹100")).toBeTruthy();
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

    const screen = render(
      <DashboardScreen
        now={new Date("2026-04-22T10:05:00.000Z")}
        store={store}
      />,
    );

    expect(screen.getByText("Negative cash balance")).toBeTruthy();
    expect(screen.getByText("Portfolio composition")).toBeTruthy();
    expect(screen.getByText("Cash")).toBeTruthy();
    expect(screen.getByText("No market prices needed")).toBeTruthy();
    expect(screen.queryByText(/at saved quotes/u)).toBeNull();
    expandPriceDetails(screen);
    expect(screen.getByText("Cash and recorded PPF balances do not need market quotes.")).toBeTruthy();
    expect(screen.queryByText(/at saved quotes/u)).toBeNull();
    expect(screen.getAllByText(MASKED_INR_VALUE).length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText("-₹500")).toBeNull();
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

    const { getByTestId } = render(<DashboardScreen store={store} />);

    const allocationCard = within(getByTestId("dashboard-allocation-card"));
    expect(getByTestId("dashboard-allocation-visual")).toBeTruthy();
    expect(allocationCard.getAllByText("Equity")).toHaveLength(1);
    expect(allocationCard.getAllByText("100.00% ·")).toHaveLength(1);
    expect(allocationCard.getAllByText("₹420")).toHaveLength(1);
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
    const quoteIndex = indexOfText(testIds, "dashboard-quote-card");
    const allocationIndex = indexOfText(testIds, "dashboard-allocation-card");
    const supportIndex = indexOfText(testIds, "dashboard-support-card");

    expect(metricsIndex).toBeGreaterThan(heroIndex);
    expect(quoteIndex).toBeGreaterThan(metricsIndex);
    expect(quoteIndex).toBeLessThan(allocationIndex);
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

  it("keeps allocation percentages visible while masking allocation values", () => {
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

    const { getAllByText, getByText, queryByText } = render(
      <DashboardScreen store={store} />,
    );

    expect(getByText("100.00% ·")).toBeTruthy();
    expect(getAllByText(MASKED_INR_VALUE).length).toBeGreaterThan(0);
    expect(queryByText("₹300")).toBeNull();
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

function expandPriceDetails(screen: RenderAPI) {
  const toggle = screen.getByTestId("dashboard-price-details-toggle");

  expect(toggle.props.accessibilityState).toEqual({ expanded: false });
  expect(screen.queryByTestId("dashboard-price-details")).toBeNull();

  fireEvent.press(toggle);

  expect(toggle.props.accessibilityState).toEqual({ expanded: true });
  expect(screen.getByTestId("dashboard-price-details")).toBeTruthy();
}

function indexOfText(textNodes: string[], expectedText: string) {
  const index = textNodes.indexOf(expectedText);
  expect(index).toBeGreaterThanOrEqual(0);

  return index;
}
