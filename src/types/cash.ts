export type CashEntryType = "addition" | "withdrawal";

export type CashEntryPurpose =
  | "capitalContribution"
  | "income"
  | "legacyUncategorized"
  | "purchaseFunding"
  | "saleProceeds"
  | "withdrawal";

export type CashEntry = {
  amount: number;
  date: string;
  id: string;
  institution?: string;
  label: string;
  linkedTradeId?: string;
  notes?: string;
  purpose: CashEntryPurpose;
  type: CashEntryType;
};
