import type { ConvictionScore } from "./trade";

export type OpeningPosition = {
  assetId: string;
  averageCostPrice: number;
  conviction?: ConvictionScore;
  currentPrice?: number;
  date: string;
  id: string;
  notes?: string;
  quantity: number;
};
