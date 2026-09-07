import type { Asset, Currency } from "./asset";
import type { QuoteSource } from "./quote";

export type HoldingValuation =
  | {
      asOf: string | null;
      currency: Currency;
      price: number;
      source: QuoteSource;
      status: "fetched" | "manual";
    }
  | {
      status: "pending";
    };

export type Holding = {
  asset: Asset;
  averageCostPrice: number;
  calculationBasis?: {
    averageCostPrice: string;
    currentValue?: string;
    totalInvested: string;
    totalUnits: string;
    unrealisedPnL?: string;
  };
  currentPrice: number | null;
  currentValue: number | null;
  dayChangePct?: number;
  lastUpdated?: string;
  totalInvested: number;
  totalUnits: number;
  unrealisedPnL: number | null;
  unrealisedPnLPct: number | null;
  valuation: HoldingValuation;
};
