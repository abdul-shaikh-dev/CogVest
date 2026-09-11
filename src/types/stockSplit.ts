/** Evidence-backed unit conversion, not a purchase or an external cash flow. */
export type StockSplitEvent = {
  id: string;
  kind: "split";
  effectiveDate: string;
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
