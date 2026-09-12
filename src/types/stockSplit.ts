/** Legacy type/storage name for verified share adjustments, never purchases.
 * For a bonus, newShares are additional shares per oldShares held.
 * For a split, newShares replace oldShares.
 */
export type StockSplitEvent = {
  id: string;
  kind: "split" | "bonus";
  effectiveDate: string;
  /** A bonus needs either this credit date or an evidence-backed availability bound. */
  creditedDate?: string;
  /** Confirmed available by this date; not necessarily the first trading/credit date. */
  availableFrom?: string;
  /** Explicit ordering for a verified same-day multi-event chain. */
  sequence?: number;
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
