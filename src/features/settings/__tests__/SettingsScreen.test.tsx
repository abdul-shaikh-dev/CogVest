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
    const { getByLabelText, getByTestId, getByText, queryByText } = render(
      <SettingsScreen store={store} />,
    );

    expect(getByTestId("value-mask-toggle")).toBeTruthy();
    expect(getByText("Settings")).toBeTruthy();
    expect(getByText("Value masking")).toBeTruthy();
    expect(getByText("Values visible")).toBeTruthy();
    expect(getByText("Local storage active")).toBeTruthy();
    expect(getByText("No account")).toBeTruthy();
    expect(getByText("No cloud sync")).toBeTruthy();
    expect(getByText("No analytics")).toBeTruthy();
    expect(getByText("App version 1.0.0")).toBeTruthy();
    expect(queryByText(/Minimal Mode/i)).toBeNull();
    expect(queryByText(/LTCG/i)).toBeNull();

    fireEvent.press(getByLabelText("Toggle value masking"));

    expect(store.getState().preferences.maskWealthValues).toBe(true);
    expect(getByText("Values masked")).toBeTruthy();
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

    const { getByText, queryByTestId } = render(<SettingsScreen store={store} />);

    expect(getByText("Latest quote refresh")).toBeTruthy();
    expect(getByText("16 May 2026")).toBeTruthy();
    expect(getByText("Provider status")).toBeTruthy();
    expect(getByText("Live available")).toBeTruthy();
    expect(getByText("Manual fallback")).toBeTruthy();
    expect(getByText("1 manual quote")).toBeTruthy();
    expect(getByText("Density changes")).toBeTruthy();
    expect(getByText("V1 locked")).toBeTruthy();
    expect(getByText("Clear local data")).toBeTruthy();
    expect(getByText("Deferred")).toBeTruthy();
    expect(queryByTestId("clear-local-data-button")).toBeNull();
  });
});
