import * as Haptics from "expo-haptics";
import { fireEvent, render } from "@testing-library/react-native";

import { SettingsScreen } from "@/src/features/settings";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(),
}));

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows privacy settings without V2 settings leaks and toggles value masking", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const {
      getAllByText,
      getByLabelText,
      getByTestId,
      getByText,
      queryByText,
    } = render(<SettingsScreen store={store} />);

    expect(getByTestId("value-mask-toggle")).toBeTruthy();
    expect(getByText("Settings")).toBeTruthy();
    expect(getByText("Local only")).toBeTruthy();
    expect(getByText("Privacy & storage")).toBeTruthy();
    expect(getByText("Local storage")).toBeTruthy();
    expect(getByText("Active")).toBeTruthy();
    expect(
      getByText("Records stay in CogVest's app-private Android storage."),
    ).toBeTruthy();
    expect(getByText("No account • No cloud sync • No analytics")).toBeTruthy();
    expect(queryByText("Android backup")).toBeNull();

    fireEvent.press(getByTestId("privacy-details-toggle"));

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
    expect(getByText("Preview ₹••,•••")).toBeTruthy();
    expect(getByText("Display")).toBeTruthy();
    expect(getByText("Minimal")).toBeTruthy();
    expect(queryByText(/LTCG/i)).toBeNull();

    fireEvent.press(getByLabelText("Toggle value masking"));

    expect(store.getState().preferences.maskWealthValues).toBe(true);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it("shows real quote status and marks unsupported rows as deferred", () => {
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

    const { getByTestId, getByText, queryByTestId, queryByText } = render(
      <SettingsScreen store={store} />,
    );

    expect(getByText("Latest quote refresh")).toBeTruthy();
    expect(getByText("16 May 2026")).toBeTruthy();
    expect(getByText("Quote source")).toBeTruthy();
    expect(queryByText("Provider status")).toBeNull();
    expect(getByText("Mixed")).toBeTruthy();
    expect(getByText("Manual fallback")).toBeTruthy();
    expect(getByText("1 manual quote")).toBeTruthy();
    expect(getByText("Currency & App")).toBeTruthy();
    expect(getByText("Base currency")).toBeTruthy();
    expect(getByText("INR")).toBeTruthy();
    expect(getByText("Version")).toBeTruthy();
    expect(getByText("Preview")).toBeTruthy();
    expect(queryByText("Foreign asset summary")).toBeNull();
    expect(queryByText("USD & crypto fallback")).toBeNull();
    expect(queryByText("Density changes")).toBeNull();
    expect(queryByText(/Export/i)).toBeNull();
    fireEvent.press(getByTestId("privacy-details-toggle"));
    expect(getByText("Android backup")).toBeTruthy();
    expect(getByText("Minimal")).toBeTruthy();
    expect(queryByText(/LTCG/i)).toBeNull();
    expect(getByText("Clear local data")).toBeTruthy();
    expect(
      getByText("Not available in V1. No data is changed from this screen."),
    ).toBeTruthy();
    expect(getByText("Unavailable")).toBeTruthy();
    expect(queryByTestId("clear-local-data-button")).toBeNull();
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
    expect(createPortfolioStore({ storage }).getState().preferences.displayMode).toBe(
      "minimal",
    );
  });
});
