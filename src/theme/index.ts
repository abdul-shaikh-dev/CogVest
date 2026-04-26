export {};
export const colors = {
  background: "#1C1B1F",
  primary: "#2E7D52",
  profit: "#4CAF7A",
  loss: "#D65A5A",
  border: {
    subtle: "rgba(255,255,255,0.08)",
  },
  surface: {
    card: "#2A2930",
    elevated: "#312F36",
  },
  text: {
    primary: "#E6E1E5",
    secondary: "#CAC4D0",
    muted: "#938F99",
    inverse: "#FFFFFF",
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  cardGap: 10,
  cardInner: 12,
  md: 16,
  lg: 24,
  xl: 32,
  screenHorizontal: 16,
} as const;

export const radii = {
  sm: 8,
  card: 12,
  button: 16,
  pill: 999,
} as const;

export const typography = {
  sizes: {
    caption: 12,
    body: 16,
    title: 20,
    hero: 32,
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
