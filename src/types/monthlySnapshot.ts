import type { HistoricalPriceBasis } from "./quote";

export type MonthlySnapshotGenerationMetadata = {
  generatedAt: string;
  priceBasis: HistoricalPriceBasis | "mixed";
  source: "auto" | "manual";
  warnings: string[];
};

export type MonthlyPerformanceBasis =
  | {
      netExternalFlow: number;
      status: "complete";
      warnings: string[];
      weightedExternalFlow: number;
    }
  | {
      reason:
        | "ambiguous-cash-flow"
        | "legacy-snapshot"
        | "manual-snapshot";
      status: "unavailable";
      warnings: string[];
    };

export type MonthlySnapshot = {
  cashValue: number;
  cryptoValue: number;
  debtValue: number;
  equityValue: number;
  generated?: MonthlySnapshotGenerationMetadata;
  id: string;
  investedValue: number;
  month: string;
  monthlyExpense?: number;
  monthlyInvestment: number;
  notes?: string;
  performanceBasis?: MonthlyPerformanceBasis;
  portfolioValue: number;
  salary: number;
};
