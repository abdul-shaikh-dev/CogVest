import type { ConsolidatedHoldingRow } from "@/src/domain/calculations";
import {
  decimal,
  normalizeMoney,
  normalizePercentage,
  sumFinancialValues,
} from "@/src/domain/precision";
import type { AssetClass, Holding } from "@/src/types";

export type HoldingWithQuoteMetadata = Holding & {
  quoteSource?: string;
};

export type HoldingReviewItem = {
  allocationPct: number;
  holding: HoldingWithQuoteMetadata;
  initialAllocationPct: number;
};

export type HoldingFilter = "all" | "winners" | "losers" | "high-allocation";

export type ExposureSegment = {
  color: "blue" | "green" | "amber";
  count: number;
  key: "equity" | "debt" | "crypto";
  label: string;
  percentage: number;
  value: number;
};

export function createHoldingReviewItems(
  holdings: HoldingWithQuoteMetadata[],
  rows: ConsolidatedHoldingRow[],
): HoldingReviewItem[] {
  const rowsByAssetId = new Map(rows.map((row) => [row.asset.id, row]));

  return holdings
    .map((holding) => {
      const row = rowsByAssetId.get(holding.asset.id);

      return {
        allocationPct: row?.currentAllocationPct ?? 0,
        holding,
        initialAllocationPct: row?.initialAllocationPct ?? 0,
      };
    })
    .sort(
      (left, right) =>
        right.holding.currentValue - left.holding.currentValue,
    );
}

export function getHoldingReviewSummary(items: HoldingReviewItem[]) {
  const dominant = [...items].sort(
    (left, right) => right.allocationPct - left.allocationPct,
  )[0];
  const bestReturn = items
    .filter((item) => item.holding.unrealisedPnL > 0)
    .sort(
      (left, right) =>
        right.holding.unrealisedPnLPct - left.holding.unrealisedPnLPct,
    )[0];
  const topThreeAllocationPct = [...items]
    .sort((left, right) => right.allocationPct - left.allocationPct)
    .slice(0, 3);

  return {
    bestReturn,
    dominant,
    topThreeAllocationPct: normalizePercentage(
      sumFinancialValues(
        topThreeAllocationPct.map((item) => item.allocationPct),
      ),
    ),
  };
}

export function getExposureSegments(
  items: HoldingReviewItem[],
): ExposureSegment[] {
  const groups: ExposureSegment[] = [
    {
      color: "green",
      count: 0,
      key: "equity",
      label: "Equity",
      percentage: 0,
      value: 0,
    },
    {
      color: "blue",
      count: 0,
      key: "debt",
      label: "Debt",
      percentage: 0,
      value: 0,
    },
    {
      color: "amber",
      count: 0,
      key: "crypto",
      label: "Crypto",
      percentage: 0,
      value: 0,
    },
  ];
  const totalValue = sumFinancialValues(
    items.map(
      (item) =>
        item.holding.calculationBasis?.currentValue ??
        item.holding.currentValue,
    ),
  );
  const preciseValues = new Map(
    groups.map((group) => [group.key, decimal(0)] as const),
  );

  for (const item of items) {
    const key = getExposureKey(item.holding.asset.assetClass);
    const group = groups.find((candidate) => candidate.key === key);

    if (group) {
      group.count += 1;
      preciseValues.set(
        group.key,
        preciseValues
          .get(group.key)!
          .plus(
            item.holding.calculationBasis?.currentValue ??
              item.holding.currentValue,
          ),
      );
    }
  }

  return groups
    .filter((group) => group.count > 0)
    .map((group) => {
      const preciseValue = preciseValues.get(group.key)!;

      return {
        ...group,
        percentage: totalValue.isZero()
          ? 0
          : normalizePercentage(preciseValue.dividedBy(totalValue).times(100)),
        value: normalizeMoney(preciseValue),
      };
    });
}

export function filterHoldingReviewItems(
  items: HoldingReviewItem[],
  filter: HoldingFilter,
  searchQuery: string,
) {
  return items.filter(
    (item) =>
      matchesFilter(item, filter) &&
      matchesSearch(item.holding, searchQuery),
  );
}

function getExposureKey(assetClass: AssetClass) {
  if (assetClass === "stock" || assetClass === "etf") {
    return "equity";
  }

  return assetClass;
}

function matchesFilter(item: HoldingReviewItem, filter: HoldingFilter) {
  if (filter === "winners") {
    return item.holding.unrealisedPnL >= 0;
  }

  if (filter === "losers") {
    return item.holding.unrealisedPnL < 0;
  }

  if (filter === "high-allocation") {
    return item.allocationPct >= 10;
  }

  return true;
}

function matchesSearch(holding: Holding, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    holding.asset.name,
    holding.asset.symbol,
    holding.asset.ticker,
    holding.asset.assetClass,
    holding.asset.instrumentType,
    holding.asset.sectorType,
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}
