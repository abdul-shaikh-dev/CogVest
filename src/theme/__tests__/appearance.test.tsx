import { useEffect, useState } from "react";
import { Appearance, AppState, TextInput, View, type ColorSchemeName, type AppStateStatus } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import { ThemeProvider, createThemedStyles, useTheme, resolveAppearance, darkColors, lightColors } from "@/src/theme";
import { AppText, AppButton } from "@/src/components/common";

const useStyles = createThemedStyles((colors) => ({ panel: { backgroundColor: colors.surface.card } }));

describe("appearance", () => {
  let system: ColorSchemeName;
  let appearanceChanged: (event: { colorScheme: ColorSchemeName }) => void;
  let appStateChanged: (state: AppStateStatus) => void;
  const removed = jest.fn();

  beforeEach(() => {
    system = "light";
    jest.spyOn(Appearance, "getColorScheme").mockImplementation(() => system);
    jest.spyOn(Appearance, "setColorScheme").mockImplementation(() => {});
    jest.spyOn(Appearance, "addChangeListener").mockImplementation((listener) => {
      appearanceChanged = listener;
      return { remove: removed };
    });
    jest.spyOn(AppState, "addEventListener").mockImplementation((_, listener) => {
      appStateChanged = listener;
      return { remove: removed };
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it("resolves manual overrides and a dark fallback when Android has no scheme", () => {
    expect(resolveAppearance("system", null)).toBe("dark");
    expect(resolveAppearance("system", "light")).toBe("light");
    expect(resolveAppearance("system", "dark")).toBe("dark");
    expect(resolveAppearance("dark", "light")).toBe("dark");
    expect(resolveAppearance("light", "dark")).toBe("light");
  });

  it("updates mounted styles and text on system changes/resume without losing a draft", () => {
    const mounted = jest.fn();
    function Draft() {
      const styles = useStyles();
      const { scheme } = useTheme();
      const [value, setValue] = useState("");
      useEffect(() => { mounted(); }, []);
      return <View testID="panel" style={styles.panel}><AppText>{scheme}</AppText>
        <TextInput testID="draft" value={value} onChangeText={setValue} />
        <AppButton testID="button" title="Save" />
      </View>;
    }
    const view = render(<ThemeProvider preference="system"><Draft /></ThemeProvider>);
    expect(view.getByTestId("panel")).toHaveStyle({ backgroundColor: lightColors.surface.card });
    expect(view.getByText("Save")).toHaveStyle({ color: lightColors.text.inverse });
    expect(view.getByTestId("button")).toHaveStyle({ backgroundColor: lightColors.primary });
    fireEvent.changeText(view.getByTestId("draft"), "unsaved amount");
    act(() => appearanceChanged({ colorScheme: "dark" }));
    expect(view.getByText("dark")).toHaveStyle({ color: darkColors.text.primary });
    expect(view.getByTestId("panel")).toHaveStyle({ backgroundColor: darkColors.surface.card });
    expect(view.getByTestId("button")).toHaveStyle({ backgroundColor: darkColors.primary });
    expect(view.getByTestId("draft").props.value).toBe("unsaved amount");
    act(() => { system = "light"; appStateChanged("active"); });
    expect(view.getByText("light")).toHaveStyle({ color: lightColors.text.primary });
    view.rerender(<ThemeProvider preference="dark"><Draft /></ThemeProvider>);
    act(() => appearanceChanged({ colorScheme: "light" }));
    expect(view.getByText("dark")).toBeTruthy();
    expect(Appearance.setColorScheme).toHaveBeenLastCalledWith("dark");
    view.rerender(<ThemeProvider preference="system"><Draft /></ThemeProvider>);
    expect(Appearance.setColorScheme).toHaveBeenLastCalledWith(null);
    expect(view.getByText("light")).toBeTruthy();
    expect(view.getByTestId("draft").props.value).toBe("unsaved amount");
    expect(mounted).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(removed).toHaveBeenCalled();
  });
});

function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
it.each([darkColors, lightColors])("keeps normal text, financial colors and filled-action labels readable", (colors) => {
  for (const background of [colors.background, colors.surface.card, colors.surface.elevated, colors.selected]) {
    for (const foreground of [colors.text.primary, colors.text.secondary, colors.profit, colors.loss, colors.warning, colors.blue, colors.cashBlue, colors.cryptoAmber]) {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  }
  for (const fill of [colors.primary, colors.loss]) expect(contrast(colors.text.inverse, fill)).toBeGreaterThanOrEqual(4.5);
  for (const background of [colors.background, colors.surface.card, colors.surface.elevated]) expect(contrast(colors.border.strong, background)).toBeGreaterThanOrEqual(3);
});
