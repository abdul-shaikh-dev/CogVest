import type {
  CashEntry,
  MonthlyPerformanceBasis,
  MonthlySnapshot,
  OpeningPosition,
  PpfLedgerEntry,
} from "@/src/types";
import {
  decimal,
  type FinancialDecimalInstance,
  normalizeMoney,
  normalizePercentage,
  sumFinancialValues,
} from "@/src/domain/precision";
import { getOpeningPositionHistoryDate } from "@/src/domain/openingPositions";

export type MonthlyPerformanceUnavailableReason =
  | "ambiguous-cash-flow"
  | "invalid-denominator"
  | "legacy-snapshot"
  | "manual-snapshot"
  | "ppf-reconciliation"
  | "unknown-opening-position-date"
  | "missing-previous-snapshot";

export type MonthlyPerformanceResult = {
  denominator: number | null;
  marketMovement: number | null;
  marketMovementPct: number | null;
  netExternalFlow: number | null;
  reason: MonthlyPerformanceUnavailableReason | null;
  status: "available" | "partial" | "unavailable";
  totalValueChange: number | null;
};

type ExternalFlow = {
  amount: FinancialDecimalInstance;
  date: string;
};

function utcMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

function isWithinMonth(isoDate: string, targetMonth: string) {
  return utcMonthKey(new Date(isoDate)) === targetMonth;
}

function flowWeight(isoDate: string, targetMonth: string) {
  const date = new Date(isoDate);
  const [yearValue, monthValue] = targetMonth.split("-");
  const daysInMonth = new Date(
    Date.UTC(Number(yearValue), Number(monthValue), 0),
  ).getUTCDate();

  return decimal(daysInMonth - date.getUTCDate() + 1).dividedBy(daysInMonth);
}

function classifyCashEntry(entry: CashEntry): ExternalFlow | "ambiguous" | null {
  if (
    entry.type === "addition" &&
    (entry.purpose === "capitalContribution" || entry.purpose === "income")
  ) {
    return { amount: decimal(entry.amount), date: entry.date };
  }

  if (entry.type === "withdrawal" && entry.purpose === "withdrawal") {
    return { amount: decimal(entry.amount).negated(), date: entry.date };
  }

  if (
    (entry.type === "withdrawal" && entry.purpose === "purchaseFunding") ||
    (entry.type === "addition" && entry.purpose === "saleProceeds")
  ) {
    return null;
  }

  return "ambiguous";
}

export function buildMonthlyPerformanceBasis({
  cashEntries,
  openingPositions,
  ppfLedgerEntries = [],
  targetMonth,
}: {
  cashEntries: CashEntry[];
  openingPositions: OpeningPosition[];
  ppfLedgerEntries?: PpfLedgerEntry[];
  targetMonth: string;
}): MonthlyPerformanceBasis {
  const externalFlows: ExternalFlow[] = [];
  let hasAmbiguousCashFlow = false;

  for (const entry of cashEntries.filter((item) =>
    isWithinMonth(item.date, targetMonth),
  )) {
    const classified = classifyCashEntry(entry);

    if (classified === "ambiguous") {
      hasAmbiguousCashFlow = true;
    } else if (classified) {
      externalFlows.push(classified);
    }
  }

  if (hasAmbiguousCashFlow) {
    return {
      reason: "ambiguous-cash-flow",
      status: "unavailable",
      warnings: [
        "Monthly performance is unavailable because at least one cash flow has unknown semantics.",
      ],
    };
  }

  const monthPpfEntries = ppfLedgerEntries.filter((entry) =>
    isWithinMonth(entry.date, targetMonth),
  );
  if (monthPpfEntries.some((entry) => entry.type === "reconciliation")) {
    return {
      reason: "ppf-reconciliation",
      status: "unavailable",
      warnings: [
        "Monthly performance is unavailable because a PPF balance was reconciled during this month.",
      ],
    };
  }

  for (const entry of monthPpfEntries) {
    if (entry.type === "contribution" || entry.type === "withdrawal") {
      externalFlows.push({
        amount:
          entry.type === "contribution"
            ? decimal(entry.amount)
            : decimal(entry.amount).negated(),
        date: entry.date,
      });
    }
  }

  const unknownDatePositionRecordedThisMonth = openingPositions.some(
    (position) =>
      position.date === null &&
      !position.measuredAsOf &&
      getOpeningPositionHistoryDate(position)?.slice(0, 7) === targetMonth,
  );

  if (unknownDatePositionRecordedThisMonth) {
    return {
      reason: "unknown-opening-position-date",
      status: "unavailable",
      warnings: [
        "Monthly performance is unavailable because an opening position has an unknown first-purchase date.",
      ],
    };
  }

  for (const position of openingPositions) {
    const effectiveDate = getOpeningPositionHistoryDate(position);
    if (!effectiveDate || !isWithinMonth(effectiveDate, targetMonth)) continue;
    externalFlows.push({
      amount: decimal(position.quantity).times(position.averageCostPrice),
      date: effectiveDate,
    });
  }

  return {
    netExternalFlow: normalizeMoney(
      sumFinancialValues(externalFlows.map((flow) => flow.amount)),
    ),
    status: "complete",
    warnings: [],
    weightedExternalFlow: normalizeMoney(
      externalFlows.reduce(
        (total, flow) =>
          total.plus(
            flow.amount.times(flowWeight(flow.date, targetMonth)),
          ),
        decimal(0),
      ),
    ),
  };
}

export function calculateMonthlyPerformance(
  previousSnapshot: MonthlySnapshot | undefined,
  snapshot: MonthlySnapshot,
): MonthlyPerformanceResult {
  if (!previousSnapshot) {
    return {
      denominator: null,
      marketMovement: null,
      marketMovementPct: null,
      netExternalFlow: null,
      reason: "missing-previous-snapshot",
      status: "unavailable",
      totalValueChange: null,
    };
  }

  const totalValueChangeDecimal = decimal(snapshot.portfolioValue).minus(
    previousSnapshot.portfolioValue,
  );
  const totalValueChange = normalizeMoney(totalValueChangeDecimal);
  const basis = snapshot.performanceBasis;

  if (!basis) {
    return {
      denominator: null,
      marketMovement: null,
      marketMovementPct: null,
      netExternalFlow: null,
      reason: "legacy-snapshot",
      status: "unavailable",
      totalValueChange,
    };
  }

  if (basis.status === "unavailable") {
    return {
      denominator: null,
      marketMovement: null,
      marketMovementPct: null,
      netExternalFlow: null,
      reason: basis.reason,
      status: "unavailable",
      totalValueChange,
    };
  }

  const marketMovementDecimal = totalValueChangeDecimal.minus(
    basis.netExternalFlow,
  );
  const denominatorDecimal = decimal(previousSnapshot.portfolioValue).plus(
    basis.weightedExternalFlow,
  );
  const marketMovement = normalizeMoney(marketMovementDecimal);
  const denominator = normalizeMoney(denominatorDecimal);
  const hasValidDenominator = denominatorDecimal.greaterThan(0);

  return {
    denominator,
    marketMovement,
    marketMovementPct:
      hasValidDenominator
        ? normalizePercentage(
            marketMovementDecimal.dividedBy(denominatorDecimal).times(100),
          )
        : null,
    netExternalFlow: basis.netExternalFlow,
    reason: hasValidDenominator ? null : "invalid-denominator",
    status: hasValidDenominator ? "available" : "partial",
    totalValueChange,
  };
}
