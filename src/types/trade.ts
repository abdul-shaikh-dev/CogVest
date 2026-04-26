export type TradeType = "buy" | "sell";

export type ConvictionScore = 1 | 2 | 3 | 4 | 5;

export type Trade = {
  assetId: string;
  conviction?: ConvictionScore;
  date: string;
  fees?: number;
  id: string;
  intendedHoldDays?: number;
  notes?: string;
  pricePerUnit: number;
  quantity: number;
  totalValue: number;
  type: TradeType;
  whyThisTrade?: string;
};
