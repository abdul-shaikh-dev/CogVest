import { fireEvent, render } from "@testing-library/react-native";

import { ManageAssetsScreen } from "@/src/features/assets";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset } from "@/src/types";

const activeAsset: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "asset-active",
  instrumentType: "stock",
  name: "Active Bank",
  quoteSourceId: "ACTIVE.NS",
  sectorType: "financialServices",
  symbol: "ACTIVE",
  ticker: "ACTIVE.NS",
};

const closedAsset: Asset = {
  ...activeAsset,
  id: "asset-closed",
  name: "Closed Fund",
  quoteSourceId: "CLOSED.NS",
  symbol: "CLOSED",
  ticker: "CLOSED.NS",
};

describe("ManageAssetsScreen", () => {
  it("lists active and fully sold assets and opens review by stable ID", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(activeAsset);
    store.getState().addAsset(closedAsset);
    store.getState().addOpeningPosition({
      assetId: activeAsset.id,
      averageCostPrice: 100,
      currentPrice: 120,
      date: "2026-01-01",
      id: "opening-active",
      quantity: 2,
    });
    store.getState().addTrade({
      assetId: closedAsset.id,
      date: "2026-01-01",
      id: "buy-closed",
      pricePerUnit: 100,
      quantity: 1,
      totalValue: 100,
      type: "buy",
    });
    store.getState().addTrade({
      assetId: closedAsset.id,
      date: "2026-02-01",
      id: "sell-closed",
      pricePerUnit: 110,
      quantity: 1,
      totalValue: 110,
      type: "sell",
    });
    const onReviewAsset = jest.fn();
    const { getAllByText, getByTestId, getByText } = render(
      <ManageAssetsScreen
        onBack={jest.fn()}
        onReviewAsset={onReviewAsset}
        store={store}
      />,
    );

    expect(getByText("Active Bank")).toBeTruthy();
    expect(getByText("Closed Fund")).toBeTruthy();
    expect(getAllByText("Active")).toHaveLength(1);
    expect(getAllByText("Closed")).toHaveLength(1);
    fireEvent.press(getByTestId(`manage-asset-${closedAsset.id}`));
    expect(onReviewAsset).toHaveBeenCalledWith(closedAsset.id);
  });
});
