import * as Haptics from "expo-haptics";
import {
  act,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react-native";
import { BackHandler, StyleSheet } from "react-native";

import { AddOpeningPositionForm } from "@/src/features/openingPositions";
import type { AssetLookupResult } from "@/src/services/assetLookup";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, quoteCacheStorageKey } from "@/src/store";
import { colors, typography } from "@/src/theme";

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: {
    Success: "success",
  },
}));

function selectDate(
  getByTestId: ReturnType<typeof render>["getByTestId"],
  testID: string,
  value: string,
) {
  const [year, month, day] = value.split("-").map(Number);

  fireEvent.press(getByTestId(testID));
  fireEvent(
    getByTestId(`${testID}-picker`),
    "onChange",
    { nativeEvent: { timestamp: new Date(year, month - 1, day, 12).getTime() } },
  );
}

function selectOption(
  getByTestId: ReturnType<typeof render>["getByTestId"],
  prefix: string,
  value: string,
) {
  fireEvent.press(getByTestId(`${prefix}-picker`));
  fireEvent.press(getByTestId(`${prefix}-${value}`));
}

function openManualAssetEntry(
  getByTestId: ReturnType<typeof render>["getByTestId"],
) {
  fireEvent.press(getByTestId("toggle-manual-asset-entry"));
}

function openManualConfirmDetails(
  getByLabelText: ReturnType<typeof render>["getByLabelText"],
  getByTestId: ReturnType<typeof render>["getByTestId"],
  getByText: ReturnType<typeof render>["getByText"],
) {
  openManualAssetEntry(getByTestId);
  fireEvent.changeText(getByLabelText("Asset name"), "Reliance Industries");
  fireEvent.changeText(getByLabelText("Symbol"), "RELIANCE");
  fireEvent.changeText(getByLabelText("Ticker"), "RELIANCE.NS");
  fireEvent.changeText(getByLabelText("Quote source ID"), "RELIANCE.NS");
  fireEvent.press(getByText("Continue to confirm details"));
}

describe("AddOpeningPositionForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("exits without saving an opening position", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onCancel = jest.fn();
    const { getByLabelText } = render(
      <AddOpeningPositionForm onCancel={onCancel} store={store} />,
    );

    fireEvent.press(getByLabelText("Back"));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(store.getState().assets).toEqual([]);
    expect(store.getState().openingPositions).toEqual([]);
  });

  it("starts on the Asset phase and hides later phase fields", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByTestId, getByText, queryByTestId } = render(
      <AddOpeningPositionForm store={store} />,
    );

    expect(getByTestId("add-holding-screen")).toBeTruthy();
    expect(getByTestId("add-holding-step-asset")).toBeTruthy();
    expect(getByTestId("add-holding-phase-asset")).toBeTruthy();
    expect(getByText("Can't find your asset? Add manually")).toBeTruthy();
    expect(queryByTestId("manual-asset-fields")).toBeNull();
    expect(queryByTestId("continue-class-button")).toBeNull();
    expect(queryByTestId("add-holding-phase-class")).toBeNull();
    expect(queryByTestId("add-holding-phase-position")).toBeNull();
    expect(queryByTestId("derived-preview")).toBeNull();
    expect(queryByTestId("quantity-input")).toBeNull();
  });

  it.each(["hardware", "toolbar", "footer"])(
    "retains a single-holding draft through every phase using %s Back",
    (entryPoint) => {
      const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
      const onCancel = jest.fn();
      let hardwareBack: (() => boolean | null | undefined) | undefined;
      const spy = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
        hardwareBack = handler;
        return { remove: jest.fn() };
      });
      const ui = render(<AddOpeningPositionForm onCancel={onCancel} store={store} />);
      openManualAssetEntry(ui.getByTestId);
      fireEvent.changeText(ui.getByLabelText("Asset name"), "Draft asset");
      fireEvent.changeText(ui.getByLabelText("Symbol"), "DRAFT");
      fireEvent.changeText(ui.getByLabelText("Ticker"), "DRAFT.NS");
      fireEvent.press(ui.getByTestId("continue-class-button"));
      fireEvent.press(ui.getByTestId("continue-position-button"));
      fireEvent.changeText(ui.getByLabelText("Quantity"), "2");
      fireEvent.changeText(ui.getByLabelText("Average cost"), "100");
      fireEvent.press(ui.getByLabelText("First purchase date unknown"));
      fireEvent.press(ui.getByTestId("review-holding-button"));
      expect(ui.getByTestId("add-holding-phase-review")).toBeTruthy();
      const back = () => {
        if (entryPoint === "hardware") act(() => { expect(hardwareBack?.()).toBe(true); });
        else fireEvent.press(ui.getByTestId(entryPoint === "toolbar" ? "add-holding-exit" : "back-button"));
      };
      back();
      expect(ui.getByTestId("add-holding-phase-position")).toBeTruthy();
      fireEvent.changeText(ui.getByLabelText("Quantity"), "17");
      fireEvent.changeText(ui.getByLabelText("Average cost"), "1200");
      fireEvent.changeText(ui.getByTestId("notes-input"), "Keep this draft");
      back();
      expect(ui.getByTestId("add-holding-phase-class")).toBeTruthy();
      back();
      expect(ui.getByTestId("add-holding-phase-asset")).toBeTruthy();
      fireEvent.press(ui.getByTestId("continue-class-button"));
      fireEvent.press(ui.getByTestId("continue-position-button"));
      expect(ui.getByLabelText("Quantity")).toHaveProp("value", "17");
      expect(ui.getByLabelText("Average cost")).toHaveProp("value", "1200");
      expect(ui.getByTestId("notes-input")).toHaveProp("value", "Keep this draft");
      expect(onCancel).not.toHaveBeenCalled();
      expect(store.getState().openingPositions).toHaveLength(0);
      ui.unmount();
      spy.mockRestore();
    },
  );

  it("keeps unfinished input when exit is cancelled or dismissed and only discards explicitly", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onCancel = jest.fn();
    const ui = render(<AddOpeningPositionForm onCancel={onCancel} store={store} />);
    openManualAssetEntry(ui.getByTestId);
    fireEvent.changeText(ui.getByLabelText("Asset name"), "My draft");
    fireEvent.press(ui.getByTestId("add-holding-exit"));
    expect(ui.getByText("Discard unfinished holding?")).toBeTruthy();
    fireEvent.press(ui.getByTestId("holding-keep-editing"));
    expect(ui.getByLabelText("Asset name")).toHaveProp("value", "My draft");
    fireEvent.press(ui.getByTestId("add-holding-exit"));
    fireEvent(ui.getByTestId("holding-exit-confirmation"), "requestClose");
    expect(ui.getByLabelText("Asset name")).toHaveProp("value", "My draft");
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.press(ui.getByTestId("add-holding-exit"));
    fireEvent.press(ui.getByTestId("holding-discard-exit"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(store.getState().openingPositions).toHaveLength(0);
  });

  it("unregisters the single-holding back handler when the route loses focus", () => {
    const remove = jest.fn();
    const spy = jest.spyOn(BackHandler, "addEventListener").mockReturnValue({ remove });
    const props = { onCancel: jest.fn(), store: createPortfolioStore({ storage: createMemoryJsonStorage() }) };
    const ui = render(<AddOpeningPositionForm {...props} />);
    expect(spy).toHaveBeenCalled();
    spy.mockClear();
    ui.rerender(<AddOpeningPositionForm {...props} hardwareBackEnabled={false} />);
    expect(remove).toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    ui.unmount();
    spy.mockRestore();
  });

  it("validates the Asset phase before continuing", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByTestId, getByText, queryByTestId } = render(
      <AddOpeningPositionForm store={store} />,
    );

    openManualAssetEntry(getByTestId);
    fireEvent.press(getByText("Continue to confirm details"));

    expect(queryByTestId("add-holding-phase-class")).toBeNull();
    expect(getByText("Asset name is required.")).toBeTruthy();
    expect(getByText("Symbol is required.")).toBeTruthy();
    expect(getByText("Ticker is required.")).toBeTruthy();
  });

  it("shows distinct Confirm details labels and selected state for every asset class", () => {
    const { getByLabelText, getByTestId, getByText } = render(
      <AddOpeningPositionForm store={createPortfolioStore({ storage: createMemoryJsonStorage() })} />,
    );

    openManualConfirmDetails(getByLabelText, getByTestId, getByText);

    for (const [assetClass, label] of [
      ["stock", "Stocks"],
      ["etf", "ETFs"],
      ["debt", "Debt"],
      ["crypto", "Crypto"],
    ] as const) {
      const chip = getByTestId(`asset-class-${assetClass}`);
      expect(within(chip).getByText(label)).toBeTruthy();
      expect(getByLabelText(label)).toBeTruthy();
      expect(chip.props.accessibilityLabel).toBe(label);
      expect(chip.props.accessibilityState).toEqual({
        selected: assetClass === "stock",
      });
    }
  });

  it("resets incompatible metadata and exposes only valid stock and ETF instruments", () => {
    const { getByLabelText, getByTestId, getByText, queryByTestId } = render(
      <AddOpeningPositionForm store={createPortfolioStore({ storage: createMemoryJsonStorage() })} />,
    );

    openManualConfirmDetails(getByLabelText, getByTestId, getByText);
    selectOption(getByTestId, "sector-type", "energy");
    expect(within(getByTestId("sector-type-picker")).getByText("Energy")).toBeTruthy();

    fireEvent.press(getByTestId("asset-class-etf"));
    expect(within(getByTestId("instrument-type-picker")).getByText("ETF")).toBeTruthy();
    expect(queryByTestId("sector-type-picker")).toBeNull();
    expect(getByTestId("sector-not-applicable")).toBeTruthy();

    fireEvent.press(getByTestId("instrument-type-picker"));
    expect(getByTestId("instrument-type-etf")).toBeTruthy();
    expect(queryByTestId("instrument-type-stock")).toBeNull();
    fireEvent.press(getByTestId("instrument-type-etf"));

    fireEvent.press(getByTestId("asset-class-stock"));
    expect(within(getByTestId("instrument-type-picker")).getByText("Stock")).toBeTruthy();
    expect(within(getByTestId("sector-type-picker")).getByText("Unknown")).toBeTruthy();
    fireEvent.press(getByTestId("instrument-type-picker"));
    expect(getByTestId("instrument-type-stock")).toBeTruthy();
    expect(queryByTestId("instrument-type-etf")).toBeNull();
  });

  it("caps and filters the saved asset list", async () => {
    jest.useFakeTimers();
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    for (let index = 0; index < 8; index += 1) {
      store.getState().addAsset({
        assetClass: "stock",
        currency: "INR",
        exchange: "NSE" as const,
        id: `asset-${index}`,
        instrumentType: "stock",
        name: `Saved Asset ${index}`,
        quoteSourceId: `ASSET${index}.NS`,
        sectorType: "other",
        symbol: `ASSET${index}`,
        ticker: `ASSET${index}.NS`,
      });
    }

    const searchAssetLookupResults = jest.fn().mockResolvedValue({
      failures: [],
      results: [],
    });
    const {
      getAllByText,
      getByLabelText,
      getByTestId,
      queryByTestId,
    } = render(
      <AddOpeningPositionForm
        searchAssetLookupResults={searchAssetLookupResults}
        store={store}
      />,
    );

    expect(getAllByText("Use")).toHaveLength(6);

    fireEvent.changeText(getByLabelText("Search asset"), "Saved Asset 7");
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(getByTestId("existing-asset-asset-7")).toBeTruthy();
    expect(queryByTestId("existing-asset-asset-0")).toBeNull();
  });

  it("shows a canonical saved asset instead of a duplicate provider result", async () => {
    jest.useFakeTimers();
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset({
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
    });
    const duplicateResult: AssetLookupResult = {
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: "yahoo:HDFCBANK.NS",
      instrumentType: "stock",
      instrumentTypeConfidence: "inferred",
      metadataReviewMessage: "Provider details available.",
      name: "HDFC Bank Limited",
      provider: "yahoo",
      quoteSourceId: "HDFCBANK.NS",
      sectorType: "financialServices",
      sectorTypeConfidence: "provider",
      sourceLabel: "Yahoo Finance",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    };
    const searchAssetLookupResults = jest.fn().mockResolvedValue({
      failures: [],
      results: [duplicateResult],
    });
    const { getByLabelText, getByTestId, queryByTestId } = render(
      <AddOpeningPositionForm
        searchAssetLookupResults={searchAssetLookupResults}
        store={store}
      />,
    );

    fireEvent.changeText(getByLabelText("Search asset"), "HDFC Bank");
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(getByTestId("existing-asset-asset-hdfc")).toBeTruthy();
      expect(
        queryByTestId("asset-lookup-result-yahoo:HDFCBANK.NS"),
      ).toBeNull();
    });
  });

  it("moves through Asset, Confirm details, Position, and Review phases", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const {
      getByLabelText,
      getByTestId,
      getByText,
      queryByTestId,
    } = render(
      <AddOpeningPositionForm store={store} />,
    );

    openManualAssetEntry(getByTestId);
    fireEvent.changeText(getByLabelText("Asset name"), "Reliance Industries");
    fireEvent.changeText(getByLabelText("Symbol"), "RELIANCE");
    fireEvent.changeText(getByLabelText("Ticker"), "RELIANCE.NS");
    fireEvent.changeText(getByLabelText("Quote source ID"), "RELIANCE.NS");
    fireEvent.press(getByText("Continue to confirm details"));

    expect(getByTestId("add-holding-phase-class")).toBeTruthy();
    expect(getByTestId("provider-metadata-review-copy")).toBeTruthy();
    expect(queryByTestId("add-holding-phase-asset")).toBeNull();

    fireEvent.press(getByText("Continue to position"));
    expect(getByTestId("add-holding-phase-position")).toBeTruthy();

    fireEvent.changeText(getByLabelText("Quantity"), "25");
    fireEvent.changeText(getByLabelText("Average cost"), "1450");
    fireEvent.changeText(getByLabelText("Current price"), "1678.25");
    selectDate(getByTestId, "date-input", "2026-04-15");
    fireEvent.press(getByText("Review and save"));

    expect(getByTestId("add-holding-phase-review")).toBeTruthy();
    expect(getByTestId("derived-preview")).toBeTruthy();
    expect(getByTestId("review-identity")).toBeTruthy();
    expect(getByTestId("review-classification")).toBeTruthy();
    expect(getByTestId("review-position")).toBeTruthy();
    expect(getByTestId("review-quote-provenance")).toBeTruthy();

    fireEvent.press(getByTestId("review-edit-classification"));
    expect(getByTestId("add-holding-phase-class")).toBeTruthy();
    fireEvent.press(getByText("Continue to position"));
    expect(getByLabelText("Quantity")).toHaveProp("value", "25");
  });

  it("allows returning to completed phases before saving", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByLabelText, getByTestId, getByText, queryByTestId } = render(
      <AddOpeningPositionForm store={store} />,
    );

    openManualAssetEntry(getByTestId);
    fireEvent.changeText(getByLabelText("Asset name"), "Reliance Industries");
    fireEvent.changeText(getByLabelText("Symbol"), "RELIANCE");
    fireEvent.changeText(getByLabelText("Ticker"), "RELIANCE.NS");
    fireEvent.changeText(getByLabelText("Quote source ID"), "RELIANCE.NS");
    fireEvent.press(getByText("Continue to confirm details"));
    fireEvent.press(getByText("Continue to position"));
    fireEvent.press(getByText("Back"));

    expect(getByTestId("add-holding-phase-class")).toBeTruthy();

    fireEvent.press(getByTestId("add-holding-step-asset"));

    expect(getByTestId("add-holding-phase-asset")).toBeTruthy();
    expect(getByLabelText("Asset name")).toHaveProp(
      "value",
      "Reliance Industries",
    );
  });

  it("creates a manual asset and persists a reviewed opening position", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().updatePreferences({ displayMode: "minimal" });
    const { getByLabelText, getByTestId, getByText, queryByTestId } = render(
      <AddOpeningPositionForm store={store} />,
    );

    expect(getByTestId("add-holding-screen")).toBeTruthy();
    openManualAssetEntry(getByTestId);
    expect(getByTestId("asset-input")).toBeTruthy();
    expect(getByTestId("symbol-input")).toBeTruthy();
    expect(getByTestId("ticker-input")).toBeTruthy();
    expect(getByTestId("quote-source-id-input")).toBeTruthy();
    fireEvent.changeText(getByLabelText("Asset name"), "Reliance Industries");
    fireEvent.changeText(getByLabelText("Symbol"), "RELIANCE");
    fireEvent.changeText(getByLabelText("Ticker"), "RELIANCE.NS");
    fireEvent.changeText(getByLabelText("Quote source ID"), "RELIANCE.NS");
    fireEvent.press(getByText("Continue to confirm details"));

    expect(getByTestId("asset-class-stock")).toBeTruthy();
    expect(getByTestId("instrument-type-picker")).toBeTruthy();
    expect(getByTestId("sector-type-picker")).toBeTruthy();

    selectOption(getByTestId, "sector-type", "energy");
    fireEvent.press(getByText("Continue to position"));

    expect(getByTestId("quantity-input")).toBeTruthy();
    expect(getByTestId("average-cost-input")).toBeTruthy();
    expect(getByTestId("price-input")).toBeTruthy();
    expect(getByTestId("date-input")).toBeTruthy();
    expect(getByTestId("review-holding-button")).toBeTruthy();

    fireEvent.changeText(getByLabelText("Quantity"), "25");
    fireEvent.changeText(getByLabelText("Average cost"), "1450");
    fireEvent.changeText(getByLabelText("Current price"), "1678.25");
    selectDate(getByTestId, "date-input", "2026-04-15");
    fireEvent.press(getByTestId("conviction-4"));
    fireEvent.changeText(getByLabelText("Note"), "Excel opening position");

    fireEvent.press(getByText("Review and save"));
    expect(getByTestId("derived-preview")).toBeTruthy();
    expect(getByText("₹36,250.00")).toBeTruthy();
    expect(getByText("₹41,956.25")).toBeTruthy();
    expect(getByText("+₹5,706.25")).toBeTruthy();
    expect(
      StyleSheet.flatten(getByTestId("derived-preview-pnl").props.style),
    ).toMatchObject({
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    });
    expect(
      StyleSheet.flatten(getByTestId("derived-preview-pnl-percent").props.style),
    ).toMatchObject({
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    });
    expect(getByText("Cash impact")).toBeTruthy();
    expect(
      getByText(
        "No cash movement. Opening positions are existing holdings funded outside CogVest.",
      ),
    ).toBeTruthy();
    expect(getByTestId("save-holding-button")).toBeTruthy();

    fireEvent.press(getByText("Save Holding"));

    await waitFor(() => {
      expect(store.getState().assets).toHaveLength(1);
      expect(store.getState().openingPositions).toHaveLength(1);
    });

    expect(store.getState().assets[0]).toMatchObject({
      assetClass: "stock",
      instrumentType: "stock",
      name: "Reliance Industries",
      quoteSourceId: "RELIANCE.NS",
      sectorType: "energy",
      symbol: "RELIANCE",
      ticker: "RELIANCE.NS",
    });
    expect(store.getState().openingPositions[0]).toMatchObject({
      assetId: store.getState().assets[0].id,
      averageCostPrice: 1450,
      conviction: 4,
      manualValuation: {
        currency: "INR",
        price: 1678.25,
        provenance: "user",
        source: "manual",
      },
      notes: "Excel opening position",
      quantity: 25,
    });
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().quoteCache).toEqual({});
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");
    expect(getByText("Opening position saved.")).toBeTruthy();
    expect(getByTestId("view-holding-button")).toBeTruthy();
    expect(getByTestId("add-another-holding-button")).toBeTruthy();
  });

  it.each([
    {
      assetClass: "stock" as const,
      expectedSectorType: "energy" as const,
      instrumentType: "stock" as const,
    },
    {
      assetClass: "etf" as const,
      expectedSectorType: "diversified" as const,
      instrumentType: "etf" as const,
    },
  ])(
    "persists the $assetClass class, instrument, and financial records",
    async ({ assetClass, expectedSectorType, instrumentType }) => {
      const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
      const { getByLabelText, getByTestId, getByText } = render(
        <AddOpeningPositionForm store={store} />,
      );

      openManualConfirmDetails(getByLabelText, getByTestId, getByText);
      fireEvent.press(getByTestId(`asset-class-${assetClass}`));
      selectOption(getByTestId, "instrument-type", instrumentType);
      if (assetClass === "stock") {
        selectOption(getByTestId, "sector-type", "energy");
      }
      fireEvent.press(getByText("Continue to position"));
      fireEvent.changeText(getByLabelText("Quantity"), "25");
      fireEvent.changeText(getByLabelText("Average cost"), "1450");
      fireEvent.changeText(getByLabelText("Current price"), "1678.25");
      selectDate(getByTestId, "date-input", "2026-04-15");
      fireEvent.press(getByText("Review and save"));
      fireEvent.press(getByText("Save Holding"));

      await waitFor(() => {
        expect(store.getState().assets).toHaveLength(1);
        expect(store.getState().openingPositions).toHaveLength(1);
      });

      const savedAsset = store.getState().assets[0]!;
      const savedPosition = store.getState().openingPositions[0]!;
      expect(savedAsset).toMatchObject({
        assetClass,
        exchange: "NSE",
        instrumentType,
        sectorType: expectedSectorType,
      });
      expect(savedPosition).toMatchObject({
        assetId: savedAsset.id,
        averageCostPrice: 1450,
        date: "2026-04-15",
        manualValuation: {
          currency: "INR",
          price: 1678.25,
          provenance: "user",
          source: "manual",
        },
        quantity: 25,
      });
      expect(store.getState().trades).toEqual([]);
      expect(store.getState().quoteCache).toEqual({});
    },
  );

  it("persists metadata edits after selecting an existing saved asset", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const savedAssetId = "asset-hdfc-bank";
    store.getState().addAsset({
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: savedAssetId,
      instrumentType: "stock",
      name: "HDFC Bank",
      quoteSourceId: "HDFCBANK.NS",
      sectorType: "other",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    });
    const { getByLabelText, getByTestId, getByText } = render(
      <AddOpeningPositionForm store={store} />,
    );

    fireEvent.press(getByTestId(`existing-asset-${savedAssetId}`));
    expect(getByTestId("selected-asset-summary")).toBeTruthy();

    fireEvent.press(getByText("Continue to confirm details"));
    selectOption(getByTestId, "sector-type", "technology");
    fireEvent.press(getByText("Continue to position"));
    fireEvent.changeText(getByLabelText("Quantity"), "25");
    fireEvent.changeText(getByLabelText("Average cost"), "1450");
    fireEvent.changeText(getByLabelText("Current price"), "1678.25");
    selectDate(getByTestId, "date-input", "2026-04-15");

    fireEvent.press(getByText("Review and save"));
    expect(getByTestId("derived-preview")).toBeTruthy();
    fireEvent.press(getByText("Save Holding"));

    await waitFor(() => {
      expect(store.getState().openingPositions).toHaveLength(1);
    });

    const savedPosition = store.getState().openingPositions[0];
    const editedAsset = store
      .getState()
      .assets.find((asset) => asset.id === savedPosition?.assetId);

    expect(store.getState().assets).toHaveLength(1);
    expect(savedPosition?.assetId).toBe(savedAssetId);
    expect(editedAsset).toMatchObject({
      name: "HDFC Bank",
      sectorType: "technology",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    });
    expect(store.getState().assets[0]).toMatchObject({
      id: savedAssetId,
      sectorType: "technology",
    });
  });

  it("offers explicit completion actions after saving", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onComplete = jest.fn();
    const { getByLabelText, getByTestId, getByText, queryByTestId } = render(
      <AddOpeningPositionForm onComplete={onComplete} store={store} />,
    );

    openManualAssetEntry(getByTestId);
    fireEvent.changeText(getByLabelText("Asset name"), "Reliance Industries");
    fireEvent.changeText(getByLabelText("Symbol"), "RELIANCE");
    fireEvent.changeText(getByLabelText("Ticker"), "RELIANCE.NS");
    fireEvent.press(getByText("Continue to confirm details"));
    fireEvent.press(getByText("Continue to position"));
    fireEvent.changeText(getByLabelText("Quantity"), "2");
    fireEvent.changeText(getByLabelText("Average cost"), "100");
    fireEvent.changeText(getByLabelText("Current price"), "120");
    fireEvent.press(getByLabelText("First purchase date unknown"));
    fireEvent.press(getByText("Review and save"));
    fireEvent.press(getByText("Save Holding"));

    await waitFor(() => {
      expect(getByTestId("holding-save-complete")).toBeTruthy();
    });
    expect(onComplete).not.toHaveBeenCalled();
    expect(queryByTestId("save-holding-button")).toBeNull();

    fireEvent.press(getByTestId("view-holding-button"));
    expect(onComplete).toHaveBeenCalledWith(store.getState().assets[0].id);

    fireEvent.press(getByTestId("add-another-holding-button"));

    expect(getByTestId("add-holding-phase-asset")).toBeTruthy();
    expect(queryByTestId("manual-asset-fields")).toBeNull();
    expect(queryByTestId("holding-save-complete")).toBeNull();
  });

  it("uses the simplified quick-setup flow and saves immediately for the chosen action", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onQuickSetupItemSaved = jest.fn();
    const { getByLabelText, getByTestId, getByText, queryByTestId } = render(
      <AddOpeningPositionForm
        onQuickSetupItemSaved={onQuickSetupItemSaved}
        quickSetup
        store={store}
      />,
    );

    expect(getByText("Set up portfolio")).toBeTruthy();
    expect(queryByTestId("add-holding-step-class")).toBeNull();
    openManualAssetEntry(getByTestId);
    fireEvent.changeText(getByLabelText("Asset name"), "Reliance Industries");
    fireEvent.changeText(getByLabelText("Symbol"), "RELIANCE");
    fireEvent.changeText(getByLabelText("Ticker"), "RELIANCE.NS");
    fireEvent.press(getByText("Continue to position"));

    expect(getByTestId("add-holding-phase-position")).toBeTruthy();
    expect(queryByTestId("conviction-1")).toBeNull();
    expect(queryByTestId("notes-input")).toBeNull();
    fireEvent.changeText(getByLabelText("Quantity"), "2");
    fireEvent.changeText(getByLabelText("Average cost"), "100");
    fireEvent.press(getByLabelText("First purchase date unknown"));
    fireEvent.press(getByText("Review and save"));
    fireEvent.press(getByTestId("quick-setup-save-add-next"));

    await waitFor(() => {
      expect(store.getState().openingPositions).toHaveLength(1);
      expect(onQuickSetupItemSaved).toHaveBeenCalledWith(
        expect.objectContaining({ status: "applied" }),
        "addNext",
      );
    });
    expect(getByTestId("add-holding-phase-asset")).toBeTruthy();
  });

  it("explains that only unfinished quick-setup input is discarded on exit", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onCancel = jest.fn();
    const { getByLabelText, getByTestId, getByText } = render(
      <AddOpeningPositionForm onCancel={onCancel} quickSetup store={store} />,
    );

    openManualAssetEntry(getByTestId);
    fireEvent.changeText(getByLabelText("Asset name"), "Draft holding");
    fireEvent.press(getByLabelText("Exit portfolio setup"));

    expect(getByText("Leave portfolio setup?")).toBeTruthy();
    expect(
      getByText(
        "Confirmed holdings are already saved. Unfinished details on this screen will be discarded.",
      ),
    ).toBeTruthy();
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.press(getByTestId("quick-setup-confirm-exit"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(store.getState().assets).toHaveLength(0);
    expect(store.getState().openingPositions).toHaveLength(0);
  });

  it("guards an unfinished quick-setup draft from Android system back", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onCancel = jest.fn();
    let hardwareBack: (() => boolean | null | undefined) | undefined;
    const backHandlerSpy = jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_event, handler) => {
        hardwareBack = handler;
        return { remove: jest.fn() };
      });
    const { getByLabelText, getByTestId, getByText } = render(
      <AddOpeningPositionForm onCancel={onCancel} quickSetup store={store} />,
    );

    openManualAssetEntry(getByTestId);
    fireEvent.changeText(getByLabelText("Asset name"), "Draft holding");
    act(() => {
      expect(hardwareBack?.()).toBe(true);
    });

    expect(getByText("Leave portfolio setup?")).toBeTruthy();
    expect(onCancel).not.toHaveBeenCalled();
    backHandlerSpy.mockRestore();
  });

  it("does not register the setup back guard while its route is unfocused", () => {
    const backHandlerSpy = jest.spyOn(BackHandler, "addEventListener");

    render(
      <AddOpeningPositionForm
        hardwareBackEnabled={false}
        onCancel={jest.fn()}
        quickSetup
        store={createPortfolioStore({ storage: createMemoryJsonStorage() })}
      />,
    );

    expect(backHandlerSpy).not.toHaveBeenCalled();
    backHandlerSpy.mockRestore();
  });

  it("prefills and explicitly updates one safe aggregate opening position", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const assetId = "asset-hdfc";
    store.getState().addAsset({
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: assetId,
      instrumentType: "stock",
      name: "HDFC Bank",
      quoteSourceId: "HDFCBANK.NS",
      sectorType: "financialServices",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    });
    store.getState().addOpeningPosition({
      assetId,
      averageCostPrice: 100,
      date: null,
      id: "opening-hdfc",
      conviction: 4,
      intendedHoldDays: 730,
      measuredAsOf: "2026-04-22",
      notes: "Long-term opening position",
      quantity: 2,
    });
    const { getByLabelText, getByTestId, getByText } = render(
      <AddOpeningPositionForm quickSetup store={store} />,
    );

    fireEvent.press(getByTestId(`existing-asset-${assetId}`));
    expect(getByTestId("quick-setup-duplicate-update")).toBeTruthy();
    fireEvent.press(getByText("Continue to position"));
    expect(getByLabelText("Quantity").props.value).toBe("2");
    fireEvent.changeText(getByLabelText("Quantity"), "3");
    fireEvent.press(getByText("Review and save"));
    fireEvent.press(getByTestId("quick-setup-save-finish"));

    await waitFor(() => {
      expect(store.getState().openingPositions).toHaveLength(1);
      expect(store.getState().openingPositions[0]).toMatchObject({
        id: "opening-hdfc",
        conviction: 4,
        intendedHoldDays: 730,
        measuredAsOf: "2026-04-22",
        notes: "Long-term opening position",
        quantity: 3,
      });
    });
  });

  it("rechecks manual identity and prefills a safe existing aggregate", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset({
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: "asset-manual-existing",
      instrumentType: "stock",
      name: "Reliance Industries",
      sectorType: "energy",
      symbol: "RELIANCE",
      ticker: "RELIANCE.NS",
    });
    store.getState().addOpeningPosition({
      assetId: "asset-manual-existing",
      averageCostPrice: 100,
      date: null,
      id: "opening-manual-existing",
      quantity: 2,
    });
    const { getByLabelText, getByTestId, getByText, queryByTestId } = render(
      <AddOpeningPositionForm quickSetup store={store} />,
    );

    openManualAssetEntry(getByTestId);
    fireEvent.changeText(getByLabelText("Asset name"), "Reliance Industries");
    fireEvent.changeText(getByLabelText("Symbol"), "RELIANCE");
    fireEvent.changeText(getByLabelText("Ticker"), "RELIANCE.NS");
    fireEvent.press(getByText("Continue to position"));

    expect(getByTestId("quick-setup-duplicate-update")).toBeTruthy();
    expect(queryByTestId("add-holding-phase-position")).toBeNull();
    fireEvent.press(getByText("Continue to position"));
    expect(getByLabelText("Quantity").props.value).toBe("2");
  });

  it("rechecks a provider selection when the same asset is saved during lookup", async () => {
    jest.useFakeTimers();
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const result: AssetLookupResult = {
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: "yahoo:HDFCBANK.NS",
      instrumentType: "stock",
      instrumentTypeConfidence: "provider",
      metadataReviewMessage: "Provider details available.",
      name: "HDFC Bank",
      provider: "yahoo",
      quoteSourceId: "HDFCBANK.NS",
      sectorType: "financialServices",
      sectorTypeConfidence: "provider",
      sourceLabel: "Yahoo Finance",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    };
    const searchAssetLookupResults = jest.fn().mockResolvedValue({
      failures: [],
      results: [result],
    });
    const { getByLabelText, getByTestId } = render(
      <AddOpeningPositionForm
        quickSetup
        searchAssetLookupResults={searchAssetLookupResults}
        store={store}
      />,
    );

    fireEvent.changeText(getByLabelText("Search asset"), "hdfc");
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await waitFor(() => {
      expect(getByTestId(`asset-lookup-result-${result.id}`)).toBeTruthy();
    });
    act(() => {
      store.getState().addAsset({
        assetClass: "stock",
        currency: "INR",
        exchange: "NSE",
        id: "asset-race-hdfc",
        instrumentType: "stock",
        name: "HDFC Bank",
        sectorType: "financialServices",
        symbol: "HDFCBANK",
        ticker: "HDFCBANK.NS",
      });
      store.getState().addOpeningPosition({
        assetId: "asset-race-hdfc",
        averageCostPrice: 100,
        date: null,
        id: "opening-race-hdfc",
        quantity: 2,
      });
    });
    fireEvent.press(getByTestId(`asset-lookup-result-${result.id}`));

    expect(getByTestId("quick-setup-duplicate-update")).toBeTruthy();
  });

  it("blocks quick-setup overwrite when an asset has transaction history", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const assetId = "asset-history";
    store.getState().addAsset({
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: assetId,
      name: "History Asset",
      symbol: "HISTORY",
      ticker: "HISTORY.NS",
    });
    store.getState().addTrade({
      assetId,
      date: "2026-01-10",
      id: "trade-history",
      pricePerUnit: 100,
      quantity: 1,
      totalValue: 100,
      type: "buy",
    });
    const { getByTestId, getByText, queryByTestId } = render(
      <AddOpeningPositionForm quickSetup store={store} />,
    );

    fireEvent.press(getByTestId(`existing-asset-${assetId}`));

    expect(getByTestId("quick-setup-duplicate-blocked")).toBeTruthy();
    fireEvent.press(getByText("Continue to position"));
    expect(queryByTestId("add-holding-phase-position")).toBeNull();
  });

  it("ignores repeated save presses while the holding command is completing", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onCancel = jest.fn();
    let hardwareBack: (() => boolean | null | undefined) | undefined;
    const spy = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
      hardwareBack = handler;
      return { remove: jest.fn() };
    });
    let finishHaptics: (() => void) | undefined;

    jest.mocked(Haptics.notificationAsync).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishHaptics = resolve;
      }),
    );
    const { getByTestId, getByText } = render(
      <AddOpeningPositionForm
        initialVisualQaState="review"
        onCancel={onCancel}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("save-holding-button"));
    fireEvent.press(getByTestId("save-holding-button"));

    expect(store.getState().assets).toHaveLength(1);
    expect(store.getState().openingPositions).toHaveLength(1);
    expect(getByText("Saving...")).toBeTruthy();
    act(() => { expect(hardwareBack?.()).toBe(true); });
    fireEvent.press(getByTestId("add-holding-exit"));
    expect(getByTestId("add-holding-phase-review")).toBeTruthy();
    expect(onCancel).not.toHaveBeenCalled();

    finishHaptics?.();

    await waitFor(() => {
      expect(getByText("Opening position saved.")).toBeTruthy();
    });
    expect(store.getState().openingPositions).toHaveLength(1);
    act(() => { expect(hardwareBack?.()).toBe(true); });
    expect(onCancel).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("persists a manual valuation without depending on optional quote caching", async () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });
    const originalSetItem = storage.setItem;

    storage.setItem = (key, value) => {
      if (key === quoteCacheStorageKey) {
        throw new Error("simulated quote cache failure");
      }

      originalSetItem(key, value);
    };
    const { getByTestId, getByText } = render(
      <AddOpeningPositionForm
        initialVisualQaState="review"
        store={store}
      />,
    );

    fireEvent.press(getByTestId("save-holding-button"));

    await waitFor(() => {
      expect(
        getByText("Opening position saved."),
      ).toBeTruthy();
    });
    expect(store.getState().openingPositions).toHaveLength(1);
    expect(store.getState().quoteCache).toEqual({});
  });

  it("creates a non-PPF debt opening position without trade records", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByLabelText, getByTestId, getByText, queryByTestId } = render(
      <AddOpeningPositionForm store={store} />,
    );

    openManualAssetEntry(getByTestId);
    fireEvent.changeText(getByLabelText("Asset name"), "Sovereign Gold Bond");
    fireEvent.changeText(getByLabelText("Symbol"), "SGB");
    fireEvent.changeText(getByLabelText("Ticker"), "SGB");
    fireEvent.changeText(getByLabelText("Quote source ID"), "SGB");
    fireEvent.press(getByText("Continue to confirm details"));
    fireEvent.press(getByTestId("asset-class-debt"));
    expect(queryByTestId("sector-type-picker")).toBeNull();
    expect(getByTestId("sector-not-applicable")).toBeTruthy();
    selectOption(getByTestId, "instrument-type", "bond");
    fireEvent.press(getByText("Continue to position"));
    fireEvent.changeText(getByLabelText("Quantity"), "10");
    fireEvent.changeText(getByLabelText("Average cost"), "5300");
    fireEvent.changeText(getByLabelText("Current price"), "5711");
    selectDate(getByTestId, "date-input", "2026-04-15");

    fireEvent.press(getByText("Review and save"));
    fireEvent.press(getByText("Save Holding"));

    await waitFor(() => {
      expect(store.getState().openingPositions).toHaveLength(1);
    });

    expect(store.getState().assets[0]?.assetClass).toBe("debt");
    expect(store.getState().assets[0]?.instrumentType).toBe("bond");
    expect(store.getState().assets[0]?.sectorType).toBe("fixedIncome");
    expect(store.getState().trades).toEqual([]);
  });

  it("creates a crypto opening position with a case-sensitive quote source", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByLabelText, getByTestId, getByText } = render(
      <AddOpeningPositionForm store={store} />,
    );

    openManualAssetEntry(getByTestId);
    fireEvent.changeText(getByLabelText("Asset name"), "Bitcoin");
    fireEvent.changeText(getByLabelText("Symbol"), "BTC");
    fireEvent.changeText(getByLabelText("Ticker"), "bitcoin");
    fireEvent.changeText(getByLabelText("Quote source ID"), "bitcoin");
    fireEvent.press(getByText("Continue to confirm details"));
    fireEvent.press(getByTestId("asset-class-crypto"));
    fireEvent.press(getByText("Continue to position"));
    fireEvent.changeText(getByLabelText("Quantity"), "0.05");
    fireEvent.changeText(getByLabelText("Average cost"), "5000000");
    fireEvent.changeText(getByLabelText("Current price"), "5800000");
    selectDate(getByTestId, "date-input", "2026-04-15");

    fireEvent.press(getByText("Review and save"));
    fireEvent.press(getByText("Save Holding"));

    await waitFor(() => {
      expect(store.getState().openingPositions).toHaveLength(1);
    });

    expect(store.getState().assets[0]).toMatchObject({
      assetClass: "crypto",
      exchange: "CRYPTO",
      instrumentType: "crypto",
      quoteSourceId: "bitcoin",
      sectorType: "digitalAsset",
      ticker: "bitcoin",
    });
  });

  it("autofills asset metadata and current price from a selected lookup result", async () => {
    jest.useFakeTimers();
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const lookupResult: AssetLookupResult = {
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: "yahoo:HDFCBANK.NS",
      instrumentType: "stock",
      instrumentTypeConfidence: "inferred",
      metadataReviewMessage: "Sector needs review. Yahoo did not provide a sector.",
      name: "HDFC Bank Limited",
      provider: "yahoo",
      quoteSourceId: "HDFCBANK.NS",
      sectorType: "other",
      sectorTypeConfidence: "reviewRequired",
      sourceLabel: "Yahoo Finance",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    };
    const searchAssetLookupResults = jest.fn().mockResolvedValue({
      failures: [],
      results: [lookupResult],
    });
    const resolveQuote = jest.fn().mockImplementation(({ asset }) =>
      Promise.resolve({
        ok: true,
        quote: {
          assetId: asset.id,
          asOf: "2026-05-10T10:00:00.000Z",
          currency: "INR",
          price: 1678.25,
          source: "yahoo",
        },
      }),
    );
    const {
      getByLabelText,
      getByTestId,
      getByText,
      queryByTestId,
    } = render(
      <AddOpeningPositionForm
        resolveQuote={resolveQuote}
        searchAssetLookupResults={searchAssetLookupResults}
        store={store}
      />,
    );

    fireEvent.changeText(getByLabelText("Search asset"), "hdfc bank");
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(getByText("HDFC Bank Limited")).toBeTruthy();
    });
    expect(getByTestId("asset-lookup-results")).toBeTruthy();

    fireEvent.press(getByTestId("asset-lookup-result-yahoo:HDFCBANK.NS"));

    await waitFor(() => {
      expect(getByTestId("selected-asset-summary")).toBeTruthy();
    });
    expect(getByText("HDFC Bank Limited")).toBeTruthy();
    expect(
      getByText("HDFCBANK • HDFCBANK.NS • Yahoo Finance suggestion"),
    ).toBeTruthy();
    expect(queryByTestId("asset-lookup-results")).toBeNull();
    expect(queryByTestId("manual-asset-fields")).toBeNull();
    expect(getByText("Live price autofilled from Yahoo Finance.")).toBeTruthy();
    fireEvent.press(getByText("Continue to confirm details"));
    expect(getByTestId("add-holding-step-class")).toBeTruthy();
    expect(getByTestId("provider-metadata-review-copy")).toBeTruthy();
    fireEvent.press(getByText("Continue to position"));
    expect(getByLabelText("Current price")).toHaveProp("value", "1678.25");
    fireEvent.changeText(getByLabelText("Quantity"), "25");
    fireEvent.changeText(getByLabelText("Average cost"), "1450");
    fireEvent.changeText(getByLabelText("Current price"), "1700");
    selectDate(getByTestId, "date-input", "2026-04-15");
    fireEvent.press(getByText("Review and save"));

    expect(
      getByText("Manual price • Yahoo Finance identity"),
    ).toBeTruthy();
  });

  it.each([
    ["yahoo", "Saved live quote • Yahoo Finance"],
    ["manual", "Saved manual price"],
  ] as const)(
    "shows %s provenance for a saved asset quote",
    (source, expectedLabel) => {
      const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
      const asset = {
        assetClass: "stock" as const,
        currency: "INR" as const,
        exchange: "NSE" as const,
        id: `saved-${source}`,
        instrumentType: "stock" as const,
        name: "Saved HDFC Bank",
        quoteSourceId: "HDFCBANK.NS",
        sectorType: "financialServices" as const,
        symbol: "HDFCBANK",
        ticker: "HDFCBANK.NS",
      };

      store.getState().addAsset(asset);
      store.getState().upsertQuote({
        assetId: asset.id,
        asOf: "2026-07-26T10:00:00.000Z",
        currency: "INR",
        price: 1678.25,
        source,
      });
      const { getByLabelText, getByTestId, getByText } = render(
        <AddOpeningPositionForm store={store} />,
      );

      fireEvent.press(getByTestId(`existing-asset-${asset.id}`));
      fireEvent.press(getByText("Continue to confirm details"));
      fireEvent.press(getByText("Continue to position"));
      fireEvent.changeText(getByLabelText("Quantity"), "25");
      fireEvent.changeText(getByLabelText("Average cost"), "1450");
      selectDate(getByTestId, "date-input", "2026-04-15");
      fireEvent.press(getByText("Review and save"));

      expect(getByText(expectedLabel)).toBeTruthy();
    },
  );

  it("lets the user change a selected lookup asset before continuing", async () => {
    jest.useFakeTimers();
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const lookupResult: AssetLookupResult = {
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: "yahoo:HDFCBANK.NS",
      instrumentType: "stock",
      instrumentTypeConfidence: "inferred",
      metadataReviewMessage: "Sector needs review. Yahoo did not provide a sector.",
      name: "HDFC Bank Limited",
      provider: "yahoo",
      quoteSourceId: "HDFCBANK.NS",
      sectorType: "other",
      sectorTypeConfidence: "reviewRequired",
      sourceLabel: "Yahoo Finance",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    };
    const searchAssetLookupResults = jest.fn().mockResolvedValue({
      failures: [],
      results: [lookupResult],
    });
    const resolveQuote = jest.fn().mockResolvedValue({
      ok: true,
      quote: {
        assetId: "asset-id",
        asOf: "2026-05-10T10:00:00.000Z",
        currency: "INR",
        price: 1678.25,
        source: "yahoo",
      },
    });
    const { getByLabelText, getByTestId, queryByTestId } = render(
      <AddOpeningPositionForm
        resolveQuote={resolveQuote}
        searchAssetLookupResults={searchAssetLookupResults}
        store={store}
      />,
    );

    fireEvent.changeText(getByLabelText("Search asset"), "hdfc bank");
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(getByTestId("asset-lookup-result-yahoo:HDFCBANK.NS")).toBeTruthy();
    });

    fireEvent.press(getByTestId("asset-lookup-result-yahoo:HDFCBANK.NS"));

    await waitFor(() => {
      expect(getByTestId("selected-asset-summary")).toBeTruthy();
    });

    fireEvent.press(getByTestId("selected-asset-change"));

    expect(queryByTestId("selected-asset-summary")).toBeNull();
    expect(getByTestId("asset-lookup-input")).toBeTruthy();
  });

  it("shows review-required metadata hints for low-confidence lookup fields", async () => {
    jest.useFakeTimers();
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const lookupResult: AssetLookupResult = {
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: "yahoo:HDFCBANK.NS",
      instrumentType: "stock",
      instrumentTypeConfidence: "reviewRequired",
      metadataReviewMessage:
        "Instrument type and sector need review. Yahoo did not provide enough detail.",
      name: "HDFC Bank Limited",
      provider: "yahoo",
      quoteSourceId: "HDFCBANK.NS",
      sectorType: "other",
      sectorTypeConfidence: "reviewRequired",
      sourceLabel: "Yahoo Finance",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    };
    const searchAssetLookupResults = jest.fn().mockResolvedValue({
      failures: [],
      results: [lookupResult],
    });
    const resolveQuote = jest.fn().mockResolvedValue({
      ok: true,
      quote: {
        assetId: "asset-id",
        asOf: "2026-05-10T10:00:00.000Z",
        currency: "INR",
        price: 1678.25,
        source: "yahoo",
      },
    });
    const { getByLabelText, getByTestId, getByText, queryByTestId } = render(
      <AddOpeningPositionForm
        resolveQuote={resolveQuote}
        searchAssetLookupResults={searchAssetLookupResults}
        store={store}
      />,
    );

    fireEvent.changeText(getByLabelText("Search asset"), "hdfc bank");
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await waitFor(() => {
      expect(getByTestId("asset-lookup-result-yahoo:HDFCBANK.NS")).toBeTruthy();
    });
    fireEvent.press(getByTestId("asset-lookup-result-yahoo:HDFCBANK.NS"));
    await waitFor(() => {
      expect(getByTestId("selected-asset-summary")).toBeTruthy();
    });

    fireEvent.press(getByText("Continue to confirm details"));

    expect(
      getByText("Suggested details. Confirm anything marked for review."),
    ).toBeTruthy();
    expect(getByTestId("metadata-review-message")).toBeTruthy();
    expect(
      getByText(
        "Instrument type and sector need review. Yahoo did not provide enough detail.",
      ),
    ).toBeTruthy();
    expect(getByTestId("instrument-type-review-hint")).toBeTruthy();
    expect(getByTestId("sector-type-review-hint")).toBeTruthy();
    expect(getByText("Unknown")).toBeTruthy();
  });

  it("keeps selected lookup summary after metadata edits", async () => {
    jest.useFakeTimers();
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const lookupResult: AssetLookupResult = {
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: "yahoo:HDFCBANK.NS",
      instrumentType: "stock",
      instrumentTypeConfidence: "inferred",
      metadataReviewMessage: "Sector needs review. Yahoo did not provide a sector.",
      name: "HDFC Bank Limited",
      provider: "yahoo",
      quoteSourceId: "HDFCBANK.NS",
      sectorType: "other",
      sectorTypeConfidence: "reviewRequired",
      sourceLabel: "Yahoo Finance",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    };
    const searchAssetLookupResults = jest.fn().mockResolvedValue({
      failures: [],
      results: [lookupResult],
    });
    const resolveQuote = jest.fn().mockResolvedValue({
      ok: true,
      quote: {
        assetId: "asset-id",
        asOf: "2026-05-10T10:00:00.000Z",
        currency: "INR",
        price: 1678.25,
        source: "yahoo",
      },
    });
    const { getByLabelText, getByTestId, getByText, queryByTestId } = render(
      <AddOpeningPositionForm
        resolveQuote={resolveQuote}
        searchAssetLookupResults={searchAssetLookupResults}
        store={store}
      />,
    );

    fireEvent.changeText(getByLabelText("Search asset"), "hdfc bank");
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await waitFor(() => {
      expect(getByTestId("asset-lookup-result-yahoo:HDFCBANK.NS")).toBeTruthy();
    });
    fireEvent.press(getByTestId("asset-lookup-result-yahoo:HDFCBANK.NS"));
    await waitFor(() => {
      expect(getByTestId("selected-asset-summary")).toBeTruthy();
    });

    fireEvent.press(getByText("Continue to confirm details"));
    selectOption(getByTestId, "sector-type", "financialServices");
    fireEvent.press(getByText("Asset"));

    expect(getByTestId("selected-asset-summary")).toBeTruthy();
  });

  it("persists edited review-required sector metadata from a selected lookup result", async () => {
    jest.useFakeTimers();
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const lookupResult: AssetLookupResult = {
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: "yahoo:HDFCBANK.NS",
      instrumentType: "stock",
      instrumentTypeConfidence: "inferred",
      metadataReviewMessage: "Sector needs review. Yahoo did not provide a sector.",
      name: "HDFC Bank Limited",
      provider: "yahoo",
      quoteSourceId: "HDFCBANK.NS",
      sectorType: "other",
      sectorTypeConfidence: "reviewRequired",
      sourceLabel: "Yahoo Finance",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    };
    const searchAssetLookupResults = jest.fn().mockResolvedValue({
      failures: [],
      results: [lookupResult],
    });
    const resolveQuote = jest.fn().mockResolvedValue({
      ok: true,
      quote: {
        assetId: "asset-id",
        asOf: "2026-05-10T10:00:00.000Z",
        currency: "INR",
        price: 1678.25,
        source: "yahoo",
      },
    });
    const { getByLabelText, getByTestId, getByText } = render(
      <AddOpeningPositionForm
        resolveQuote={resolveQuote}
        searchAssetLookupResults={searchAssetLookupResults}
        store={store}
      />,
    );

    fireEvent.changeText(getByLabelText("Search asset"), "hdfc bank");
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await waitFor(() => {
      expect(getByTestId("asset-lookup-result-yahoo:HDFCBANK.NS")).toBeTruthy();
    });
    fireEvent.press(getByTestId("asset-lookup-result-yahoo:HDFCBANK.NS"));
    await waitFor(() => {
      expect(getByTestId("selected-asset-summary")).toBeTruthy();
    });

    fireEvent.press(getByText("Continue to confirm details"));
    expect(getByText("Unknown")).toBeTruthy();
    selectOption(getByTestId, "sector-type", "financialServices");
    fireEvent.press(getByText("Continue to position"));
    fireEvent.changeText(getByLabelText("Quantity"), "25");
    fireEvent.changeText(getByLabelText("Average cost"), "1450");
    fireEvent.changeText(getByLabelText("Current price"), "1678.25");
    selectDate(getByTestId, "date-input", "2026-04-15");

    fireEvent.press(getByText("Review and save"));
    expect(getByTestId("derived-preview")).toBeTruthy();
    fireEvent.press(getByText("Save Holding"));

    await waitFor(() => {
      expect(store.getState().assets).toHaveLength(1);
      expect(store.getState().openingPositions).toHaveLength(1);
    });

    expect(store.getState().assets[0]).toMatchObject({
      currency: "INR",
      exchange: "NSE",
      instrumentType: "stock",
      quoteSourceId: "HDFCBANK.NS",
      sectorType: "financialServices",
    });
    expect(store.getState().quoteCache[store.getState().assets[0].id]).toMatchObject({
      currency: "INR",
      price: 1678.25,
      source: "yahoo",
    });
  });

  it("does not autofill exact lookup matches before explicit selection", async () => {
    jest.useFakeTimers();
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const lookupResult: AssetLookupResult = {
      assetClass: "crypto",
      currency: "INR",
      exchange: "CRYPTO",
      id: "coingecko:bitcoin",
      instrumentType: "crypto",
      instrumentTypeConfidence: "inferred",
      metadataReviewMessage: "Provider details look ready. Confirm before saving.",
      name: "Bitcoin",
      provider: "coingecko",
      quoteSourceId: "bitcoin",
      sectorType: "digitalAsset",
      sectorTypeConfidence: "inferred",
      sourceLabel: "CoinGecko",
      symbol: "BTC",
      ticker: "bitcoin",
    };
    const searchAssetLookupResults = jest.fn().mockResolvedValue({
      failures: [],
      results: [lookupResult],
    });
    const resolveQuote = jest.fn().mockResolvedValue({
      ok: true,
      quote: {
        assetId: "asset-id",
        asOf: "2026-05-10T10:00:00.000Z",
        currency: "INR",
        price: 5800000,
        source: "coingecko",
      },
    });
    const { getByLabelText, getByTestId, getByText, queryByTestId } = render(
      <AddOpeningPositionForm
        resolveQuote={resolveQuote}
        searchAssetLookupResults={searchAssetLookupResults}
        store={store}
      />,
    );

    fireEvent.changeText(getByLabelText("Search asset"), "bitcoin");
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(getByText("Bitcoin")).toBeTruthy();
    });

    expect(queryByTestId("manual-asset-fields")).toBeNull();
    expect(resolveQuote).not.toHaveBeenCalled();

    fireEvent(getByLabelText("Search asset"), "submitEditing");

    expect(queryByTestId("manual-asset-fields")).toBeNull();
    expect(resolveQuote).not.toHaveBeenCalled();

    fireEvent.press(getByTestId("asset-lookup-result-coingecko:bitcoin"));

    await waitFor(() => {
      expect(getByTestId("selected-asset-summary")).toBeTruthy();
    });
    expect(getByText("BTC • bitcoin • CoinGecko suggestion")).toBeTruthy();
    expect(resolveQuote).toHaveBeenCalledTimes(1);
  });

  it("keeps manual price fallback available when selected lookup quote fails", async () => {
    jest.useFakeTimers();
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const lookupResult: AssetLookupResult = {
      assetClass: "crypto",
      currency: "INR",
      exchange: "CRYPTO",
      id: "coingecko:bitcoin",
      instrumentType: "crypto",
      instrumentTypeConfidence: "inferred",
      metadataReviewMessage: "Provider details look ready. Confirm before saving.",
      name: "Bitcoin",
      provider: "coingecko",
      quoteSourceId: "bitcoin",
      sectorType: "digitalAsset",
      sectorTypeConfidence: "inferred",
      sourceLabel: "CoinGecko",
      symbol: "BTC",
      ticker: "bitcoin",
    };
    const searchAssetLookupResults = jest.fn().mockResolvedValue({
      failures: [],
      results: [lookupResult],
    });
    const resolveQuote = jest.fn().mockResolvedValue({
      error: "CoinGecko quote response did not include an INR price.",
      ok: false,
    });
    const {
      getAllByText,
      getByLabelText,
      getByTestId,
      getByText,
      queryByTestId,
    } = render(
      <AddOpeningPositionForm
        resolveQuote={resolveQuote}
        searchAssetLookupResults={searchAssetLookupResults}
        store={store}
      />,
    );

    fireEvent.changeText(getByLabelText("Search asset"), "bitcoin");
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(getByText("Bitcoin")).toBeTruthy();
    });
    expect(queryByTestId("manual-asset-fields")).toBeNull();

    fireEvent.press(getByText("Bitcoin"));

    await waitFor(() => {
      expect(getByTestId("selected-asset-summary")).toBeTruthy();
      expect(
        getByText("Live price unavailable. Enter current price manually."),
      ).toBeTruthy();
    });
    expect(getByText("BTC • bitcoin • CoinGecko suggestion")).toBeTruthy();
    fireEvent.press(getByText("Continue to confirm details"));
    fireEvent.press(getByText("Continue to position"));
    expect(getByLabelText("Current price")).toHaveProp("value", "");
    fireEvent.changeText(getByLabelText("Quantity"), "2");
    fireEvent.changeText(getByLabelText("Average cost"), "5000000");
    fireEvent.press(getByText("I don't know"));
    fireEvent.press(getByText("Review and save"));
    expect(getAllByText("Valuation pending").length).toBeGreaterThan(1);
  });
});
