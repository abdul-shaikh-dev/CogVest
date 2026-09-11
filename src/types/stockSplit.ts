/** Legacy type/storage name for verified share adjustments, never purchases.
 * For a bonus, newShares are additional shares per oldShares held.
 * For a split, newShares replace oldShares.
 */
export type StockSplitEvent = {
  id: string;
  kind: "split" | "bonus";
  effectiveDate: string;
  /** Required for bonus events; economic entitlement is not immediate tradability. */
  creditedDate?: string;
  oldIsin: string;
  newIsin: string;
  newShares: number;
  oldShares: number;
  evidence: {
    url: string;
    publishedDate: string;
    verifiedDate: string;
  };
};
