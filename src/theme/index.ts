export {};
export const colors = {
  background: "#000000",
  blue: "#0A84FF",
  cashBlue: "#64D2FF",
  cryptoAmber: "#FFD60A",
  deepGreen: "#248A3D",
  primary: "#34C759",
  profit: "#34C759",
  loss: "#FF453A",
  warning: "#FF9F0A",
  border: {
    subtle: "rgba(255,255,255,0.10)",
    strong: "#38383A",
  },
  surface: {
    card: "#1C1C1E",
    elevated: "#2C2C2E",
  },
  text: {
    primary: "#FFFFFF",
    secondary: "#8E8E93",
    muted: "#48484A",
    inverse: "#FFFFFF",
  },
} as const;

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
  primaryRippleColor: "rgba(0,0,0,0.18)",
  pressedOpacity: 0.75,
  rippleColor: "rgba(255,255,255,0.12)",
  stateLayerOpacity: 0.12,
  disabledOpacity: 0.48,
} as const;

export const shadows = {
  none: {
    elevation: 0,
    shadowOpacity: 0,
  },
} as const;
