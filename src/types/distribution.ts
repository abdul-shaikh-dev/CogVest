/** Where a dividend or other payout went. See docs/design/xirr-evidence-contract.md (D2). */
export type DistributionTreatment = "paidToCash" | "paidOutside" | "reinvested";

/** A dividend, IDCW or other payout from one asset, in INR. Net = gross − tax withheld. */
export type Distribution = {
  assetId: string;
  grossAmount: number;
  id: string;
  /** Required for paidToCash: the Cash addition holding the net amount. */
  linkedCashEntryId?: string;
  /** Required for reinvested: the buy of the same asset that the payout funded. */
  linkedTradeId?: string;
  notes?: string;
  paidOn: string;
  recordedAt: string;
  taxWithheld: number;
  treatment: DistributionTreatment;
};

/**
 * The user's ongoing statement that every payout from this asset since `from`
 * is recorded, including none (D3, owner decision 30 October 2026). It stays
 * valid until the user changes or removes it.
 */
export type DistributionCoverage = {
  assetId: string;
  confirmedAt: string;
  from: string;
};
