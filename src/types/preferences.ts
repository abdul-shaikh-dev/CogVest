export type ChartRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";

export type Preferences = {
  defaultChartRange: ChartRange;
  hasCompletedOnboarding: boolean;
  maskWealthValues: boolean;
};
