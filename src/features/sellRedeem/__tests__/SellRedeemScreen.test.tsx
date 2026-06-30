import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { SellRedeemScreen } from "@/src/features/sellRedeem";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset } from "@/src/types";

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

function seedStore() {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

  store.getState().addAsset(asset);
  store.getState().addOpeningPosition({
    assetId: asset.id,
    averageCostPrice: 1450,
    currentPrice: 1678,
    date: "2026-04-15",
    id: "opening-hdfc",
    quantity: 25,
  });
  store.getState().upsertQuote({
    asOf: "2026-05-20T10:00:00.000Z",
    assetId: asset.id,
    currency: "INR",
    price: 1700,
    source: "yahoo",
  });

  return store;
}

describe("SellRedeemScreen", () => {
  it("renders the selected holding and waits to show linked cash fields until proceeds are valid", () => {
    const store = seedStore();
    const { getByTestId, getByText, queryByTestId } = render(
      <SellRedeemScreen assetId={asset.id} store={store} />,
    );

    expect(getByTestId("sell-redeem-screen")).toBeTruthy();
    expect(getByText("Sell / redeem")).toBeTruthy();
    expect(getByText("HDFC Bank")).toBeTruthy();
    expect(getByText("Available units")).toBeTruthy();
    expect(getByText("25")).toBeTruthy();
    expect(getByText("Add proceeds to Cash Ledger")).toBeTruthy();
    expect(getByText("Cash entry appears after the exit proceeds are valid.")).toBeTruthy();
    expect(queryByTestId("sell-redeem-cash-amount-input")).toBeNull();
  });

  it("updates preview and saves the linked proceeds", async () => {
    const store = seedStore();
    const onSaved = jest.fn();
    const { getByLabelText, getByTestId, getByText } = render(
      <SellRedeemScreen assetId={asset.id} store={store} onSaved={onSaved} />,
    );

    fireEvent.changeText(getByLabelText("Quantity"), "5");
    fireEvent.changeText(getByLabelText("Sell price"), "1700");
    fireEvent.changeText(getByLabelText("Fees"), "100");
    fireEvent.changeText(getByLabelText("Date"), "2026-05-20");

    await waitFor(() => {
      expect(getByText("Net proceeds")).toBeTruthy();
      expect(getByText("₹8,400.00")).toBeTruthy();
    });

    fireEvent.press(getByTestId("sell-redeem-save-button"));

    expect(store.getState().trades[0]).toMatchObject({
      quantity: 5,
      totalValue: 8400,
      type: "sell",
    });
    expect(store.getState().cashEntries[0]).toMatchObject({
      amount: 8400,
      label: "HDFC Bank redemption proceeds",
      type: "addition",
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("lets the user disable linked cash proceeds", () => {
    const store = seedStore();
    const { getByLabelText, getByTestId, queryByTestId } = render(
      <SellRedeemScreen assetId={asset.id} store={store} />,
    );

    fireEvent.press(getByTestId("sell-redeem-link-cash-toggle"));

    expect(queryByTestId("sell-redeem-cash-amount-input")).toBeNull();

    fireEvent.changeText(getByLabelText("Quantity"), "1");
    fireEvent.changeText(getByLabelText("Sell price"), "1700");
    fireEvent.changeText(getByLabelText("Date"), "2026-05-20");
    fireEvent.press(getByTestId("sell-redeem-save-button"));

    expect(store.getState().trades).toHaveLength(1);
    expect(store.getState().cashEntries).toEqual([]);
  });

  it("blocks overselling before save and keeps cash fields hidden", () => {
    const store = seedStore();
    const { getByLabelText, getByTestId, getByText, queryByTestId } = render(
      <SellRedeemScreen assetId={asset.id} store={store} />,
    );

    fireEvent.changeText(getByLabelText("Quantity"), "26");
    fireEvent.changeText(getByLabelText("Sell price"), "1700");

    expect(getByText("Sell quantity exceeds available units.")).toBeTruthy();
    expect(queryByTestId("sell-redeem-cash-amount-input")).toBeNull();
    expect(getByTestId("sell-redeem-save-button")).toBeDisabled();
  });

  it("shows an empty state when the holding is missing", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByText } = render(
      <SellRedeemScreen assetId={asset.id} store={store} />,
    );

    expect(getByText("Holding not found")).toBeTruthy();
    expect(getByText("Open Holdings and choose an active position to sell or redeem.")).toBeTruthy();
  });
});
