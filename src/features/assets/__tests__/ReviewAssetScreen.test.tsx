import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { ReviewAssetScreen } from "@/src/features/assets";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset, CashEntry, Trade } from "@/src/types";

const asset: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "asset-hdfc",
  instrumentType: "stock",
  name: "HDFC Bank",
  quoteSourceId: "HDFCBANK.NS",
  sectorType: "financialServices",
  symbol: "HDFCBANK",
  ticker: "HDFCBANK.NS",
};

function createStore() {
  const store = createPortfolioStore({
    now: () => new Date(2026, 6, 22, 12),
    storage: createMemoryJsonStorage(),
  });
  store.getState().addAsset(asset);
  return store;
}

describe("ReviewAssetScreen", () => {
  it("corrects metadata once after repeated save presses", async () => {
    const store = createStore();
    const originalCorrection = store.getState().correctAsset;
    const correctionSpy = jest.fn(originalCorrection);
    store.setState({ correctAsset: correctionSpy });
    const onComplete = jest.fn();
    const { getByTestId } = render(
      <ReviewAssetScreen
        assetId={asset.id}
        onCancel={jest.fn()}
        onComplete={onComplete}
        store={store}
      />,
    );

    fireEvent.changeText(getByTestId("asset-name-input"), "HDFC Bank Limited");
    fireEvent.press(getByTestId("asset-sector-picker"));
    fireEvent.press(getByTestId("asset-sector-technology"));
    const save = getByTestId("save-asset-correction-button");
    fireEvent.press(save);
    fireEvent.press(save);

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith("Asset details saved."));
    expect(correctionSpy).toHaveBeenCalledTimes(1);
    expect(store.getState().assets[0]).toMatchObject({
      id: asset.id,
      name: "HDFC Bank Limited",
      sectorType: "technology",
    });
  });

  it("shows exact cascade impact and deletes linked records once", async () => {
    const store = createStore();
    const trade: Trade = {
      assetId: asset.id,
      date: "2026-06-01",
      id: "trade-buy",
      pricePerUnit: 100,
      quantity: 2,
      totalValue: 200,
      type: "buy",
    };
    const linkedCash: CashEntry = {
      amount: 200,
      date: trade.date,
      id: "cash-trade-buy",
      label: "Purchase · HDFC Bank",
      linkedTradeId: trade.id,
      purpose: "purchaseFunding",
      type: "withdrawal",
    };
    store.getState().addTrade(trade);
    store.getState().addCashEntry(linkedCash);
    const originalDeletion = store.getState().deleteAsset;
    const deletionSpy = jest.fn(originalDeletion);
    store.setState({ deleteAsset: deletionSpy });
    const onComplete = jest.fn();
    const { getByTestId, getByText } = render(
      <ReviewAssetScreen
        assetId={asset.id}
        onCancel={jest.fn()}
        onComplete={onComplete}
        store={store}
      />,
    );

    expect(getByText(/1 transaction, 1 linked cash movement/)).toBeTruthy();
    fireEvent.press(getByTestId("delete-asset-button"));
    expect(getByText("Delete HDFC Bank?")).toBeTruthy();
    const confirm = getByTestId("confirm-delete-asset-button");
    fireEvent.press(confirm);
    fireEvent.press(confirm);

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(deletionSpy).toHaveBeenCalledTimes(1);
    expect(store.getState().assets).toEqual([]);
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().cashEntries).toEqual([]);
  });

  it("reports duplicate identity without losing entered values", async () => {
    const store = createStore();
    store.getState().addAsset({
      ...asset,
      id: "asset-other",
      name: "Other Bank",
      quoteSourceId: "OTHER.NS",
      symbol: "OTHER",
      ticker: "OTHER.NS",
    });
    const { getByTestId, getByText } = render(
      <ReviewAssetScreen
        assetId={asset.id}
        onCancel={jest.fn()}
        onComplete={jest.fn()}
        store={store}
      />,
    );

    fireEvent.changeText(getByTestId("asset-ticker-input"), "OTHER.NS");
    fireEvent.changeText(getByTestId("asset-provider-id-input"), "OTHER.NS");
    fireEvent.press(getByTestId("save-asset-correction-button"));

    await waitFor(() => expect(getByText(/Another asset already uses/)).toBeTruthy());
    expect(getByTestId("asset-ticker-input")).toHaveProp("value", "OTHER.NS");
    expect(store.getState().assets[0]).toEqual(asset);
  });

  it("handles stale asset IDs safely", () => {
    const { getByText } = render(
      <ReviewAssetScreen
        assetId="missing"
        onCancel={jest.fn()}
        onComplete={jest.fn()}
        store={createStore()}
      />,
    );

    expect(getByText("Asset unavailable")).toBeTruthy();
    expect(getByText("Back to assets")).toBeTruthy();
  });
});
