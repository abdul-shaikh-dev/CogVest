export {};
export const colors = {
  background: "#000000",
  blue: "#0A84FF",
  cashBlue: "#64D2FF",
  cryptoAmber: "#FFD60A",
  deepGreen: "#0E6B4F",
  primary: "#2E7D52",
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
  cardGap: 14,
  cardInner: 16,
  md: 16,
  lg: 24,
  xl: 32,
  screenHorizontal: 16,
} as const;

export const radii = {
  sm: 10,
  card: 20,
  button: 16,
  sheet: 24,
  pill: 999,
} as const;

export const typography = {
  sizes: {
    caption: 12,
    body: 16,
    title: 20,
    largeTitle: 32,
    hero: 42,
  },
  weights: {
    regular: "400",
    medium: "600",
    bold: "700",
  },
} as const;

export const interaction = {
  pressedOpacity: 0.75,
  disabledOpacity: 0.48,
} as const;

export const shadows = {
  none: {
    elevation: 0,
    shadowOpacity: 0,
  },
} as const;
