import {
  act,
  fireEvent,
  render,
  waitFor,
  within,
  type RenderAPI,
} from "@testing-library/react-native";

import {
  MASKED_INR_VALUE,
  MASKED_VALUE_ACCESSIBILITY_LABEL,
} from "@/src/components/common";
import { DashboardScreen } from "@/src/features/dashboard";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { colors } from "@/src/theme";
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
  it("reconciles combined Crypto and linked PPF Debt with portfolio wealth, including masked breakdowns", () => {
    const now = new Date("2026-10-05T12:00:00Z");
    const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now: () => now });
    store.getState().addAsset({ ...asset, id: "spot", name: "Bitcoin", symbol: "BTC", ticker: "bitcoin",
      assetClass: "crypto", instrumentType: "crypto", exchange: "CRYPTO" });
    store.getState().addOpeningPosition({ id: "spot-opening", assetId: "spot", date: "2026-10-01",
      quantity: 1, averageCostPrice: 100000, currentPrice: 100000 });
    store.getState().addAsset({ ...asset, id: "old-ppf", assetClass: "debt", instrumentType: "ppf" });
    store.getState().addOpeningPosition({ id: "old-ppf-opening", assetId: "old-ppf", date: "2026-10-01",
      quantity: 1, averageCostPrice: 50000, currentPrice: 50000 });
    store.getState().addPpfAccount({ id: "ppf", nickname: "PPF", provider: "Post Office", status: "active",
      legacyAssetId: "old-ppf", balanceAsOf: "2026-10-04", confirmedBalance: 50000,
      createdAt: "2026-10-04T12:00:00Z", opening: { kind: "financialYear", financialYearStart: 2020 } });
    store.getState().saveFuturesAccount({ id: "wallet", settlementAsset: "USDT", marginMode: "cross",
      positionMode: "one-way", openingAt: "2026-10-01T12:00:00Z", openingWalletUsdt: "3000",
      events: [
        { id: "open", type: "execution", at: "2026-10-02T12:00:00Z", contract: "ETHUSDT",
          side: "buy", quantity: "1", price: "3000", feeUsdt: "0", leverage: "1" },
        { id: "close", type: "execution", at: "2026-10-03T12:00:00Z", contract: "ETHUSDT",
          side: "sell", quantity: "1", price: "4000", feeUsdt: "0", leverage: "1" },
      ],
      eventRates: [
        { eventId: "open", inrPerUsdt: "85", observedAt: "2026-10-02T12:00:00Z", source: "Recorded" },
        { eventId: "close", inrPerUsdt: "85", observedAt: "2026-10-03T12:00:00Z", source: "Recorded" },
      ],
      openingRate: { inrPerUsdt: "85", observedAt: "2026-10-01T12:00:00Z", source: "Recorded" },
      valuation: { asOf: now.toISOString(), marks: [],
        inrRate: { inrPerUsdt: "85", observedAt: now.toISOString(), source: "Recorded" },
        reconciliation: { observedWalletUsdt: "4000", observedAt: now.toISOString(), source: "Recorded",
          allOpenPositionsConfirmed: true, allWalletEventsConfirmed: true, portfolioBoundaryConfirmed: true } } });
    const before = JSON.stringify({ assets: store.getState().assets, accounts: store.getState().futuresAccounts,
      ppf: store.getState().ppfAccounts, cash: store.getState().cashEntries });
    const screen = render(<DashboardScreen store={store} now={now} />);
    expect(within(screen.getByTestId("dashboard-allocation-crypto")).getByLabelText("₹4,40,000.00")).toBeTruthy();
    expect(within(screen.getByTestId("dashboard-allocation-debt")).getByLabelText("₹50,000.00")).toBeTruthy();
    expect(screen.queryByTestId("dashboard-allocation-futures")).toBeNull();
    fireEvent.press(screen.getByTestId("dashboard-crypto-breakdown"));
    expect(screen.getByTestId("dashboard-crypto-spot").props.accessibilityLabel).toBe("₹1,00,000.00");
    expect(screen.getByTestId("dashboard-crypto-futures").props.accessibilityLabel).toBe("₹3,40,000.00");
    fireEvent.press(screen.getByTestId("dashboard-mask-toggle"));
    expect(screen.getByTestId("dashboard-crypto-futures").props.accessibilityLabel).toBe("Amount hidden");
    expect(JSON.stringify({ assets: store.getState().assets, accounts: store.getState().futuresAccounts,
      ppf: store.getState().ppfAccounts, cash: store.getState().cashEntries })).toBe(before);
  });
  it.each(["standard", "minimal"] as const)("shows incomplete valuation honestly in %s and resolves it after quote refresh", async (displayMode) => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().updatePreferences({ displayMode });
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

    expect(getByText(/1 holding needs a price/u)).toBeTruthy();
    expect(getByText("Price coverage needs attention")).toBeTruthy();
    expect(queryByText("Current 0 · Stale 0 · Manual 0 · Missing 1")).toBeNull();
    expect(queryByText("Current holdings, cash and recorded PPF balances, using available prices. Not a month-end snapshot.")).toBeNull();
    fireEvent.press(getByTestId("dashboard-price-details-toggle"));
    expect(getByTestId("dashboard-price-details")).toBeTruthy();
    expect(getByText("Current 0 · Stale 0 · Manual 0 · Missing 1")).toBeTruthy();
    expect(queryByText(/at saved quotes/u)).toBeNull();
    expect(getByText("Allocation unavailable")).toBeTruthy();
    if (displayMode === "minimal") {
      expect(queryByText("Holdings P&L")).toBeNull();
      fireEvent.press(getByTestId("dashboard-performance-toggle"));
    }
    expect(getAllByText("Unavailable").length).toBeGreaterThan(0);

    fireEvent.press(getByTestId("dashboard-mask-toggle"));
    expect(getByText(/1 holding needs a price/u)).toBeTruthy();
    expect(getByText("Valuation pending")).toBeTruthy();

    fireEvent.press(getByTestId("dashboard-refresh-pending-prices"));

    await waitFor(() => {
      expect(refreshQuotes).toHaveBeenCalledTimes(1);
      expect(queryByText(/holding need a price/u)).toBeNull();
    });
  });

  it("prioritizes entry on a truly empty dashboard instead of zero summaries", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onAddTrade = jest.fn();

    const { getAllByText, getByTestId, getByText, queryByText } = render(
      <DashboardScreen store={store} onAddTrade={onAddTrade} />,
    );

    expect(getByTestId("dashboard-screen")).toBeTruthy();
    expect(getByTestId("add-trade-button")).toBeTruthy();
    expect(queryByText("No market prices needed")).toBeNull();
    expect(queryByText("Cash and recorded PPF balances do not need market quotes.")).toBeNull();
    expect(queryByText("₹0")).toBeNull();
    expect(queryByText("No allocation yet")).toBeNull();
    expect(getByText("Your portfolio starts here")).toBeTruthy();
    expect(
      getByText("Add holdings manually or import your statements. Your records stay on this device."),
    ).toBeTruthy();

    fireEvent.press(getByText("Add Holding"));

    expect(onAddTrade).toHaveBeenCalledTimes(1);
  });

  it("retains summaries for a zero-net ledger and hides unused Futures allocation", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addCashEntry({ id: "deposit", date: "2026-09-01", amount: 100,
      label: "Contribution", purpose: "capitalContribution", type: "addition" });
    store.getState().addCashEntry({ id: "withdrawal", date: "2026-09-02", amount: 100,
      label: "Withdrawal", purpose: "withdrawal", type: "withdrawal" });
    const screen = render(<DashboardScreen store={store} now={new Date("2026-09-29T12:00:00Z")} />);
    expect(screen.queryByText("Your portfolio starts here")).toBeNull();
    expect(screen.getByTestId("dashboard-portfolio-hero")).toBeTruthy();
    expect(screen.queryByText("Futures equity")).toBeNull();
  });

  it("hides unused Futures allocation without hiding a real zero-wallet account", () => {
    const now = new Date("2026-09-29T12:00:00Z");
    const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now: () => now });
    store.getState().addCashEntry({ id: "cash", date: "2026-09-01", amount: 100,
      label: "Contribution", purpose: "capitalContribution", type: "addition" });
    const screen = render(<DashboardScreen store={store} now={now} />);
    expect(screen.getByTestId("dashboard-allocation-card")).toBeTruthy();
    expect(screen.queryByText("Futures equity")).toBeNull();
    act(() => store.getState().saveFuturesAccount({ id: "zero-wallet", settlementAsset: "USDT",
      marginMode: "cross", positionMode: "one-way", openingAt: "2026-09-01T00:00:00Z",
      openingWalletUsdt: "0", events: [] }));
    expect(screen.getByTestId("dashboard-futures-status")).toBeTruthy();
    expect(screen.queryByText("Your portfolio starts here")).toBeNull();
    act(() => store.getState().saveFuturesAccount({ ...store.getState().futuresAccounts[0],
      openingRate: { inrPerUsdt: "90", observedAt: "2026-09-01T00:00:00Z", source: "Recorded rate" },
      valuation: { asOf: "2026-09-29T12:00:00Z", marks: [],
        inrRate: { inrPerUsdt: "90", observedAt: "2026-09-29T12:00:00Z", source: "Observed rate" },
        reconciliation: { observedWalletUsdt: "0", observedAt: "2026-09-29T12:00:00Z",
          source: "Observed wallet", allOpenPositionsConfirmed: true,
          allWalletEventsConfirmed: true, portfolioBoundaryConfirmed: true } },
    }));
    expect(screen.queryByTestId("dashboard-allocation-futures")).toBeNull();
    fireEvent.press(screen.getByTestId("dashboard-crypto-breakdown"));
    expect(screen.getByText("Futures wallet equity")).toBeTruthy();
    expect(screen.getByTestId("dashboard-crypto-futures").props.accessibilityLabel).toBe("₹0.00");
  });

  it("does not hide unsupported-currency warnings behind first-run setup", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.setState({ assets: [unsupportedForeignAsset] });
    const screen = render(<DashboardScreen store={store} />);
    expect(screen.getByTestId("dashboard-currency-warning")).toBeTruthy();
    expect(screen.queryByText("Your portfolio starts here")).toBeNull();
  });

  it("does not present a negative Futures wallet as an empty allocation", () => {
    const now = new Date("2026-09-29T12:00:00Z");
    const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now: () => now });
    store.getState().saveFuturesAccount({
      id: "futures-negative", settlementAsset: "USDT", marginMode: "cross", positionMode: "one-way",
      openingAt: "2026-09-29T11:00:00Z", openingWalletUsdt: "10", events: [{
        type: "execution", id: "open-long", at: "2026-09-29T11:10:00Z", contract: "BTCUSDT",
        side: "buy", quantity: "1", price: "100", feeUsdt: "0", leverage: "10",
      }],
      openingRate: { inrPerUsdt: "90", observedAt: "2026-09-29T11:00:00Z", source: "Manual quote" },
      valuation: {
        asOf: "2026-09-29T11:30:00Z", marks: [{
          contract: "BTCUSDT", priceUsdt: "80", observedAt: "2026-09-29T11:30:00Z", source: "Binance mark",
        }],
        inrRate: { inrPerUsdt: "90", observedAt: "2026-09-29T11:30:00Z", source: "Manual quote" },
        reconciliation: {
          observedWalletUsdt: "10", observedAt: "2026-09-29T11:30:00Z", source: "Binance wallet",
          allOpenPositionsConfirmed: true, allWalletEventsConfirmed: true, portfolioBoundaryConfirmed: true,
        },
      },
    });
    const screen = render(<DashboardScreen now={now} store={store} />);
    expect(screen.getByText("No spot prices needed")).toBeTruthy();
    expect(screen.queryByText("No market prices needed")).toBeNull();
    expect(screen.getByText("Allocation unavailable")).toBeTruthy();
    expect(screen.getByText("Negative Futures equity cannot be shown as a share of positive holdings. Review the wallet.")).toBeTruthy();
    expect(screen.queryByText("No allocation yet")).toBeNull();
    expect(screen.getByTestId("dashboard-review-negative-futures")).toBeTruthy();
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
    expect(details.getByTestId("dashboard-exact-values")).toHaveTextContent(
      "Exact values: portfolio ₹300.00 · invested ₹200.00 · holdings P&L +₹100.00",
    );
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
      <DashboardScreen store={store} now={new Date("2026-09-11T12:00:00Z")} />,
    );

    expect(screen.getByText("₹330")).toBeTruthy();
    expect(screen.getByText("Portfolio value")).toBeTruthy();
    expect(screen.getByText("Allocation")).toBeTruthy();
    expect(screen.getByText("Equity")).toBeTruthy();
    expect(screen.getByText("Open Holdings")).toBeTruthy();
    expect(screen.getByText("Cash")).toBeTruthy();
    expect(screen.getByTestId("dashboard-allocation-bar-equity", { includeHiddenElements: true })).toHaveStyle({ width: "90.9090909090909%" });
    expect(screen.getByText("Using older saved prices")).toBeTruthy();
    expect(screen.queryByText("Current 0 · Stale 1 · Manual 0 · Missing 0")).toBeNull();
    expect(screen.queryByText("+₹27.27 (+10.00%) at saved quotes")).toBeNull();
    expandPriceDetails(screen);
    expect(screen.getByText("+₹27.27 (+10.00%) at saved quotes")).toBeTruthy();
    expect(screen.getByText("Current 0 · Stale 1 · Manual 0 · Missing 0")).toBeTruthy();
    expect(screen.getByText("Month-end snapshot")).toBeTruthy();
    expect(screen.getByText("Open Progress")).toBeTruthy();
    expect(screen.getByText("September 2026 activity")).toBeTruthy();
    expect(screen.getByText("No net investment or cash change")).toBeTruthy();
    expect(screen.getByTestId("dashboard-monthly-context")).toHaveStyle({ gap: 4 });
    expect(screen.getByText("September 2026 activity")).toHaveStyle({ fontSize: 12 });
    expect(screen.queryByText("Investment rate")).toBeNull();
    expect(screen.queryByText("Cash balance")).toBeNull();
    expect(screen.queryByText("Holdings")).toBeNull();
    expect(screen.queryByText("Quote Status")).toBeNull();
    expect(screen.queryByText("Portfolio Rollups")).toBeNull();
    expect(screen.queryByText("View details")).toBeNull();
    expect(screen.queryByTestId("add-trade-button")).toBeNull();
    expect(screen.getByTestId("dashboard-insights")).toBeTruthy();
    expect(screen.getByText("Conviction pattern")).toBeTruthy();
    expect(screen.queryByText(/LTCG/i)).toBeNull();
    expect(screen.queryByText(/Minimal Mode/i)).toBeNull();
  });

  it("shows investing activity without household income capture", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addCashEntry({ id: "activity", date: "2026-09-01", amount: 100,
      label: "Investment cash", purpose: "capitalContribution", type: "addition" });
    const screen = render(
      <DashboardScreen
        now={new Date(2026, 8, 20, 12)}
        store={store}
      />,
    );

    expect(screen.getByText("September 2026 activity")).toBeTruthy();
    expect(screen.queryByText("Investment rate")).toBeNull();
    expect(screen.queryByTestId("dashboard-record-income")).toBeNull();
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
    expect(screen.queryByTestId("dashboard-top-metrics")).toBeNull();
    expect(screen.getByTestId("dashboard-performance-toggle")).toHaveProp("accessibilityState", { expanded: false });
    expect(screen.queryByText("Holdings P&L")).toBeNull();
    expect(screen.getByText("Using older saved prices")).toBeTruthy();
    fireEvent.press(screen.getByTestId("dashboard-performance-toggle"));
    expect(screen.getByText("Holdings P&L")).toBeTruthy();
    const percentage = within(screen.getByTestId("dashboard-pnl-percent"));
    expect(percentage.getByText("Holdings P&L %")).toBeTruthy();
    expect(percentage.getByText("+50.00%")).toBeTruthy();
    expect(percentage.queryByText("Holdings P&L")).toBeNull();
    expect(screen.getByText("+50.00%")).toHaveStyle({ color: colors.profit });
    expect(screen.getByText("Allocation")).toBeTruthy();
    expect(screen.getByText("Month-end snapshot")).toBeTruthy();
    expect(screen.queryByText("This Month")).toBeNull();
    expect(screen.getByText("Stored values, not current prices")).toBeTruthy();
    expect(screen.queryByText("Progress shows stored month-end values. They can differ from current holdings and prices here.")).toBeNull();
    expect(screen.queryByTestId("dashboard-insights")).toBeNull();
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

    if (displayMode === "minimal") {
      fireEvent.press(screen.getByTestId("dashboard-performance-toggle"));
      expect(screen.getByTestId("dashboard-performance-toggle")).toHaveProp("accessibilityState", { expanded: true });
      expect(within(screen.getByTestId("dashboard-top-metrics")).queryByText(/₹\d/)).toBeNull();
      expect(within(screen.getByTestId("dashboard-top-metrics")).getAllByText(MASKED_INR_VALUE)).toHaveLength(2);
    }

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
    expect(
      allocationCard.getByText("Share of portfolio value · includes recorded PPF and Futures equity"),
    ).toBeTruthy();
    expect(allocationCard.getByText("150.00%")).toBeTruthy();
    expect(allocationCard.getByText("₹300")).toBeTruthy();
    expect(allocationCard.getByText("-50.00%")).toBeTruthy();
    expect(allocationCard.queryByText(/makes up/)).toBeNull();
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
    expect(allocationCard.getAllByText("100.00%")).toHaveLength(1);
    expect(getByTestId("dashboard-allocation-bar-equity", { includeHiddenElements: true })).toHaveStyle({ width: "100%" });
    expect(getByTestId("dashboard-allocation-bar-cash", { includeHiddenElements: true })).toHaveStyle({ width: "0%" });
    for (const label of ["Debt", "Crypto", "Cash"]) {
      expect(allocationCard.getByText(label)).toBeTruthy();
    }
    expect(allocationCard.getAllByText("₹420")).toHaveLength(1);
  });

  it("keeps portfolio answer and monthly context ahead of secondary summaries", () => {
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
    const monthlyIndex = indexOfText(testIds, "dashboard-monthly-context");
    const allocationIndex = indexOfText(testIds, "dashboard-allocation-card");
    const supportIndex = indexOfText(testIds, "dashboard-support-card");

    expect(metricsIndex).toBeGreaterThan(heroIndex);
    expect(quoteIndex).toBeGreaterThan(metricsIndex);
    expect(monthlyIndex).toBeGreaterThan(quoteIndex);
    expect(monthlyIndex).toBeLessThan(allocationIndex);
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

    const { getAllByLabelText, getAllByText, getByTestId, queryByLabelText, queryByTestId, queryByText } = render(
      <DashboardScreen store={store} />,
    );

    fireEvent.press(getByTestId("dashboard-price-details-toggle"));

    expect(getAllByText(MASKED_INR_VALUE).length).toBeGreaterThan(0);
    expect(
      getAllByLabelText(MASKED_VALUE_ACCESSIBILITY_LABEL).length,
    ).toBeGreaterThan(0);
    expect(queryByLabelText("₹300.00")).toBeNull();
    expect(queryByText("₹300.00")).toBeNull();
    expect(queryByText("+₹100.00")).toBeNull();
    expect(queryByTestId("dashboard-exact-values")).toBeNull();
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

    expect(getByText("100.00%")).toBeTruthy();
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
