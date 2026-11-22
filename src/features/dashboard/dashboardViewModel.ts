import type { DimensionValue } from "react-native";

import { assetClassLabel } from "@/src/components/common";
import {
  formatCompactINR,
  formatINR,
  formatPercentage,
} from "@/src/domain/formatters";
import type { ReportingAllocationClass } from "@/src/domain/calculations/reportingAllocation";
import type { QuoteFreshnessSummary } from "@/src/services/quotes";
import type { ThemeColors } from "@/src/theme";

export function formatSignedINR(value: number) {
  const amount = formatINR(value);

  return value > 0 ? `+${amount}` : amount;
}

export function formatSignedCompactINR(value: number) {
  const amount = formatCompactINR(value);

  return value > 0 ? `+${amount}` : amount;
}

export function formatUnsignedPercentage(value: number) {
  return formatPercentage(value).replace("+", "");
}

export function getDisplayAllocationLabel(assetClass: ReportingAllocationClass) {
  if (assetClass === "equity") {
    return "Equity";
  }

  return assetClassLabel(assetClass);
}

export function getAllocationColor(colors: ThemeColors, assetClass: ReportingAllocationClass) {
  if (assetClass === "cash") {
    return colors.cashBlue;
  }

  if (assetClass === "crypto") {
    return colors.cryptoAmber;
  }

  if (assetClass === "debt") {
    return colors.blue;
  }

  return colors.primary;
}

export function getAllocationWidth(
  value: number,
  positiveTotal: number,
): DimensionValue {
  if (value <= 0 || positiveTotal <= 0) {
    return "0%";
  }

  return `${(value / positiveTotal) * 100}%`;
}

export function getQuoteStatus({
  hasFutures,
  isRefreshing,
  quoteFailed,
  quoteFreshness,
  quoteTimedOut,
  refreshError,
}: {
  hasFutures: boolean;
  isRefreshing: boolean;
  quoteFailed: number;
  quoteFreshness: QuoteFreshnessSummary;
  quoteTimedOut: number;
  refreshError?: string;
}) {
  const counts = `Current ${quoteFreshness.current} · Stale ${quoteFreshness.stale} · Manual ${quoteFreshness.manual} · Missing ${quoteFreshness.missing}`;

  if (isRefreshing) {
    return {
      detail: counts,
      prominent: false,
      title: "Refreshing quotes...",
    };
  }

  if (refreshError) {
    return { detail: `${counts}. ${refreshError}`, prominent: true, title: "Prices not saved" };
  }

  if (quoteFailed > 0 || quoteTimedOut > 0) {
    const outcomes = [
      quoteFailed > 0 ? `${quoteFailed} failed` : "",
      quoteTimedOut > 0 ? `${quoteTimedOut} timed out` : "",
    ].filter(Boolean);
    const usablePriceCount =
      quoteFreshness.total - quoteFreshness.missing;

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
      detail: hasFutures
        ? "Review Futures mark prices, wallet balance and INR rates separately."
        : "Cash and recorded PPF balances do not need market quotes.",
      prominent: false,
      title: hasFutures ? "No spot prices needed" : "No market prices needed",
    };
  }

  const prominent = quoteFreshness.missing > 0;
  const title = prominent
    ? "Price coverage needs attention"
    : quoteFreshness.status === "current"
      ? "Prices up to date"
      : quoteFreshness.stale > 0
        ? quoteFreshness.manual > 0
          ? "Using older and manual prices"
          : "Using older saved prices"
        : "Using manual prices";

  return {
    detail: counts,
    prominent,
    title,
  };
}

/**
 * The note under an allocation of priced holdings only (#782): names the one
 * unpriced holding, or counts several, with what was invested in them unless
 * values are masked.
 */
export function formatExcludedHoldingsNote(
  excluded: readonly { name: string; invested: number }[],
  masked: boolean,
) {
  const invested = excluded.reduce((sum, item) => sum + item.invested, 0);
  const subject = excluded.length === 1 ? excluded[0].name : `${excluded.length} holdings`;
  const amount = masked ? "" : ` (${formatCompactINR(invested)} invested)`;
  return `Of priced holdings · excludes ${subject}${amount}`;
}

/** "1 holding needs a price" / "3 holdings need a price". */
export function formatPendingPricesLabel(count: number) {
  return `${count} holding${count === 1 ? " needs" : "s need"} a price`;
}

/**
 * This month's activity in a few words for the Dashboard tile (#782): what was
 * invested and how Cash moved, or "No change".
 */
export function getMonthlyActivitySummary({ cashChange, investment }: { cashChange: number; investment: number }) {
  if (investment === 0 && cashChange === 0) return { cash: null, invested: null };
  return {
    cash: cashChange === 0 ? null : formatSignedCompactINR(cashChange),
    invested: investment === 0 ? null : formatCompactINR(investment),
  };
}
