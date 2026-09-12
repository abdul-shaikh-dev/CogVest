/** Derived, never persisted. Amounts retain decimal precision across allocation. */
export type DemergerAdjustment = {
  eventId: string;
  assetId: string;
  date: string;
} & ({ kind: "retainedCost"; retainedFraction: string } | {
  kind: "entitlement";
  quantity: number;
  cost: string;
  sourceAssetId: string;
  sourceRecordIds: string[];
  firstAcquisitionDate: string | null;
});
