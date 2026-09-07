export type ChartRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";

export type DisplayMode = "minimal" | "standard";

export type Preferences = {
  defaultChartRange: ChartRange;
  displayMode: DisplayMode;
  hasCompletedOnboarding: boolean;
  maskWealthValues: boolean;
  nudgeVersions?: Partial<Record<"metadata" | "minimal" | "insights", number>>;
};
