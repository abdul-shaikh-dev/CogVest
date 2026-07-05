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
    expect(getByText("Your portfolio stays here")).toBeTruthy();
    expect(getByText("Local storage")).toBeTruthy();
    expect(getByText("Active")).toBeTruthy();
    expect(getByText("Account")).toBeTruthy();
    expect(getByText("Not required")).toBeTruthy();
    expect(getByText("Cloud sync")).toBeTruthy();
    expect(getAllByText("Off")).toHaveLength(2);
    expect(getByText("Analytics")).toBeTruthy();
    expect(getByText("Value masking")).toBeTruthy();
    expect(getByText("Preview ₹••,•••")).toBeTruthy();
    expect(queryByText(/Minimal Mode/i)).toBeNull();
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

    const { getByText, queryByTestId, queryByText } = render(
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
    expect(queryByText("Backup")).toBeNull();
    expect(queryByText(/Minimal Mode/i)).toBeNull();
    expect(queryByText(/LTCG/i)).toBeNull();
    expect(getByText("Clear local data")).toBeTruthy();
    expect(
      getByText("Disabled until confirmation and backup guidance exist."),
    ).toBeTruthy();
    expect(getByText("Deferred")).toBeTruthy();
    expect(queryByTestId("clear-local-data-button")).toBeNull();
  });
});
