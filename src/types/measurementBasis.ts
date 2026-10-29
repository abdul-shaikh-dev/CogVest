/**
 * Where whole-portfolio XIRR starts (D9 in docs/design/xirr-evidence-contract.md).
 * A declaration, not a transaction: it never changes Cash, holdings or snapshots.
 */
export type MeasurementBasis = {
  startDate: string;
  /** `inception`: nothing was held before the start. `openingValue`: a bounded period. */
  kind: "inception" | "openingValue";
  /** Total of the breakdown for `openingValue`; null for `inception`. */
  openingValueInr: number | null;
  /** Value of each account or holding at the end of the start date. Empty for `inception`. */
  openingBreakdown: MeasurementBasisLine[];
  confirmedAt: string;
  /**
   * Fingerprint of the records dated on or before the start, taken at
   * confirmation. A different fingerprint now means the opening value needs
   * confirming again. Null for `inception`, which is checked directly.
   */
  evidenceDigest: string | null;
};

export type MeasurementBasisLine = { label: string; valueInr: number };

/** Whether money for a PPF entry or trade moved through CogVest Cash (D10, D11). */
export type FundingSource = "cash" | "external";
