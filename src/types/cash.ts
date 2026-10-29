export type CashEntryType = "addition" | "withdrawal";

export type CashEntryPurpose =
  | "capitalContribution"
  | "legacyUncategorized"
  | "purchaseFunding"
  | "saleProceeds"
  | "futuresTransfer"
  | "epfTransfer"
  | "distribution"
  | "ppfTransfer"
  | "withdrawal";

export type CashEntry = {
  amount: number;
  date: string;
  id: string;
  institution?: string;
  label: string;
  linkedTradeId?: string;
  linkedFutures?: { accountId: string; eventId: string };
  linkedEpf?: { accountId: string; eventId: string };
  /** Set on the Cash addition that received a payout paid to Cash. */
  linkedDistributionId?: string;
  /** Set on the Cash leg owned by a PPF entry paid from or into Cash. */
  linkedPpf?: { accountId: string; entryId: string };
  notes?: string;
  purpose: CashEntryPurpose;
  type: CashEntryType;
};
