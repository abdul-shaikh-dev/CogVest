export type ChartRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";

export type DisplayMode = "minimal" | "standard";
export type AppearancePreference = "system" | "light" | "dark";

/** Target share of each Dashboard allocation class, in percent; together 100 (#764). */
export type AllocationTargets = { equity: number; debt: number; crypto: number; cash: number };

export type Preferences = {
  /** Optional target mix; absent until the user sets one (#764). */
  allocationTargets?: AllocationTargets;
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
