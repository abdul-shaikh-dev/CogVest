/**
 * A savings goal (#767): a target amount in INR by a date, measured against
 * the whole portfolio or chosen holdings and accounts. A declaration only: it
 * never changes holdings, Cash or snapshots.
 */
export type SavingsGoal = {
  id: string;
  name: string;
  targetAmountInr: number;
  /** YYYY-MM-DD. */
  targetDate: string;
  /**
   * The user's own yearly return assumption, in percent (for example 8 for
   * 8%). Projections using it are estimates.
   */
  assumedAnnualReturnPct: number;
  scope: SavingsGoalScope;
  createdAt: string;
  updatedAt: string;
};

export type SavingsGoalScope =
  | { kind: "portfolio" }
  | {
      kind: "selected";
      /** Holdings by asset id. */
      assetIds: string[];
      includeCash: boolean;
      ppfAccountIds: string[];
      epfAccountIds: string[];
    };
