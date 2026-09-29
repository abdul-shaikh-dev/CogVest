export type CashEntryType = "addition" | "withdrawal";

export type CashEntryPurpose =
  | "capitalContribution"
  | "legacyUncategorized"
  | "purchaseFunding"
  | "saleProceeds"
  | "futuresTransfer"
  | "withdrawal";

export type CashEntry = {
  amount: number;
  date: string;
  id: string;
  institution?: string;
  label: string;
  linkedTradeId?: string;
  linkedFutures?: { accountId: string; eventId: string };
  notes?: string;
  purpose: CashEntryPurpose;
  type: CashEntryType;
};
