import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import { SellRedeemScreen } from "@/src/features/sellRedeem";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

function selectDate(
  getByTestId: ReturnType<typeof render>["getByTestId"],
  value: string,
) {
  const [year, month, day] = value.split("-").map(Number);

  fireEvent.press(getByTestId("sell-redeem-date-input"));
  fireEvent(
    getByTestId("sell-redeem-date-input-picker"),
    "onChange",
    { nativeEvent: { timestamp: new Date(year, month - 1, day, 12).getTime() } },
  );
}
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
  it("returns to Holdings without recording a sale", () => {
    const store = seedStore();
    const onCancel = jest.fn();
    const { getByLabelText } = render(
      <SellRedeemScreen
        assetId={asset.id}
        onCancel={onCancel}
        store={store}
      />,
    );

    fireEvent.press(getByLabelText("Back to Holdings"));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().cashEntries).toEqual([]);
  });

  it("renders the selected holding and waits to show linked cash fields until proceeds are valid", () => {
    const store = seedStore();
    const { getByPlaceholderText, getByTestId, getByText, queryByTestId } = render(
      <SellRedeemScreen assetId={asset.id} store={store} />,
    );

    expect(getByTestId("sell-redeem-screen")).toBeTruthy();
    expect(getByText("Sell / redeem")).toBeTruthy();
    expect(getByText("HDFC Bank")).toBeTruthy();
    expect(getByText("Available units")).toBeTruthy();
    expect(getByText("25")).toBeTruthy();
    expect(getByPlaceholderText("Max 25")).toBeTruthy();
    expect(getByText("Cash proceeds")).toBeTruthy();
    expect(getByText("Saved quote")).toBeTruthy();
    expect(getByTestId("sell-redeem-quote-context")).toHaveTextContent(
      /Stale · Yahoo Finance · as of/,
    );
    expect(getByText("Actual execution price")).toBeTruthy();
    expect(getByTestId("sell-redeem-price-guidance")).toHaveTextContent(
      /Confirm or replace it with the executed price/,
    );
    expect(
      getByText(
        "Net proceeds are added to deployable cash automatically. Record a withdrawal separately if the money leaves the portfolio.",
      ),
    ).toBeTruthy();
    expect(queryByTestId("sell-redeem-cash-amount-input")).toBeNull();
  });

  it("updates preview and saves the linked proceeds", async () => {
    const store = seedStore();
    const onSaved = jest.fn();
    const { getAllByText, getByLabelText, getByTestId, getByText } = render(
      <SellRedeemScreen assetId={asset.id} store={store} onSaved={onSaved} />,
    );

    fireEvent.changeText(getByLabelText("Quantity"), "5");
    fireEvent.changeText(getByLabelText("Actual execution price"), "1700");
    fireEvent.changeText(getByLabelText("Fees"), "100");
    selectDate(getByTestId, "2026-05-20");

    await waitFor(() => {
      expect(getByText("Net proceeds")).toBeTruthy();
      expect(getAllByText("₹8,400.00")).toHaveLength(2);
    });

    fireEvent.press(getByTestId("sell-redeem-save-button"));

    expect(store.getState().trades[0]).toMatchObject({
      quantity: 5,
      totalValue: 8400,
      type: "sell",
    });
    expect(store.getState().cashEntries[0]).toMatchObject({
      amount: 8400,
      label: "HDFC Bank sale proceeds",
      purpose: "saleProceeds",
      type: "addition",
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("shows derived linked proceeds without editable cash fields", () => {
    const store = seedStore();
    const { getAllByText, getByLabelText, getByTestId, getByText, queryByTestId } = render(
      <SellRedeemScreen assetId={asset.id} store={store} />,
    );

    fireEvent.changeText(getByLabelText("Quantity"), "1");
    fireEvent.changeText(getByLabelText("Actual execution price"), "1700");
    selectDate(getByTestId, "2026-05-20");

    expect(getByText("Net proceeds added to Cash Ledger")).toBeTruthy();
    expect(getAllByText("₹1,700.00")).toHaveLength(3);
    expect(queryByTestId("sell-redeem-cash-amount-input")).toBeNull();
    expect(queryByTestId("sell-redeem-link-cash-toggle")).toBeNull();
  });

  it("blocks overselling before save and keeps cash fields hidden", () => {
    const store = seedStore();
    const { getByLabelText, getByTestId, getByText, queryByTestId } = render(
      <SellRedeemScreen assetId={asset.id} store={store} />,
    );

    fireEvent.changeText(getByLabelText("Quantity"), "26");
    fireEvent.changeText(getByLabelText("Actual execution price"), "1700");

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

  it("keeps an unavailable quote distinct from the required execution price", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addOpeningPosition({
      assetId: asset.id,
      averageCostPrice: 1450,
      date: "2026-04-15",
      id: "opening-hdfc",
      quantity: 25,
    });
    const screen = render(<SellRedeemScreen assetId={asset.id} store={store} />);

    expect(screen.getByTestId("sell-redeem-quote-context")).toHaveTextContent(
      "Unavailable · no saved quote",
    );
    expect(screen.getByTestId("sell-redeem-price-input").props.value).toBe("");
    expect(screen.getByTestId("sell-redeem-price-guidance")).toHaveTextContent(
      /Enter the executed price from your broker record/,
    );
  });

  it("masks aggregate values until reveal while keeping units and prices visible", async () => {
    const store = seedStore();
    act(() => store.getState().updatePreferences({ maskWealthValues: true }));
    const screen = render(<SellRedeemScreen assetId={asset.id} store={store} />);

    expect(screen.getByText("25")).toBeTruthy();
    expect(screen.getByText("₹1.7K")).toBeTruthy();
    expect(screen.getAllByLabelText("Amount hidden").length).toBeGreaterThan(0);
    expect(screen.queryByText("₹41.95K")).toBeNull();

    fireEvent.changeText(screen.getByLabelText("Quantity"), "5");
    fireEvent.changeText(screen.getByLabelText("Actual execution price"), "1700");
    fireEvent.changeText(screen.getByLabelText("Fees"), "100");
    selectDate(screen.getByTestId, "2026-05-20");
    expect(screen.queryByText("₹8,400.00")).toBeNull();
    expect(screen.getByText("Remaining units")).toBeTruthy();
    expect(screen.getByText("20")).toBeTruthy();

    fireEvent.press(screen.getByTestId("reveal-sell-redeem-button"));
    expect(screen.getAllByText("₹8,400.00")).toHaveLength(2);

    act(() => store.getState().updatePreferences({ maskWealthValues: false }));
    act(() => store.getState().updatePreferences({ maskWealthValues: true }));
    await waitFor(() => {
      expect(screen.queryByText("₹8,400.00")).toBeNull();
      expect(screen.getByTestId("reveal-sell-redeem-button")).toBeTruthy();
    });
  });
});
