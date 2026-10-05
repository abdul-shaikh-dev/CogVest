// Static palettes are for verification; runtime UI must subscribe with useTheme.
export { darkColors as colors, darkColors, lightColors } from "./palettes";
export type { ThemeColors } from "./palettes";
export { ThemeProvider, useTheme, createThemedStyles, resolveAppearance } from "./ThemeProvider";

export const spacing = {
  xs: 4,
  sm: 8,
  cardGap: 12,
  cardInner: 14,
  md: 16,
  lg: 24,
  xl: 32,
  screenHorizontal: 16,
} as const;

export const radii = {
  sm: 8,
  card: 18,
  button: 14,
  sheet: 22,
  pill: 999,
} as const;

export const typography = {
  sizes: {
    caption: 12,
    body: 15,
    section: 17,
    title: 19,
    largeTitle: 30,
    hero: 38,
  },
  weights: {
    regular: "400",
    medium: "600",
    bold: "700",
  },
} as const;

export const interaction = {
  minimumTouchTarget: 48,
  primaryRippleColor: "rgba(0,0,0,0.06)",
  pressedOpacity: 0.98,
  rippleColor: "rgba(0,0,0,0.18)",
  stateLayerOpacity: 0.12,
  disabledOpacity: 0.48,
} as const;

export const shadows = {
  none: {
    elevation: 0,
    shadowOpacity: 0,
  },
} as const;
