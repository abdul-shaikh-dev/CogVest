import type { Asset } from "./asset";

export type Holding = {
  asset: Asset;
  averageCostPrice: number;
  currentPrice: number;
  currentValue: number;
  dayChangePct?: number;
  daysToLtcg?: number;
  heldDays?: number;
  lastUpdated?: string;
  ltcgEligible?: boolean;
  totalInvested: number;
  totalUnits: number;
  unrealisedPnL: number;
  unrealisedPnLPct: number;
};
