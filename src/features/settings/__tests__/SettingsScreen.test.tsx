import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import { fireEvent, render } from "@testing-library/react-native";

import { SettingsScreen } from "@/src/features/settings";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "test-version" } },
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(),
}));

const mockedConstants = Constants as unknown as {
  expoConfig?: { version?: string };
};

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedConstants.expoConfig = { version: "test-version" };
  });

  it("routes to the focused backup and restore flows and explains manual backup privacy", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByTestId, getByText } = render(<SettingsScreen store={store} />);

    expect(getByText("Portfolio backup")).toBeTruthy();
    fireEvent.press(getByTestId("backup-portfolio-action"));
    fireEvent.press(getByTestId("restore-backup-action"));
    expect(mockPush).toHaveBeenNthCalledWith(1, "/backup?mode=export");
    expect(mockPush).toHaveBeenNthCalledWith(2, "/backup?mode=restore");

    fireEvent.press(getByTestId("privacy-details-toggle"));
    expect(getByText("Manual portfolio backups are available. They are not encrypted, so save them only somewhere you trust.")).toBeTruthy();
  });

  it("shows collapsed privacy settings and toggles value masking", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const {
      getAllByText,
      getByLabelText,
      getByTestId,
      getByText,
      queryByTestId,
      queryByText,
    } = render(<SettingsScreen store={store} />);

    expect(getByTestId("value-mask-toggle")).toBeTruthy();
    expect(getByTestId("value-mask-toggle").props.accessibilityState).toEqual({
      checked: false,
    });
    expect(getByText("Settings")).toBeTruthy();
    expect(getByText("Local-first controls")).toBeTruthy();
    expect(queryByText("Local only")).toBeNull();
    expect(getByText("Privacy & storage")).toBeTruthy();
    expect(queryByTestId("privacy-storage-details")).toBeNull();
    expect(queryByText("Android backup")).toBeNull();
    expect(
      getByTestId("privacy-details-toggle").props.accessibilityState,
    ).toEqual({ expanded: false });
    expect(getByText("Hide portfolio amounts. Preview ₹••,•••")).toBeTruthy();

    fireEvent.press(getByTestId("privacy-details-toggle"));

    expect(
      getByTestId("privacy-details-toggle").props.accessibilityState,
    ).toEqual({ expanded: true });
    expect(getByTestId("privacy-storage-details")).toBeTruthy();
    expect(getByText("Android backup")).toBeTruthy();
    expect(getByText("Excluded")).toBeTruthy();
    expect(
      getByText(
        "Cloud backup, device-to-device, and cross-platform transfer are disabled.",
      ),
    ).toBeTruthy();
    expect(
      getByText(
        "Protected by Android app-private storage and device security. Separate app encryption is not included in V1.",
      ),
    ).toBeTruthy();
    expect(getByText("Account")).toBeTruthy();
    expect(getByText("Not required")).toBeTruthy();
    expect(getByText("Cloud sync")).toBeTruthy();
    expect(getAllByText("Off")).toHaveLength(2);
    expect(getByText("Analytics")).toBeTruthy();
    expect(getByText("Value masking")).toBeTruthy();
    expect(getByText("Display")).toBeTruthy();
    expect(getByText("Minimal")).toBeTruthy();
    expect(queryByText(/LTCG/i)).toBeNull();

    fireEvent.press(getByTestId("privacy-details-toggle"));

    expect(
      getByTestId("privacy-details-toggle").props.accessibilityState,
    ).toEqual({ expanded: false });
    expect(queryByTestId("privacy-storage-details")).toBeNull();

    fireEvent.press(getByLabelText("Toggle value masking"));

    expect(getByTestId("value-mask-toggle").props.accessibilityState).toEqual({
      checked: true,
    });
    expect(store.getState().preferences.maskWealthValues).toBe(true);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it("shows empty price information without refresh or provider claims", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByTestId, getByText, queryByRole, queryByTestId, queryByText } =
      render(<SettingsScreen store={store} />);
    const toggle = getByTestId("settings-price-details-toggle");

    expect(toggle.props.accessibilityState).toEqual({ expanded: false });
    expect(queryByTestId("settings-price-details")).toBeNull();
    expect(queryByText("Latest quote refresh")).toBeNull();
    expect(queryByText("Clear local data")).toBeNull();
    expect(queryByText("Unavailable")).toBeNull();

    fireEvent.press(toggle);

    expect(toggle.props.accessibilityState).toEqual({ expanded: true });
    expect(getByTestId("settings-price-details")).toBeTruthy();
    expect(getByText("Newest price update date")).toBeTruthy();
    expect(getByText("No quotes yet")).toBeTruthy();
    expect(getByText("Price sources")).toBeTruthy();
    expect(getByText("None yet")).toBeTruthy();
    expect(getByText("No separate price updates saved yet.")).toBeTruthy();
    expect(getByText("Manual price updates")).toBeTruthy();
    expect(getByText("0 price updates")).toBeTruthy();
    expect(queryByText("Live")).toBeNull();
    expect(queryByText("Provider")).toBeNull();
    expect(queryByRole("button", { name: "Price sources" })).toBeNull();

    fireEvent.press(toggle);

    expect(toggle.props.accessibilityState).toEqual({ expanded: false });
    expect(queryByTestId("settings-price-details")).toBeNull();
  });

  it("does not treat an initial manual holding price as a saved price update", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addOpeningPosition({
      assetId: "asset-initial-manual",
      averageCostPrice: 100,
      date: "2026-05-01T00:00:00.000Z",
      id: "opening-initial-manual",
      manualValuation: {
        asOf: "2026-05-02T00:00:00.000Z",
        currency: "INR",
        price: 120,
        provenance: "user",
        source: "manual",
      },
      quantity: 10,
    });

    const { getByTestId, getByText } = render(<SettingsScreen store={store} />);

    fireEvent.press(getByTestId("settings-price-details-toggle"));

    expect(store.getState().quoteCache).toEqual({});
    expect(
      store.getState().openingPositions[0]?.manualValuation?.price,
    ).toBe(120);
    expect(
      getByText(
        "These are separate price updates. Prices entered with initial holdings may also be in use; check Dashboard for valuation coverage.",
      ),
    ).toBeTruthy();
    expect(getByText("No separate price updates saved yet.")).toBeTruthy();
    expect(getByText("0 price updates")).toBeTruthy();
  });

  it("shows manual saved-price provenance without calling it live", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().upsertQuote({
      assetId: "asset-manual",
      asOf: "2026-05-16T10:00:00.000Z",
      currency: "INR",
      price: 200,
      source: "manual",
    });

    const { getByTestId, getByText, queryByText } = render(
      <SettingsScreen store={store} />,
    );

    fireEvent.press(getByTestId("settings-price-details-toggle"));

    expect(getByText("16 May 2026")).toBeTruthy();
    expect(getByText("Manual")).toBeTruthy();
    expect(getByText("Prices you entered yourself.")).toBeTruthy();
    expect(getByText("1 price update")).toBeTruthy();
    expect(queryByText("Live")).toBeNull();
    expect(queryByText("Provider")).toBeNull();
  });

  it("shows provider saved-price provenance without a Live label", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().upsertQuote({
      assetId: "asset-live",
      asOf: "2026-05-15T10:00:00.000Z",
      currency: "INR",
      price: 100,
      source: "yahoo",
    });

    const { getByTestId, getByText, queryByText } = render(
      <SettingsScreen store={store} />,
    );

    fireEvent.press(getByTestId("settings-price-details-toggle"));

    expect(getByText("15 May 2026")).toBeTruthy();
    expect(getByText("Provider")).toBeTruthy();
    expect(
      getByText("Saved provider prices; freshness is shown on Dashboard."),
    ).toBeTruthy();
    expect(getByText("0 price updates")).toBeTruthy();
    expect(queryByText("Live")).toBeNull();
  });

  it("shows mixed saved-price provenance and keeps quote facts informational", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().upsertQuote({
      assetId: "asset-live",
      asOf: "2026-05-15T10:00:00.000Z",
      currency: "INR",
      price: 100,
      source: "yahoo",
    });
    store.getState().upsertQuote({
      assetId: "asset-manual",
      asOf: "2026-05-16T10:00:00.000Z",
      currency: "INR",
      price: 200,
      source: "manual",
    });

    const { getByTestId, getByText, queryByRole, queryByText } = render(
      <SettingsScreen store={store} />,
    );

    fireEvent.press(getByTestId("settings-price-details-toggle"));

    expect(getByText("16 May 2026")).toBeTruthy();
    expect(getByText("Mixed")).toBeTruthy();
    expect(
      getByText("Saved provider prices and prices you entered."),
    ).toBeTruthy();
    expect(getByText("1 price update")).toBeTruthy();
    expect(queryByText("Latest quote refresh")).toBeNull();
    expect(queryByText("Provider status")).toBeNull();
    expect(queryByText("Live")).toBeNull();
    expect(queryByRole("button", { name: "Newest price update date" })).toBeNull();
    expect(queryByRole("button", { name: "Manual price updates" })).toBeNull();
    expect(queryByText("Clear local data")).toBeNull();
    expect(queryByText("Unavailable")).toBeNull();
  });

  it("shows About values with a truthful configured version", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByText, queryByRole } = render(<SettingsScreen store={store} />);

    expect(getByText("Base currency")).toBeTruthy();
    expect(getByText("INR-first summaries across CogVest.")).toBeTruthy();
    expect(getByText("INR")).toBeTruthy();
    expect(getByText("Version")).toBeTruthy();
    expect(getByText("CogVest for Android.")).toBeTruthy();
    expect(getByText("test-version")).toBeTruthy();
    expect(queryByRole("button", { name: "Base currency" })).toBeNull();
    expect(queryByRole("button", { name: "Version" })).toBeNull();
  });

  it("falls back when Expo does not provide an app version", () => {
    mockedConstants.expoConfig = undefined;
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    const { getByText } = render(<SettingsScreen store={store} />);

    expect(getByText("Not available")).toBeTruthy();
  });

  it("selects and persists Minimal display mode", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });
    const { getByTestId } = render(<SettingsScreen store={store} />);

    expect(getByTestId("display-mode-standard").props.accessibilityState).toEqual({
      checked: true,
    });

    fireEvent.press(getByTestId("display-mode-minimal"));

    expect(store.getState().preferences.displayMode).toBe("minimal");
    expect(getByTestId("display-mode-minimal").props.accessibilityState).toEqual({
      checked: true,
    });
    expect(
      createPortfolioStore({ storage }).getState().preferences.displayMode,
    ).toBe("minimal");
  });
});
