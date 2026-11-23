export type ChartRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";

export type DisplayMode = "minimal" | "standard";
export type AppearancePreference = "system" | "light" | "dark";

export type Preferences = {
  appearance?: AppearancePreference;
  /**
   * Blocks screenshots, screen recording and the recents preview (Android
   * FLAG_SECURE). Off unless the user turns it on (#660).
   */
  blockScreenCapture?: boolean;
  defaultChartRange: ChartRange;
  displayMode: DisplayMode;
  hasCompletedOnboarding: boolean;
  maskWealthValues: boolean;
  nudgeVersions?: Partial<Record<"metadata" | "minimal" | "insights", number>>;
  /**
   * Lets the home-screen widget show the portfolio value (#786). Off unless
   * the user turns it on; masking and App lock still hide it.
   */
  showWidgetValue?: boolean;
};
