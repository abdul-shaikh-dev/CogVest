import type { Currency } from "./asset";
import type { ConvictionScore } from "./trade";

export type OpeningPositionManualValuation = {
  asOf: string | null;
  currency: Currency;
  price: number;
  provenance: "legacy" | "user";
  source: "manual";
};

export type OpeningPosition = {
  assetId: string;
  averageCostPrice: number;
  conviction?: ConvictionScore;
  /** Legacy fallback accepted for migration and low-level compatibility only. */
  currentPrice?: number;
  date: string | null;
  id: string;
  intendedHoldDays?: number;
  manualValuation?: OpeningPositionManualValuation;
  /** The date the aggregate position was measured for transaction cutover. */
  measuredAsOf?: string;
  notes?: string;
  quantity: number;
  recordedAt?: string;
  recordedOn?: string;
};
