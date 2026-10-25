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
}: {
  hasFutures: boolean;
  isRefreshing: boolean;
  quoteFailed: number;
  quoteFreshness: QuoteFreshnessSummary;
  quoteTimedOut: number;
}) {
  const counts = `Current ${quoteFreshness.current} · Stale ${quoteFreshness.stale} · Manual ${quoteFreshness.manual} · Missing ${quoteFreshness.missing}`;

  if (isRefreshing) {
    return {
      detail: counts,
      prominent: false,
      title: "Refreshing quotes...",
    };
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
