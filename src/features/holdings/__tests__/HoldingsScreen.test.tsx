import { fireEvent, render, waitFor } from "@testing-library/react-native";

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

describe("HoldingsScreen", () => {
  it("shows an empty state with an Add Trade action", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onAddTrade = jest.fn();

    const { getByText } = render(
      <HoldingsScreen store={store} onAddTrade={onAddTrade} />,
    );

    expect(getByText("No holdings yet")).toBeTruthy();
    expect(
      getByText("Holdings are created automatically from your trades."),
    ).toBeTruthy();

    fireEvent.press(getByText("Add Trade"));

    expect(onAddTrade).toHaveBeenCalledTimes(1);
  });

  it("shows derived holding values, quote freshness, and no V1 LTCG UI", () => {
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

    const { getByText, queryByText } = render(<HoldingsScreen store={store} />);

    expect(getByText("Reliance Industries")).toBeTruthy();
    expect(getByText("RELIANCE")).toBeTruthy();
    expect(getByText("Qty 2")).toBeTruthy();
    expect(getByText("Avg ₹100.00")).toBeTruthy();
    expect(getByText("₹250.00")).toBeTruthy();
    expect(getByText("+₹50.00")).toBeTruthy();
    expect(getByText("+25.00%")).toBeTruthy();
    expect(getByText("Updated 20 Apr 2026")).toBeTruthy();
    expect(queryByText(/LTCG/i)).toBeNull();
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

    const { getByText } = render(
      <HoldingsScreen store={store} refreshQuotes={refreshQuotes} />,
    );

    fireEvent.press(getByText("Refresh Quotes"));

    await waitFor(() => {
      expect(getByText("₹300.00")).toBeTruthy();
      expect(getByText("Updated 21 Apr 2026")).toBeTruthy();
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

    const { getAllByText, getByText, queryByText } = render(
      <HoldingsScreen store={store} />,
    );

    expect(getAllByText(MASKED_INR_VALUE).length).toBeGreaterThan(0);
    expect(getByText("Qty 2")).toBeTruthy();
    expect(getByText("+25.00%")).toBeTruthy();
    expect(queryByText("₹250.00")).toBeNull();
  });
});
