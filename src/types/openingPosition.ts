import type { ConvictionScore } from "./trade";

export type OpeningPosition = {
  assetId: string;
  averageCostPrice: number;
  conviction?: ConvictionScore;
  currentPrice?: number;
  date: string | null;
  id: string;
  notes?: string;
  quantity: number;
  recordedAt?: string;
  recordedOn?: string;
};
