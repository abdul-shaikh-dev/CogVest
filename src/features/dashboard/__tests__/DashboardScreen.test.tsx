import { fireEvent, render } from "@testing-library/react-native";

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

  it("shows portfolio totals, allocation, quote freshness, and conviction guidance", () => {
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
      dayChangePct: 10,
      price: 150,
      source: "yahoo",
    });

    const { getByText, queryByText } = render(<DashboardScreen store={store} />);

    expect(getByText("₹350.00")).toBeTruthy();
    expect(getByText("+₹27.27 (+10.00%) today")).toBeTruthy();
    expect(getByText("Equity")).toBeTruthy();
    expect(getByText("85.71%")).toBeTruthy();
    expect(getByText("Cash")).toBeTruthy();
    expect(getByText("14.29%")).toBeTruthy();
    expect(getByText("Quotes updated 22 Apr 2026")).toBeTruthy();
    expect(getByText("Conviction data needs more trades")).toBeTruthy();
    expect(getByText("1 of 5 trades rated. Keep conviction optional, but useful.")).toBeTruthy();
    expect(queryByText(/LTCG/i)).toBeNull();
    expect(queryByText(/Minimal Mode/i)).toBeNull();
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
