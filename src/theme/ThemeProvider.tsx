import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Appearance, AppState, type ColorSchemeName } from "react-native";

import type { AppearancePreference } from "@/src/types/preferences";
import { darkColors, lightColors, type ThemeColors } from "./palettes";

export function resolveAppearance(preference: AppearancePreference, system: ColorSchemeName) {
  return preference === "system" ? (system === "light" ? "light" : "dark") : preference;
}

const themes = {
  dark: { scheme: "dark" as const, colors: darkColors },
  light: { scheme: "light" as const, colors: lightColors },
};
const ThemeContext = createContext(themes.dark as (typeof themes)[keyof typeof themes]);

export function ThemeProvider({ preference, children }: {
  preference: AppearancePreference;
  children: ReactNode;
}) {
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme);
  useEffect(() => {
    const refresh = () => setSystemScheme(Appearance.getColorScheme());
    const appearance = Appearance.addChangeListener(({ colorScheme }) => setSystemScheme(colorScheme));
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    // Also theme native dialogs. Android handles uiMode without recreating React navigation.
    Appearance.setColorScheme(preference === "system" ? null : preference);
    refresh();
    return () => { appearance.remove(); appState.remove(); };
  }, [preference]);
  return <ThemeContext.Provider value={themes[resolveAppearance(preference, systemScheme)]}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }

/** Build each palette once; consumers subscribe without recreating styles per render. */
export function createThemedStyles<T>(factory: (colors: ThemeColors) => T) {
  const styles = { dark: factory(darkColors), light: factory(lightColors) };
  return function useThemedStyles() { return styles[useTheme().scheme]; };
}
