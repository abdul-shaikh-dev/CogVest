import { getCalendarDatePart, parseCalendarDate } from "@/src/domain/dates";
import { getOpeningPositionHistoryDate } from "@/src/domain/openingPositions";
import type { Asset, OpeningPosition, Trade } from "@/src/types";

export const INDIA_HOLDING_DURATION_RULE = {
  jurisdiction: "India",
  rulesAsOf: "2026-09-08",
  months: 12,
  sourceUrl: "https://www.incometaxindia.gov.in/en/sale-of-shares",
  sourceTitle: "Income Tax Department: Sale of Shares",
} as const;

export type HoldingDuration =
  | { status: "unavailable"; reason: string }
  | {
      status: "available";
      acquiredOn: string;
      observedOn: string;
      anniversary: string;
      elapsedDays: number;
      beyondReference: boolean;
    };

/** Calendar comparison only; no eligibility, disposal-lot matching or tax result. */
export function getHoldingDuration({
  asset,
  trades,
  openingPositions,
  asOf,
}: {
  asset: Asset;
  trades: Trade[];
  openingPositions: OpeningPosition[];
  asOf: string;
}): HoldingDuration {
  const unavailable = (reason: string): HoldingDuration => ({
    status: "unavailable",
    reason,
  });
  if (!parseCalendarDate(asOf))
    return unavailable("The observation date is unavailable.");
  if (
    asset.currency !== "INR" ||
    !["NSE", "BSE"].includes(asset.exchange ?? "")
  ) {
    return unavailable(
      "An Indian exchange listing and INR records are needed for this reference.",
    );
  }
  // An ETF label or the legacy isTaxEligible flag does not establish fund tax treatment.
  if (asset.assetClass === "etf")
    return unavailable(
      "This ETF's tax category is not confirmed, so no duration comparison is shown.",
    );
  if (asset.assetClass !== "stock" || asset.instrumentType !== "stock") {
    return unavailable(
      "This instrument is outside the supported listed-stock reference.",
    );
  }
  const positions = openingPositions.filter(
    (position) =>
      position.assetId === asset.id &&
      (getOpeningPositionHistoryDate(position) === null ||
        getOpeningPositionHistoryDate(position)! <= asOf),
  );
  const records = trades.filter(
    (trade) =>
      trade.assetId === asset.id &&
      (getCalendarDatePart(trade.date) === null ||
        getCalendarDatePart(trade.date)! <= asOf),
  );
  if (records.some((trade) => getCalendarDatePart(trade.date) === null))
    return unavailable(
      "An acquisition or transaction date is missing or invalid.",
    );
  if (positions.some((position) => position.measuredAsOf !== undefined)) {
    return unavailable(
      "An aggregate opening balance may combine acquisition dates. Lot-level history is needed before comparing duration.",
    );
  }
  if (records.some((trade) => trade.type !== "buy")) {
    return unavailable(
      "Sales or transfers make the remaining acquisition history uncertain. Lot matching is not included in this view.",
    );
  }
  if (positions.length + records.length !== 1) {
    return unavailable(
      "A single known acquisition is needed. Multiple acquisitions are not combined into one holding date.",
    );
  }
  const acquiredOn = getCalendarDatePart(
    positions[0]?.date ?? records[0]?.date ?? "",
  );
  if (!acquiredOn || acquiredOn > asOf)
    return unavailable(
      "The acquisition date is missing or is after the observation date.",
    );
  const parsed = parseCalendarDate(acquiredOn)!;
  const anniversaryMonthIndex =
    parsed.month - 1 + INDIA_HOLDING_DURATION_RULE.months;
  const anniversaryYear = parsed.year + Math.floor(anniversaryMonthIndex / 12);
  const anniversaryMonth = (anniversaryMonthIndex % 12) + 1;
  // Clamp leap-day anniversaries to the final day of February, never add 365 days.
  const anniversaryDay = Math.min(
    parsed.day,
    new Date(Date.UTC(anniversaryYear, anniversaryMonth, 0)).getUTCDate(),
  );
  const anniversary = `${anniversaryYear}-${String(anniversaryMonth).padStart(2, "0")}-${String(anniversaryDay).padStart(2, "0")}`;
  return {
    status: "available",
    acquiredOn,
    observedOn: asOf,
    anniversary,
    elapsedDays: Math.round(
      (Date.parse(asOf) - Date.parse(acquiredOn)) / 86400000,
    ),
    beyondReference: asOf > anniversary,
  };
}
