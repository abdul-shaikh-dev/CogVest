import {
  act,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react-native";
import { ScrollView } from "react-native";

import { MASKED_INR_VALUE } from "@/src/components/common";
import { HoldingsScreen } from "@/src/features/holdings";
import type { QuoteRefreshResult, RefreshQuotesInput } from "@/src/services/quotes";
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

describe("HoldingsScreen", () => {
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
      getByText("Holdings are created automatically from your portfolio entries."),
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

    const { getAllByText, getByText, queryByText } = render(
      <HoldingsScreen store={store} />,
    );

    expect(getByText("Dominant position")).toBeTruthy();
    expect(getByText("Best return")).toBeTruthy();
    expect(getByText("Exposure mix")).toBeTruthy();
    expect(getByText("Top 3")).toBeTruthy();
    expect(getByText("All 1")).toBeTruthy();
    expect(getByText("Winners 1")).toBeTruthy();
    expect(getByText("Losers 0")).toBeTruthy();
    expect(getByText("High alloc. 1")).toBeTruthy();
    expect(getAllByText("Reliance Industries").length).toBeGreaterThan(0);
    expect(getByText("Equity · Stock · Financial Services")).toBeTruthy();
    expect(getByText("₹250")).toBeTruthy();
    expect(getByText("+25.00%")).toBeTruthy();
    expect(getByText("Invested ₹200")).toBeTruthy();
    expect(getByText("Alloc. 100.00%")).toBeTruthy();
    expect(queryByText("Live price")).toBeNull();
    expect(queryByText("Manual price")).toBeNull();
    expect(queryByText(/fallback/i)).toBeNull();
    expect(queryByText("Quantity")).toBeNull();
    expect(queryByText(/LTCG/i)).toBeNull();
  });

  it("expands one holding at a time to show useful position details", () => {
    const store = seedMixedHoldings();
    const { getByTestId, getByText, queryByTestId, queryByText } = render(
      <HoldingsScreen store={store} />,
    );

    expect(queryByTestId(`holding-expanded-${asset.id}`)).toBeNull();
    expect(queryByText("Quantity")).toBeNull();

    fireEvent.press(getByTestId(`holding-row-${asset.id}`));

    expect(getByTestId(`holding-expanded-${asset.id}`)).toBeTruthy();
    expect(getByTestId(`holding-quantity-${asset.id}`)).toBeTruthy();
    expect(getByText("Quantity")).toBeTruthy();
    expect(getByText("Avg cost")).toBeTruthy();
    expect(getByText("Current price")).toBeTruthy();
    expect(getByText("Price source")).toBeTruthy();
    expect(getByText("Yahoo")).toBeTruthy();

    fireEvent.press(getByTestId(`holding-row-${debtAsset.id}`));

    expect(queryByTestId(`holding-expanded-${asset.id}`)).toBeNull();
    expect(getByTestId(`holding-expanded-${debtAsset.id}`)).toBeTruthy();
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
    fireEvent.press(getByTestId(`review-transactions-${asset.id}`));

    expect(onReviewTrades).toHaveBeenCalledWith(asset.id);
  });

  it("keeps all transaction history reachable after a holding is fully sold", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onReviewAllTrades = jest.fn();
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
        onReviewAllTrades={onReviewAllTrades}
        store={store}
      />,
    );

    expect(getByText("No holdings yet")).toBeTruthy();
    fireEvent.press(getByTestId("holdings-transactions-button"));
    expect(onReviewAllTrades).toHaveBeenCalledTimes(1);
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

    fireEvent.press(getByTestId(`holding-row-${debtAsset.id}`));
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

    const { getByLabelText } = render(
      <HoldingsScreen store={store} onAddTrade={onAddTrade} />,
    );

    fireEvent.press(getByLabelText("Add Holding"));
    expect(onAddTrade).toHaveBeenCalledTimes(1);

    fireEvent.press(getByLabelText("Mask values"));
    expect(store.getState().preferences.maskWealthValues).toBe(true);
  });

  it("filters visible holdings by winners, losers, high allocation, and search", () => {
    const store = seedMixedHoldings();

    const { getByLabelText, getByTestId } = render(
      <HoldingsScreen store={store} />,
    );
    const getList = () => within(getByTestId("holdings-list"));

    expect(getList().getByText("Reliance Industries")).toBeTruthy();
    expect(getList().getByText("Public Provident Fund")).toBeTruthy();
    expect(getList().getByText("Bitcoin")).toBeTruthy();

    fireEvent.press(getByTestId("holdings-filter-losers"));
    expect(getList().queryByText("Reliance Industries")).toBeNull();
    expect(getList().queryByText("Public Provident Fund")).toBeNull();
    expect(getList().getByText("Bitcoin")).toBeTruthy();

    fireEvent.press(getByTestId("holdings-filter-winners"));
    expect(getList().getByText("Reliance Industries")).toBeTruthy();
    expect(getList().getByText("Public Provident Fund")).toBeTruthy();
    expect(getList().queryByText("Bitcoin")).toBeNull();

    fireEvent.press(getByTestId("holdings-filter-high-allocation"));
    expect(getList().queryByText("Reliance Industries")).toBeNull();
    expect(getList().getByText("Public Provident Fund")).toBeTruthy();
    expect(getList().getByText("Bitcoin")).toBeTruthy();

    fireEvent.press(getByTestId("holdings-filter-all"));
    fireEvent.press(getByLabelText("Search holdings"));
    fireEvent.changeText(getByLabelText("Search holdings input"), "reliance");

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
        failures: [],
        quoteCache: {
          [asset.id]: {
            asOf: "2026-04-21T10:00:00.000Z",
            assetId: asset.id,
            currency: "INR",
            price: 150,
            source: "yahoo",
          },
        },
      });

    const { getAllByText, UNSAFE_getByType } = render(
      <HoldingsScreen store={store} refreshQuotes={refreshQuotes} />,
    );

    const scrollView = UNSAFE_getByType(ScrollView);
    await act(async () => {
      await scrollView.props.refreshControl.props.onRefresh();
    });

    await waitFor(() => {
      expect(getAllByText("₹300").length).toBeGreaterThan(0);
    });
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
});
