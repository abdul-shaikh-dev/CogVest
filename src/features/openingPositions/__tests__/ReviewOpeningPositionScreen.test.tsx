import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { ReviewOpeningPositionScreen } from "@/src/features/openingPositions";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey } from "@/src/store";
import type { Asset, OpeningPosition } from "@/src/types";

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

const openingPosition: OpeningPosition = {
  assetId: asset.id,
  averageCostPrice: 1450,
  conviction: 4,
  date: "2026-04-15",
  id: "opening-hdfc",
  manualValuation: {
    asOf: "2026-07-01T09:30:00.000Z",
    currency: "INR",
    price: 1678.25,
    provenance: "user",
    source: "manual",
  },
  notes: "Long-term holding",
  quantity: 25,
};

function createStore() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({
    now: () => new Date(2026, 6, 22, 12),
    storage,
  });
  store.getState().addAsset(asset);
  store.getState().addOpeningPosition(openingPosition);

  return { storage, store };
}

describe("ReviewOpeningPositionScreen", () => {
  it("corrects the source record once after rapid repeated save presses", async () => {
    const { store } = createStore();
    const onComplete = jest.fn();
    const originalCorrection = store.getState().correctOpeningPosition;
    const correctionSpy = jest
      .fn(originalCorrection)
      .mockName("correctOpeningPosition");
    store.setState({ correctOpeningPosition: correctionSpy });
    const { getByTestId, getByText } = render(
      <ReviewOpeningPositionScreen
        now={new Date(2026, 6, 22, 12)}
        onCancel={jest.fn()}
        onComplete={onComplete}
        openingPositionId={openingPosition.id}
        store={store}
      />,
    );

    expect(getByText(/holding remains saved with valuation pending/)).toBeTruthy();
    fireEvent.changeText(
      getByTestId("opening-correction-quantity-input"),
      "30",
    );
    fireEvent.press(getByTestId("opening-correction-conviction-5"));
    fireEvent.changeText(
      getByTestId("opening-correction-intended-hold-days-input"),
      "1095",
    );
    const saveButton = getByTestId("save-opening-correction-button");
    fireEvent.press(saveButton);
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith("Portfolio history updated.");
    });
    expect(correctionSpy).toHaveBeenCalledTimes(1);
    expect(store.getState().openingPositions).toEqual([
      expect.objectContaining({
        conviction: 5,
        intendedHoldDays: 1095,
        manualValuation: openingPosition.manualValuation,
        quantity: 30,
      }),
    ]);
  });

  it("records new provenance only when the manual price changes", async () => {
    const { store } = createStore();
    const { getByTestId } = render(
      <ReviewOpeningPositionScreen
        now={new Date("2026-07-22T06:30:00.000Z")}
        onCancel={jest.fn()}
        onComplete={jest.fn()}
        openingPositionId={openingPosition.id}
        store={store}
      />,
    );

    fireEvent.changeText(
      getByTestId("opening-correction-current-price-input"),
      "1700",
    );
    fireEvent.press(getByTestId("save-opening-correction-button"));

    await waitFor(() => {
      expect(store.getState().openingPositions[0]?.manualValuation).toEqual({
        asOf: "2026-07-22T06:30:00.000Z",
        currency: "INR",
        price: 1700,
        provenance: "user",
        source: "manual",
      });
    });
  });

  it("validates correction fields before touching the store", () => {
    const { store } = createStore();
    const correctionSpy = jest.spyOn(
      store.getState(),
      "correctOpeningPosition",
    );
    const { getByTestId, getByText } = render(
      <ReviewOpeningPositionScreen
        now={new Date(2026, 6, 22, 12)}
        onCancel={jest.fn()}
        onComplete={jest.fn()}
        openingPositionId={openingPosition.id}
        store={store}
      />,
    );

    fireEvent.changeText(getByTestId("opening-correction-quantity-input"), "0");
    fireEvent.press(getByTestId("save-opening-correction-button"));

    expect(getByText("Quantity must be greater than zero.")).toBeTruthy();
    expect(correctionSpy).not.toHaveBeenCalled();
  });

  it("reports automatic follow-up when history cannot refresh immediately", async () => {
    const { store } = createStore();
    const onComplete = jest.fn();
    store.setState({
      correctOpeningPosition: jest.fn(() => ({
        openingPosition,
        pendingMonths: ["2026-04"],
        provisionalMonths: [],
        refreshedMonths: [],
        status: "applied" as const,
      })),
    });
    const { getByTestId } = render(
      <ReviewOpeningPositionScreen
        onCancel={jest.fn()}
        onComplete={onComplete}
        openingPositionId={openingPosition.id}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("save-opening-correction-button"));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(
        "Saved. Portfolio history will refresh automatically.",
      );
    });
  });

  it("requires confirmation and applies repeated delete presses once", async () => {
    const { store } = createStore();
    const onComplete = jest.fn();
    const originalDeletion = store.getState().deleteOpeningPosition;
    const deletionSpy = jest
      .fn(originalDeletion)
      .mockName("deleteOpeningPosition");
    store.setState({ deleteOpeningPosition: deletionSpy });
    const { getByTestId, getByText } = render(
      <ReviewOpeningPositionScreen
        onCancel={jest.fn()}
        onComplete={onComplete}
        openingPositionId={openingPosition.id}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("delete-opening-position-button"));
    expect(getByText("Remove this opening position?")).toBeTruthy();
    const confirmButton = getByTestId(
      "confirm-delete-opening-position-button",
    );
    fireEvent.press(confirmButton);
    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(
        "Opening position removed. Portfolio history updated.",
      );
    });
    expect(deletionSpy).toHaveBeenCalledTimes(1);
    expect(store.getState().openingPositions).toEqual([]);
  });

  it("retains form values and source data after persistence failure", async () => {
    const { storage, store } = createStore();
    storage.setItem = (key) => {
      if (key === portfolioStorageKey) {
        throw new Error("simulated opening correction failure");
      }
    };
    const { getByTestId, getByText } = render(
      <ReviewOpeningPositionScreen
        onCancel={jest.fn()}
        onComplete={jest.fn()}
        openingPositionId={openingPosition.id}
        store={store}
      />,
    );

    fireEvent.changeText(
      getByTestId("opening-correction-quantity-input"),
      "40",
    );
    fireEvent.press(getByTestId("save-opening-correction-button"));

    await waitFor(() => {
      expect(
        getByText(/could not be saved safely/),
      ).toBeTruthy();
    });
    expect(store.getState().openingPositions).toEqual([openingPosition]);
    expect(getByTestId("opening-correction-quantity-input")).toHaveProp(
      "value",
      "40",
    );
  });

  it("handles a stale opening-position ID safely", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByText } = render(
      <ReviewOpeningPositionScreen
        onCancel={jest.fn()}
        onComplete={jest.fn()}
        openingPositionId="missing"
        store={store}
      />,
    );

    expect(getByText("Opening position unavailable")).toBeTruthy();
    expect(getByText("Back to Holdings")).toBeTruthy();
  });
});
