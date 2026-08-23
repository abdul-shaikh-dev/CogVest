export type TradeType = "buy" | "sell";

export type TransactionType = TradeType | "transferIn" | "transferOut";

export type ConvictionScore = 1 | 2 | 3 | 4 | 5;

export type ImportedTransactionProvenance = {
  account?: string;
  externalId?: string;
  fees?: number;
  fingerprint?: string;
  importBatchId: string;
  originalDescription?: string;
  originalRowNumber: number;
  settlementDate?: string;
  sourceExchange?: string;
  sourceExecutedAt?: string;
  sourceFileIndex?: number;
  sourceFileName?: string;
  sourceFormat: string;
  sourceOrderId?: string;
  sourceSegment?: string;
  sourceSymbol?: string;
  sourceVersion: string;
  taxes?: number;
};

type TradeBase = {
  assetId: string;
  conviction?: ConvictionScore;
  date: string;
  id: string;
  importProvenance?: ImportedTransactionProvenance;
  intendedHoldDays?: number;
  notes?: string;
  quantity: number;
  whyThisTrade?: string;
};

export type BuyTrade = TradeBase & {
  fees?: number;
  pricePerUnit: number;
  totalValue: number;
  type: "buy";
};

export type SellTrade = TradeBase & {
  fees?: number;
  pricePerUnit: number;
  totalValue: number;
  type: "sell";
};

export type TransferInTrade = TradeBase & {
  /** The supplied acquisition cost. Its absence makes reconciliation unresolved. */
  acquisitionCostPerUnit?: number;
  type: "transferIn";
};

export type TransferOutTrade = TradeBase & {
  type: "transferOut";
};

/**
 * Persisted portfolio transaction. Manual entry remains limited to BuyTrade and
 * SellTrade through TradeType, while imports can represent transfers honestly.
 */
export type Trade = BuyTrade | SellTrade | TransferInTrade | TransferOutTrade;
