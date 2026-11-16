import { decimal, normalizePercentage } from "@/src/domain/precision";
import type { AssetClass, MonthlySnapshot } from "@/src/types";

/** Percentage change from `previous`; null when there is no non-zero base. */
export function percentageChange(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous === 0) return null;

  return normalizePercentage(
    decimal(current).minus(previous).dividedBy(decimal(previous).abs()).times(100),
  );
}

export type SnapshotAssetClassValue = {
  assetClass: AssetClass;
  current: number;
  previous: number | undefined;
};

const snapshotFieldByAssetClass = {
  cash: "cashValue",
  crypto: "cryptoValue",
  debt: "debtValue",
  stock: "equityValue",
} as const satisfies Partial<Record<AssetClass, keyof MonthlySnapshot>>;

export const snapshotAssetClasses = ["stock", "debt", "crypto", "cash"] as const;

/** Each asset class's month-end value beside the previous month's (#666). */
export function snapshotAssetClassValues(
  snapshot: MonthlySnapshot,
  previous: MonthlySnapshot | undefined,
): SnapshotAssetClassValue[] {
  return snapshotAssetClasses.map((assetClass) => {
    const field = snapshotFieldByAssetClass[assetClass];
    return { assetClass, current: snapshot[field], previous: previous?.[field] };
  });
}
