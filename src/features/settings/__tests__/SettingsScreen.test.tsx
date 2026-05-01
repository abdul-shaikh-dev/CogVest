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

  it("shows privacy settings and toggles value masking", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByLabelText, getByText } = render(<SettingsScreen store={store} />);

    expect(getByText("Settings")).toBeTruthy();
    expect(getByText("Value masking")).toBeTruthy();
    expect(getByText("Values visible")).toBeTruthy();
    expect(getByText("Local-first privacy")).toBeTruthy();
    expect(getByText("App version 1.0.0")).toBeTruthy();

    fireEvent.press(getByLabelText("Toggle value masking"));

    expect(store.getState().preferences.maskWealthValues).toBe(true);
    expect(getByText("Values masked")).toBeTruthy();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });
});
