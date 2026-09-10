import {
  act,
  fireEvent,
  render as renderNative,
  waitFor,
  within,
} from "@testing-library/react-native";
import type { ReactElement } from "react";
import { Modal, ScrollView } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { MASKED_INR_VALUE } from "@/src/components/common";
import { HoldingsScreen } from "@/src/features/holdings";
import { useReducedMotionPreference } from "@/src/hooks/useReducedMotionPreference";
import type {
  QuoteRefreshResult,
  RefreshQuotesInput,
} from "@/src/services/quotes";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { colors } from "@/src/theme";
import type { Asset, BuyTrade, PpfAccount } from "@/src/types";

jest.mock("@/src/hooks/useReducedMotionPreference", () => ({
  useReducedMotionPreference: jest.fn(() => true),
}));

const testSafeAreaMetrics = {
  frame: { height: 640, width: 360, x: 0, y: 0 },
  insets: { bottom: 0, left: 0, right: 0, top: 0 },
};

function render(ui: ReactElement) {
  return renderNative(
    <SafeAreaProvider initialMetrics={testSafeAreaMetrics}>
      {ui}
    </SafeAreaProvider>,
  );
}

const asset: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "asset-reliance",
  name: "Reliance Industries",
  symbol: "RELIANCE",
  ticker: "RELIANCE.NS",
};

const buyTrade: BuyTrade = {
  assetId: asset.id,
  date: "2026-04-20",
  id: "trade-buy",
  pricePerUnit: 100,
  quantity: 2,
  totalValue: 200,
  type: "buy",
};

const debtAsset: Asset = {
  assetClass: "debt",
  currency: "INR",
  id: "asset-ppf",
  instrumentType: "ppf",
  name: "Public Provident Fund",
  sectorType: "fixedIncome",
  symbol: "PPF",
  ticker: "PPF",
};

const cryptoAsset: Asset = {
  assetClass: "crypto",
  currency: "INR",
  exchange: "CRYPTO",
  id: "asset-bitcoin",
  instrumentType: "crypto",
  name: "Bitcoin",
  sectorType: "digitalAsset",
  symbol: "BTC",
  ticker: "BTC-INR",
};

function seedMixedHoldings() {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
  store.getState().addAsset(asset);
  store.getState().addAsset(debtAsset);
  store.getState().addAsset(cryptoAsset);
  store.getState().addTrade(buyTrade);
  store.getState().addOpeningPosition({
    assetId: debtAsset.id,
    averageCostPrice: 1000,
    currentPrice: 1100,
    date: "2026-04-20",
    id: "opening-ppf",
    quantity: 2,
  });
  store.getState().addOpeningPosition({
    assetId: cryptoAsset.id,
    averageCostPrice: 100,
    currentPrice: 80,
    date: "2026-04-20",
    id: "opening-bitcoin",
    quantity: 10,
  });
  store.getState().upsertQuote({
    asOf: "2026-04-20T10:00:00.000Z",
    assetId: asset.id,
    currency: "INR",
    price: 125,
    source: "yahoo",
  });

  return store;
}

function seedListHoldings(count: number) {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

  for (let index = 0; index < count; index += 1) {
    const id = `asset-list-${index + 1}`;
    const listAsset: Asset = {
      ...asset,
      id,
      name: `List holding ${index + 1}`,
      symbol: `LIST${index + 1}`,
      ticker: `LIST${index + 1}.NS`,
    };

    store.getState().addAsset(listAsset);
    store.getState().addTrade({
      ...buyTrade,
      assetId: id,
      id: `trade-list-${index + 1}`,
      totalValue: 200,
    });
    store.getState().upsertQuote({
      asOf: "2026-04-20T10:00:00.000Z",
      assetId: id,
      currency: "INR",
      price: 125,
      source: "yahoo",
    });
  }

  return store;
}

const ppfAccount: PpfAccount = {
  balanceAsOf: "2026-07-31",
  confirmedBalance: 100_000,
  createdAt: "2026-08-01T10:00:00.000Z",
  id: "ppf-1",
  nickname: "Primary PPF",
  opening: { financialYearStart: 2020, kind: "financialYear" },
  provider: "India Post",
  status: "active",
};

function seedMarketAndPpf() {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
  store.getState().addAsset(asset);
  store.getState().addAsset(cryptoAsset);
  store.getState().addTrade(buyTrade);
  store.getState().addOpeningPosition({
    assetId: cryptoAsset.id,
    averageCostPrice: 100,
    currentPrice: 80,
    date: "2026-04-20",
    id: "opening-bitcoin",
    quantity: 10,
  });
  store.getState().upsertQuote({
    asOf: "2026-04-20T10:00:00.000Z",
    assetId: asset.id,
    currency: "INR",
    price: 125,
    source: "yahoo",
  });
  store.getState().addPpfAccount(ppfAccount);
  return store;
}

describe("HoldingsScreen", () => {
  it("renders four and thirty holding fixtures with directly visible search", () => {
    const fourScreen = render(<HoldingsScreen store={seedListHoldings(4)} />);

    expect(fourScreen.getAllByTestId(/^holding-row-/)).toHaveLength(4);
    expect(fourScreen.getByTestId("holdings-search-input")).toBeTruthy();
    expect(fourScreen.queryByTestId("holdings-search-toggle")).toBeNull();
    fireEvent.changeText(
      fourScreen.getByTestId("holdings-search-input"),
      "List holding 4",
    );
    expect(fourScreen.getAllByTestId(/^holding-row-/)).toHaveLength(1);

    fourScreen.unmount();
    const thirtyScreen = render(
      <HoldingsScreen store={seedListHoldings(30)} />,
    );
    expect(thirtyScreen.getAllByTestId(/^holding-row-/)).toHaveLength(30);
    fireEvent.changeText(
      thirtyScreen.getByTestId("holdings-search-input"),
      "List holding 30",
    );
    expect(thirtyScreen.getAllByTestId(/^holding-row-/)).toHaveLength(1);
  });

  it("keeps portfolio insights behind an on-demand action", () => {
    const store = seedMixedHoldings();
    const { getByTestId, getByText, queryByText } = render(
      <HoldingsScreen store={store} />,
    );

    expect(getByTestId("holdings-insights-button")).toBeTruthy();
    expect(queryByText("Dominant position")).toBeNull();

    fireEvent.press(getByTestId("holdings-insights-button"));
    expect(getByText("Dominant position")).toBeTruthy();
    expect(getByText("Asset mix")).toBeTruthy();
    fireEvent.press(getByTestId("holdings-panel-close"));
    expect(queryByText("Dominant position")).toBeNull();
  });

  it("uses counted market and PPF destinations for mixed accounts", () => {
    const { getByTestId, getByText, queryByText } = render(
      <HoldingsScreen store={seedMarketAndPpf()} />,
    );

    expect(getByTestId("holdings-market-tab")).toHaveTextContent("Market 2");
    expect(getByTestId("holdings-ppf-tab")).toHaveTextContent("PPF 1");
    expect(getByText("Reliance Industries")).toBeTruthy();

    fireEvent.press(getByTestId("holdings-ppf-tab"));
    expect(getByText("Primary PPF")).toBeTruthy();
    expect(queryByText("Reliance Industries")).toBeNull();

    fireEvent.press(getByTestId("holdings-market-tab"));
    expect(getByText("Reliance Industries")).toBeTruthy();
  });

  it("keeps legacy PPF holdings in the counted destination and migration path", () => {
    const { getByTestId, getByText } = render(
      <HoldingsScreen
        onAddPpfAccount={jest.fn()}
        store={seedMixedHoldings()}
      />,
    );

    expect(getByTestId("holdings-market-tab")).toHaveTextContent("Market 2");
    expect(getByTestId("holdings-ppf-tab")).toHaveTextContent("PPF 1");

    fireEvent.press(getByTestId("holdings-ppf-tab"));
    expect(getByTestId("legacy-ppf-asset-ppf")).toBeTruthy();
    expect(
      getByText("Move Public Provident Fund to the PPF ledger"),
    ).toBeTruthy();
    expect(getByTestId("convert-legacy-ppf-asset-ppf")).toBeTruthy();
  });

  it("starts PPF-only portfolios at accounts without a market empty promo", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addPpfAccount(ppfAccount);
    const { getByText, queryByTestId, queryByText } = render(
      <HoldingsScreen store={store} />,
    );

    expect(queryByTestId("holdings-ppf-tab")).toBeNull();
    expect(queryByTestId("holdings-market-tab")).toBeNull();
    expect(getByText("Primary PPF")).toBeTruthy();
    expect(queryByText("No holdings yet")).toBeNull();
    expect(queryByText("No market holdings yet")).toBeNull();
  });

  it("opens More for management, transactions, and masking", () => {
    const onManageAssets = jest.fn();
    const onReviewAllTrades = jest.fn();
    const store = seedMixedHoldings();
    const { getByTestId } = render(
      <HoldingsScreen
        onManageAssets={onManageAssets}
        onReviewAllTrades={onReviewAllTrades}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("holdings-more-button"));
    fireEvent.press(getByTestId("holdings-manage-assets-button"));
    expect(onManageAssets).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId("holdings-more-button"));
    fireEvent.press(getByTestId("holdings-transactions-button"));
    expect(onReviewAllTrades).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId("holdings-more-button"));
    fireEvent.press(getByTestId("holdings-mask-toggle"));
    expect(store.getState().preferences.maskWealthValues).toBe(true);
  });

  it("closes the More panel through Android back and its close action", () => {
    const { getByTestId, queryByTestId, UNSAFE_getByType } = render(
      <HoldingsScreen store={seedMixedHoldings()} />,
    );

    fireEvent.press(getByTestId("holdings-more-button"));
    expect(getByTestId("holdings-panel-close")).toBeTruthy();
    act(() => {
      UNSAFE_getByType(Modal).props.onRequestClose();
    });
    expect(queryByTestId("holdings-panel-close")).toBeNull();

    fireEvent.press(getByTestId("holdings-more-button"));
    fireEvent.press(getByTestId("holdings-panel-close"));
    expect(queryByTestId("holdings-panel-close")).toBeNull();
  });

  it("keeps Add PPF in the Add menu", () => {
    const onAddPpfAccount = jest.fn();
    const { getByTestId } = render(
      <HoldingsScreen
        onAddPpfAccount={onAddPpfAccount}
        onAddTrade={jest.fn()}
        onQuickSetup={jest.fn()}
        store={createPortfolioStore({ storage: createMemoryJsonStorage() })}
      />,
    );

    fireEvent.press(getByTestId("holdings-add-button"));
    fireEvent.press(getByTestId("add-ppf-account"));
    expect(onAddPpfAccount).toHaveBeenCalledTimes(1);
  });

  it("excludes legacy PPF and cash from allocation without hiding their records", () => {
    const store = seedMixedHoldings();
    const cash = {
      ...asset,
      id: "cash-asset",
      symbol: "CASH",
      ticker: "CASH",
      name: "Cash holding",
      assetClass: "cash" as const,
    };
    store.getState().addAsset(cash);
    store
      .getState()
      .addOpeningPosition({
        id: "cash-opening",
        assetId: cash.id,
        quantity: 1,
        averageCostPrice: 10000,
        currentPrice: 10000,
        date: null,
      });
    const screen = render(
      <HoldingsScreen store={store} onReviewOpeningPosition={jest.fn()} />,
    );
    expect(screen.getByTestId("holding-row-cash-asset")).toBeTruthy();
    expect(
      within(screen.getByTestId(`holding-row-${asset.id}`)).getByText(
        "Allocation 23.8%",
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId("holding-row-cash-asset")).queryByText(
        /Allocation/,
      ),
    ).toBeNull();
    fireEvent.press(screen.getByTestId(`holding-row-${asset.id}`));
    expect(screen.getByText("23.8%")).toBeTruthy();
    expect(screen.getByText("First recorded purchase")).toBeTruthy();
    expect(screen.getByText("20 Apr 2026")).toBeTruthy();
    expect(screen.getByText(/Updated .*\d{2}:\d{2}/)).toBeTruthy();
    fireEvent.press(screen.getByTestId("holding-detail-back"));
    fireEvent.press(screen.getByTestId("holdings-ppf-tab"));
    expect(
      within(screen.getByTestId(`holding-row-${debtAsset.id}`)).queryByText(
        /Allocation/,
      ),
    ).toBeNull();
    fireEvent.press(screen.getByTestId(`holding-row-${debtAsset.id}`));
    expect(screen.getByText("Unavailable")).toBeTruthy();
    fireEvent.press(screen.getByTestId("holding-view-records"));
    expect(
      screen.getByTestId("review-opening-position-opening-ppf"),
    ).toBeTruthy();
  });

  it("keeps pending status readable while masking wealth", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(buyTrade);
    store.getState().updatePreferences({ maskWealthValues: true });
    const { getByText, getAllByText, getByTestId } = render(
      <HoldingsScreen store={store} />,
    );
    expect(getByText("Valuation pending")).toBeTruthy();
    expect(getAllByText(MASKED_INR_VALUE).length).toBeGreaterThan(0);
    fireEvent.press(getByTestId(`holding-row-${asset.id}`));
    expect(
      within(getByTestId(`holding-expanded-${asset.id}`)).getAllByText(
        "Unavailable",
      ),
    ).toHaveLength(2);
  });

  it("keeps per-unit prices and percentages visible in masked expanded holdings", () => {
    const store = seedMixedHoldings();
    store.getState().updatePreferences({ maskWealthValues: true });
    const { getByTestId } = render(<HoldingsScreen store={store} />);
    fireEvent.press(getByTestId(`holding-row-${asset.id}`));
    const details = within(getByTestId(`holding-expanded-${asset.id}`));
    expect(details.getByText("₹100.00")).toBeTruthy();
    expect(details.getByText("₹125.00")).toBeTruthy();
    expect(details.getAllByText(MASKED_INR_VALUE).length).toBeGreaterThan(0);
  });

  it("shows pending valuation actions without presenting zero as current value", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onReviewOpeningPosition = jest.fn();
    store.getState().addAsset(asset);
    store.getState().addOpeningPosition({
      assetId: asset.id,
      averageCostPrice: 100,
      date: "2026-04-20",
      id: "opening-pending",
      quantity: 2,
    });
    const { getByTestId, getByText } = render(
      <HoldingsScreen
        onReviewOpeningPosition={onReviewOpeningPosition}
        store={store}
      />,
    );

    expect(getByTestId("holdings-pending-valuations")).toBeTruthy();
    expect(getByText("1 valuation pending")).toBeTruthy();
    expect(getByText("Valuation pending")).toBeTruthy();
    expect(getByText("Invested ₹200")).toBeTruthy();

    fireEvent.press(getByTestId(`holding-row-${asset.id}`));
    fireEvent.press(getByTestId(`holding-enter-manual-price-${asset.id}`));

    expect(onReviewOpeningPosition).toHaveBeenCalledWith("opening-pending");
  });

  it("withholds incomplete allocation in insights and the high-allocation filter", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addOpeningPosition({
      assetId: asset.id,
      averageCostPrice: 100,
      date: null,
      id: "opening-pending",
      quantity: 2,
    });
    const { getByTestId, getByText, queryByText } = render(
      <HoldingsScreen store={store} />,
    );
    expect(
      getByTestId("holdings-filter-high-allocation").props.accessibilityState
        .disabled,
    ).toBe(true);
    fireEvent.press(getByTestId("holdings-insights-button"));
    expect(getByText("Awaiting valuation")).toBeTruthy();
    expect(getByText("Asset mix unavailable")).toBeTruthy();
    expect(
      getByText("Unavailable while a market holding needs a price."),
    ).toBeTruthy();
    expect(queryByText(/0.00%/)).toBeNull();
  });

  it.each([true, false])("honors reduced motion (%s) for panels", (reduced) => {
    jest.mocked(useReducedMotionPreference).mockReturnValue(reduced);
    const screen = render(<HoldingsScreen store={seedMixedHoldings()} />);
    fireEvent.press(screen.getByTestId("holdings-more-button"));
    expect(screen.UNSAFE_getByType(Modal).props.animationType).toBe(
      reduced ? "none" : "fade",
    );
    jest.mocked(useReducedMotionPreference).mockReturnValue(true);
  });

  it("shows an empty state with an Add Holding action", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onAddTrade = jest.fn();

    const { getByTestId, getByText } = render(
      <HoldingsScreen store={store} onAddTrade={onAddTrade} />,
    );

    expect(getByTestId("holdings-screen")).toBeTruthy();
    expect(getByTestId("add-trade-button")).toBeTruthy();
    expect(getByText("No holdings yet")).toBeTruthy();
    expect(
      getByText(
        "Holdings are created automatically from your portfolio entries.",
      ),
    ).toBeTruthy();

    fireEvent.press(getByText("Add Holding"));

    expect(onAddTrade).toHaveBeenCalledTimes(1);
  });

  it("shows the locked review hierarchy and compact holding information", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(buyTrade);
    store.getState().upsertQuote({
      asOf: "2026-04-20T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR",
      price: 125,
      source: "yahoo",
    });

    const { getAllByText, getByTestId, getByText, queryByText } = render(
      <HoldingsScreen store={store} />,
    );

    expect(getByTestId("holdings-insights-button")).toBeTruthy();
    expect(queryByText("Dominant position")).toBeNull();
    expect(queryByText("Best return")).toBeNull();
    expect(queryByText("Top 3")).toBeNull();
    expect(getByText("All 1")).toBeTruthy();
    expect(getByText("Winners 1")).toBeTruthy();
    expect(getByText("Losers 0")).toBeTruthy();
    expect(getByText("High allocation 1")).toBeTruthy();
    expect(getAllByText("Reliance Industries").length).toBeGreaterThan(0);
    expect(getByText("RELIANCE · Stock")).toBeTruthy();
    expect(getByText("₹250")).toBeTruthy();
    expect(getByText("+25.00%")).toBeTruthy();
    expect(getByText("Invested ₹200")).toBeTruthy();
    expect(getByText("Allocation 100.0%")).toBeTruthy();
    expect(queryByText("Live price")).toBeNull();
    expect(queryByText("Manual price")).toBeNull();
    expect(queryByText(/fallback/i)).toBeNull();
    expect(queryByText("Quantity")).toBeNull();
    expect(queryByText(/LTCG/i)).toBeNull();

    fireEvent.press(getByTestId("holdings-insights-button"));
    expect(getByText("Dominant position")).toBeTruthy();
    expect(getByText("Asset mix")).toBeTruthy();
  });

  it("keeps scannable holdings and exposure while hiding review prompts in Minimal mode", () => {
    const store = seedMixedHoldings();
    store.getState().updatePreferences({ displayMode: "minimal" });

    const { getAllByText, getByText, queryByTestId, queryByText } = render(
      <HoldingsScreen store={store} />,
    );

    expect(queryByTestId("holdings-insights-button")).toBeNull();
    expect(getAllByText("Reliance Industries").length).toBeGreaterThan(0);
    expect(getByText("Invested ₹200")).toBeTruthy();
    expect(getByText("+25.00%")).toBeTruthy();
    expect(queryByText("Dominant position")).toBeNull();
    expect(queryByText("Best return")).toBeNull();
  });

  it("opens separate details and preserves search and filter on both back actions", () => {
    const screen = render(<HoldingsScreen store={seedMixedHoldings()} />);
    fireEvent.changeText(
      screen.getByTestId("holdings-search-input"),
      "Reliance",
    );
    fireEvent.press(screen.getByTestId("holdings-filter-winners"));
    const list = screen.getByTestId("holdings-list");
    fireEvent.press(screen.getByTestId(`holding-row-${asset.id}`));
    expect(screen.getByTestId("holding-detail-modal")).toBeTruthy();
    expect(within(list).queryByText("Quantity")).toBeNull();
    expect(screen.getByTestId(`holding-quantity-${asset.id}`)).toBeTruthy();
    expect(screen.getByText("Avg cost")).toBeTruthy();
    expect(screen.getByText("Price source")).toBeTruthy();
    fireEvent.press(screen.getByTestId("holding-detail-back"));
    expect(screen.queryByTestId("holding-detail-modal")).toBeNull();
    expect(screen.getByTestId("holdings-search-input").props.value).toBe(
      "Reliance",
    );
    expect(
      screen.getByTestId("holdings-filter-winners").props.accessibilityState
        .selected,
    ).toBe(true);
    fireEvent.press(screen.getByTestId(`holding-row-${asset.id}`));
    act(() => {
      screen
        .UNSAFE_getAllByType(Modal)
        .find((modal) => modal.props.testID === "holding-detail-modal")!
        .props.onRequestClose();
    });
    expect(screen.queryByTestId("holding-detail-modal")).toBeNull();
    expect(screen.getByTestId("holdings-search-input").props.value).toBe(
      "Reliance",
    );
  });

  it("exposes a Sell / redeem action from expanded holding details", () => {
    const store = seedMixedHoldings();
    const onSellRedeem = jest.fn();
    const { getByTestId } = render(
      <HoldingsScreen store={store} onSellRedeem={onSellRedeem} />,
    );

    fireEvent.press(getByTestId(`holding-row-${asset.id}`));
    fireEvent.press(getByTestId(`holding-sell-redeem-${asset.id}`));

    expect(onSellRedeem).toHaveBeenCalledWith(asset.id);
  });

  it("opens a scalable transaction history from an expanded holding", () => {
    const store = seedMixedHoldings();
    const onReviewTrades = jest.fn();
    const { getByTestId } = render(
      <HoldingsScreen store={store} onReviewTrades={onReviewTrades} />,
    );

    fireEvent.press(getByTestId(`holding-row-${asset.id}`));
    fireEvent.press(getByTestId("holding-view-records"));
    fireEvent.press(getByTestId(`review-transactions-${asset.id}`));

    expect(onReviewTrades).toHaveBeenCalledWith(asset.id);
  });

  it("keeps all transaction history reachable after a holding is fully sold", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onReviewAllTrades = jest.fn();
    const onManageAssets = jest.fn();
    store.getState().addAsset(asset);
    store.getState().addTrade(buyTrade);
    store.getState().addTrade({
      ...buyTrade,
      id: "trade-sale",
      totalValue: 220,
      type: "sell",
    });
    const { getByTestId, getByText } = render(
      <HoldingsScreen
        onManageAssets={onManageAssets}
        onReviewAllTrades={onReviewAllTrades}
        store={store}
      />,
    );

    expect(getByText("No holdings yet")).toBeTruthy();
    fireEvent.press(getByTestId("holdings-more-button"));
    fireEvent.press(getByTestId("holdings-transactions-button"));
    expect(onReviewAllTrades).toHaveBeenCalledTimes(1);
    fireEvent.press(getByTestId("holdings-more-button"));
    fireEvent.press(getByTestId("holdings-manage-assets-button"));
    expect(onManageAssets).toHaveBeenCalledTimes(1);
  });

  it("exposes each opening record for correction without treating trades as openings", () => {
    const store = seedMixedHoldings();
    const onReviewOpeningPosition = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <HoldingsScreen
        onReviewOpeningPosition={onReviewOpeningPosition}
        store={store}
      />,
    );

    fireEvent.press(getByTestId(`holding-row-${asset.id}`));
    expect(queryByTestId("review-opening-position-opening-ppf")).toBeNull();
    expect(queryByTestId("review-opening-position-opening-bitcoin")).toBeNull();

    fireEvent.press(getByTestId("holding-detail-back"));
    fireEvent.press(getByTestId("holdings-ppf-tab"));
    fireEvent.press(getByTestId(`holding-row-${debtAsset.id}`));
    fireEvent.press(getByTestId("holding-view-records"));
    fireEvent.press(getByTestId("review-opening-position-opening-ppf"));

    expect(onReviewOpeningPosition).toHaveBeenCalledWith("opening-ppf");
  });

  it("shows one calm completion message after correction", () => {
    const store = seedMixedHoldings();
    const { getByTestId, getByText } = render(
      <HoldingsScreen
        statusMessage="Portfolio history updated."
        store={store}
      />,
    );

    expect(getByTestId("holdings-status-message")).toBeTruthy();
    expect(getByText("Portfolio history updated.")).toBeTruthy();
  });

  it("wires header Add Holding and value masking actions", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(buyTrade);
    const onAddTrade = jest.fn();

    const { getByTestId } = render(
      <HoldingsScreen store={store} onAddTrade={onAddTrade} />,
    );

    fireEvent.press(getByTestId("holdings-add-button"));
    fireEvent.press(getByTestId("add-one-holding-option"));
    expect(onAddTrade).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId("holdings-more-button"));
    fireEvent.press(getByTestId("holdings-mask-toggle"));
    expect(store.getState().preferences.maskWealthValues).toBe(true);
  });

  it("lets the user choose one or multiple holdings from the header action", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onAddTrade = jest.fn();
    const onQuickSetup = jest.fn();
    const onImportHoldings = jest.fn();
    const onImportTransactions = jest.fn();
    const { getByTestId, getByText } = render(
      <HoldingsScreen
        onAddTrade={onAddTrade}
        onImportHoldings={onImportHoldings}
        onImportTransactions={onImportTransactions}
        onQuickSetup={onQuickSetup}
        quickSetupSavedCount={2}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("holdings-add-button"));
    expect(getByText("Continue setup (2 saved)")).toBeTruthy();
    fireEvent.press(getByTestId("add-one-holding-option"));
    expect(onAddTrade).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId("holdings-add-button"));
    fireEvent.press(getByTestId("add-multiple-holdings-option"));
    expect(onQuickSetup).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId("holdings-add-button"));
    fireEvent.press(getByTestId("import-holdings-csv-option"));
    expect(onImportHoldings).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId("holdings-add-button"));
    fireEvent.press(getByTestId("import-transactions-csv-option"));
    expect(onImportTransactions).toHaveBeenCalledTimes(1);
  });

  it("keeps active setup visible above a populated holdings list", () => {
    const store = seedMixedHoldings();
    const onQuickSetup = jest.fn();
    const { getByTestId, getByText } = render(
      <HoldingsScreen
        onQuickSetup={onQuickSetup}
        quickSetupSavedCount={2}
        store={store}
      />,
    );

    expect(getByText("Resume setup")).toBeTruthy();
    expect(getByText("2 saved locally.")).toBeTruthy();
    fireEvent.press(getByTestId("holdings-continue-setup-button"));
    expect(onQuickSetup).toHaveBeenCalledTimes(1);
  });

  it("filters visible holdings by winners, losers, high allocation, and search", () => {
    const store = seedMixedHoldings();

    const { getByTestId } = render(<HoldingsScreen store={store} />);
    const getList = () => within(getByTestId("holdings-list"));

    expect(getList().getByText("Reliance Industries")).toBeTruthy();
    expect(getList().getByText("Bitcoin")).toBeTruthy();
    expect(getList().queryByText("Public Provident Fund")).toBeNull();

    fireEvent.press(getByTestId("holdings-filter-losers"));
    expect(getByTestId("holdings-filter-losers")).toHaveStyle({
      backgroundColor: colors.primary,
    });
    expect(
      within(getByTestId("holdings-filter-losers")).getByText(/Losers/),
    ).toHaveStyle({
      color: colors.text.inverse,
    });
    expect(getList().queryByText("Reliance Industries")).toBeNull();
    expect(getList().queryByText("Public Provident Fund")).toBeNull();
    expect(getList().getByText("Bitcoin")).toBeTruthy();

    fireEvent.press(getByTestId("holdings-filter-winners"));
    expect(getList().getByText("Reliance Industries")).toBeTruthy();
    expect(getList().queryByText("Bitcoin")).toBeNull();
    expect(getList().queryByText("Public Provident Fund")).toBeNull();

    fireEvent.press(getByTestId("holdings-filter-high-allocation"));
    expect(getList().getByText("Reliance Industries")).toBeTruthy();
    expect(getList().getByText("Allocation 23.8%")).toBeTruthy();
    expect(getList().getByText("Bitcoin")).toBeTruthy();
    expect(getList().queryByText("Public Provident Fund")).toBeNull();

    fireEvent.press(getByTestId("holdings-filter-all"));
    fireEvent.changeText(getByTestId("holdings-search-input"), "reliance");

    expect(getList().getByText("Reliance Industries")).toBeTruthy();
    expect(getList().queryByText("Public Provident Fund")).toBeNull();
  });

  it("refreshes holdings quotes from the screen action", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(buyTrade);
    store.getState().upsertQuote({
      asOf: "2026-04-20T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR",
      price: 100,
      source: "manual",
    });
    const refreshQuotes = jest
      .fn<Promise<QuoteRefreshResult>, [RefreshQuotesInput]>()
      .mockResolvedValue({
        failed: [],
        quoteCache: {
          [asset.id]: {
            asOf: "2026-04-21T10:00:00.000Z",
            assetId: asset.id,
            currency: "INR",
            price: 150,
            source: "yahoo",
          },
        },
        timedOut: [],
        updated: [asset.id],
      });

    const { getAllByText, UNSAFE_getByType } = render(
      <HoldingsScreen
        now={new Date("2026-04-21T10:05:00.000Z")}
        store={store}
        refreshQuotes={refreshQuotes}
      />,
    );

    const scrollView = UNSAFE_getByType(ScrollView);
    await act(async () => {
      await scrollView.props.refreshControl.props.onRefresh();
    });

    await waitFor(() => {
      expect(getAllByText("₹300").length).toBeGreaterThan(0);
    });
  });

  it("keeps complete stale and manual price coverage calm", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const secondAsset: Asset = {
      ...asset,
      id: "asset-nifty-etf",
      name: "Nifty 50 ETF",
      symbol: "NIFTYBEES",
      ticker: "NIFTYBEES.NS",
    };
    store.getState().addAsset(asset);
    store.getState().addAsset(secondAsset);
    store.getState().addTrade(buyTrade);
    store.getState().addTrade({
      ...buyTrade,
      assetId: secondAsset.id,
      id: "trade-nifty-etf",
    });
    store.getState().upsertQuote({
      asOf: "2026-04-20T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR",
      price: 125,
      source: "yahoo",
    });
    store.getState().upsertQuote({
      asOf: "2026-04-21T10:00:00.000Z",
      assetId: secondAsset.id,
      currency: "INR",
      price: 110,
      source: "manual",
    });

    const { getByTestId, getByText, queryByText } = render(
      <HoldingsScreen
        now={new Date("2026-04-21T10:05:00.000Z")}
        store={store}
      />,
    );

    expect(queryByText("Using saved prices")).toBeNull();
    fireEvent.press(getByTestId("holdings-more-button"));
    fireEvent.press(getByTestId("holdings-valuation-details-button"));
    expect(
      getByText("Current 0 · Stale 1 · Manual 1 · Missing 0"),
    ).toBeTruthy();
    expect(queryByText("Price coverage needs attention")).toBeNull();
  });

  it("shows aggregate freshness and partial refresh outcomes", async () => {
    const store = seedMixedHoldings();
    const refreshQuotes = jest
      .fn<Promise<QuoteRefreshResult>, [RefreshQuotesInput]>()
      .mockResolvedValue({
        failed: [{ assetId: asset.id, error: "Provider unavailable." }],
        quoteCache: {},
        timedOut: [
          {
            assetId: cryptoAsset.id,
            error: "Quote provider did not respond within 10 seconds.",
          },
        ],
        updated: [],
      });
    const { getByTestId, getByText, UNSAFE_getByType } = render(
      <HoldingsScreen
        now={new Date("2026-04-20T10:10:00.000Z")}
        refreshQuotes={refreshQuotes}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("holdings-more-button"));
    fireEvent.press(getByTestId("holdings-valuation-details-button"));
    expect(
      getByText("Current 1 · Stale 0 · Manual 0 · Missing 2"),
    ).toBeTruthy();
    fireEvent.press(getByTestId("holdings-panel-close"));

    await act(async () => {
      await UNSAFE_getByType(ScrollView).props.refreshControl.props.onRefresh();
    });

    await waitFor(() => {
      expect(getByText("Refresh partially completed")).toBeTruthy();
    });
    fireEvent.press(getByTestId("holdings-more-button"));
    fireEvent.press(getByTestId("holdings-valuation-details-button"));
    expect(
      getByText(
        "Current 1 · Stale 0 · Manual 0 · Missing 2. 1 failed · 1 timed out. Existing prices remain available.",
      ),
    ).toBeTruthy();
  });

  it("does not promise cached prices when all quote attempts fail", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(buyTrade);
    const refreshQuotes = jest
      .fn<Promise<QuoteRefreshResult>, [RefreshQuotesInput]>()
      .mockResolvedValue({
        failed: [{ assetId: asset.id, error: "Provider unavailable." }],
        quoteCache: {},
        timedOut: [],
        updated: [],
      });
    const { getByTestId, getByText, UNSAFE_getByType } = render(
      <HoldingsScreen
        now={new Date("2026-04-20T10:10:00.000Z")}
        refreshQuotes={refreshQuotes}
        store={store}
      />,
    );

    await act(async () => {
      await UNSAFE_getByType(ScrollView).props.refreshControl.props.onRefresh();
    });

    fireEvent.press(getByTestId("holdings-more-button"));
    fireEvent.press(getByTestId("holdings-valuation-details-button"));
    await waitFor(() => {
      expect(getByText("Quote refresh failed")).toBeTruthy();
    });
    expect(
      getByText(
        "Current 0 · Stale 0 · Manual 0 · Missing 1. 1 failed. No usable prices are available.",
      ),
    ).toBeTruthy();
  });

  it("masks wealth values without hiding quantities or percentages", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().updatePreferences({ maskWealthValues: true });
    store.getState().addAsset(asset);
    store.getState().addTrade(buyTrade);
    store.getState().upsertQuote({
      asOf: "2026-04-20T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR",
      price: 125,
      source: "yahoo",
    });

    const { getAllByText, getByTestId, getByText, queryByText } = render(
      <HoldingsScreen store={store} />,
    );

    expect(getAllByText(MASKED_INR_VALUE).length).toBeGreaterThan(0);
    expect(getByText("+25.00%")).toBeTruthy();
    expect(queryByText("₹250")).toBeNull();

    fireEvent.press(getByTestId(`holding-row-${asset.id}`));
    expect(getByText("2")).toBeTruthy();
  });

  it("shows dedicated PPF accounts and opens their account detail", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const account: PpfAccount = {
      balanceAsOf: "2026-07-31",
      confirmedBalance: 100_000,
      createdAt: "2026-08-01T10:00:00.000Z",
      id: "ppf-1",
      nickname: "Primary PPF",
      opening: { financialYearStart: 2020, kind: "financialYear" },
      provider: "India Post",
      status: "active",
    };
    store.getState().addPpfAccount(account);
    const onReviewPpfAccount = jest.fn();
    const { getByTestId, getByText, queryByText } = render(
      <HoldingsScreen
        now={new Date("2026-08-15T10:00:00.000Z")}
        onReviewPpfAccount={onReviewPpfAccount}
        store={store}
      />,
    );

    expect(getByText("Primary PPF")).toBeTruthy();
    expect(getByText("₹1L")).toBeTruthy();
    expect(queryByText("No market holdings yet")).toBeNull();
    fireEvent.press(getByTestId(`ppf-account-${account.id}`));
    expect(onReviewPpfAccount).toHaveBeenCalledWith(account.id);
  });
});
