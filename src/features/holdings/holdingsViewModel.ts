import { assetClassLabel } from "@/src/components/common";
import { instrumentTypeLabel, sectorTypeLabel } from "@/src/domain/assets";
import { formatCompactINR, formatINR, formatPercentage } from "@/src/domain/formatters";
import type { QuoteFreshnessSummary } from "@/src/services/quotes";
import type { Asset } from "@/src/types";

import type { HoldingFilter, HoldingReviewItem } from "./holdingsReview";

// Pure view logic for the Holdings screen and its sections.

export const filterOrder: HoldingFilter[] = [
  "all",
  "winners",
  "losers",
  "high-allocation",
];

/** Header subtitle: market positions, then PPF and EPF records when present. */
export function getHoldingsSubtitle({
  epfAccounts,
  marketPositions,
  ppfRecords,
}: {
  epfAccounts: number;
  marketPositions: number;
  ppfRecords: number;
}) {
  return `${marketPositions} market ${marketPositions === 1 ? "position" : "positions"}${ppfRecords > 0 ? ` · PPF ${ppfRecords}` : ""}${epfAccounts > 0 ? ` · EPF ${epfAccounts}` : ""}`;
}

export function getQuoteStatus({
  failed,
  isRefreshing,
  quoteFreshness,
  timedOut,
}: {
  failed: number;
  isRefreshing: boolean;
  quoteFreshness: QuoteFreshnessSummary;
  timedOut: number;
}) {
  const counts = `Current ${quoteFreshness.current} · Stale ${quoteFreshness.stale} · Manual ${quoteFreshness.manual} · Missing ${quoteFreshness.missing}`;

  if (isRefreshing) {
    return {
      detail: counts,
      prominent: false,
      title: "Refreshing quotes...",
    };
  }

  if (failed > 0 || timedOut > 0) {
    const outcomes = [
      failed > 0 ? `${failed} failed` : "",
      timedOut > 0 ? `${timedOut} timed out` : "",
    ].filter(Boolean);
    const usablePriceCount = quoteFreshness.total - quoteFreshness.missing;

    return {
      detail: `${counts}. ${outcomes.join(" · ")}. ${
        usablePriceCount > 0
          ? "Existing prices remain available."
          : "No usable prices are available."
      }`,
      prominent: usablePriceCount === 0 || quoteFreshness.missing > 0,
      title:
        usablePriceCount > 0
          ? "Refresh partially completed"
          : "Quote refresh failed",
    };
  }

  if (quoteFreshness.status === "empty") {
    return {
      detail: "Quote coverage appears after your first holding.",
      prominent: false,
      title: "No holdings to price",
    };
  }

  const prominent = quoteFreshness.missing > 0;
  const title = prominent
    ? "Price coverage needs attention"
    : quoteFreshness.status === "current"
      ? "Prices up to date"
      : "Using saved prices";

  return {
    detail: counts,
    prominent,
    title,
  };
}

export function getFilterCounts(
  items: HoldingReviewItem[],
  allocationAvailable: boolean,
) {
  return {
    all: items.length,
    "high-allocation": allocationAvailable
      ? items.filter((item) => item.allocationPct >= 10).length
      : 0,
    losers: items.filter(
      (item) =>
        item.holding.unrealisedPnL !== null && item.holding.unrealisedPnL < 0,
    ).length,
    winners: items.filter(
      (item) =>
        item.holding.unrealisedPnL !== null && item.holding.unrealisedPnL >= 0,
    ).length,
  };
}

export function getFilterLabel(filter: HoldingFilter) {
  if (filter === "high-allocation") {
    return "High allocation";
  }

  return filter.charAt(0).toUpperCase() + filter.slice(1);
}

export function formatClassification(item: HoldingReviewItem) {
  return [
    assetClassLabel(item.holding.asset.assetClass),
    instrumentTypeLabel(item.holding.asset.instrumentType ?? "other"),
    sectorTypeLabel(item.holding.asset.sectorType ?? "other"),
  ].join(" · ");
}

export function formatQuantity(value: number) {
  return Number.isInteger(value)
    ? value.toString()
    : value.toFixed(4).replace(/0+$/, "");
}

export function formatSignedCompactINR(value: number) {
  const amount = formatCompactINR(value);

  return value > 0 ? `+${amount}` : amount;
}

export function formatHoldingWeight(value: number) {
  if (value > 0 && value < 0.05) return "<0.1%";
  return `${value.toFixed(1)}%`;
}

export function isRawIsin(value: string) {
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/u.test(value.trim().toUpperCase());
}

export function getHoldingRowIdentity(asset: Asset) {
  const instrumentType =
    asset.instrumentType ??
    (asset.assetClass === "stock" ? "stock" : "other");
  const parts = [
    isRawIsin(asset.symbol) ? undefined : asset.symbol,
    instrumentTypeLabel(instrumentType),
    instrumentType === "mutualFund"
      ? assetClassLabel(asset.assetClass)
      : undefined,
  ];

  return parts.filter(Boolean).join(" · ");
}

export function getHoldingRowAccessibilityLabel({
  identity,
  item,
  masked,
  minimal,
  weightAvailable,
}: {
  identity: string;
  item: HoldingReviewItem;
  masked: boolean;
  minimal: boolean;
  weightAvailable: boolean;
}) {
  const { holding } = item;
  const currentValue =
    holding.currentValue === null
      ? "Current value unavailable"
      : masked
        ? "Current value hidden"
        : `Current value ${formatINR(holding.currentValue)}`;
  const invested = masked
    ? "Invested value hidden"
    : `Invested ${formatINR(holding.totalInvested)}`;
  const pnl =
    holding.unrealisedPnL === null
      ? "Unrealised P and L unavailable"
      : masked
        ? `Unrealised P and L hidden, ${formatPercentage(holding.unrealisedPnLPct ?? 0)}`
        : `Unrealised P and L ${formatINR(holding.unrealisedPnL)}, ${formatPercentage(holding.unrealisedPnLPct ?? 0)}`;
  const weight = weightAvailable
    ? `Weight ${formatHoldingWeight(item.allocationPct)}`
    : "Weight unavailable";

  return [
    `Open ${holding.asset.name} details`,
    identity,
    currentValue,
    ...(minimal ? [] : [invested, pnl]),
    weight,
  ].join(". ");
}
