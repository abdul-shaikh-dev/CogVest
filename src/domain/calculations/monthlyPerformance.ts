import type {
  CashEntry,
  MonthlyPerformanceBasis,
  MonthlySnapshot,
  OpeningPosition,
} from "@/src/types";

export type MonthlyPerformanceUnavailableReason =
  | "ambiguous-cash-flow"
  | "invalid-denominator"
  | "legacy-snapshot"
  | "manual-snapshot"
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
  amount: number;
  date: string;
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;

  return Math.round((value + Number.EPSILON) * factor) / factor;
}

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

  return (daysInMonth - date.getUTCDate() + 1) / daysInMonth;
}

function classifyCashEntry(entry: CashEntry): ExternalFlow | "ambiguous" | null {
  if (
    entry.type === "addition" &&
    (entry.purpose === "capitalContribution" || entry.purpose === "income")
  ) {
    return { amount: entry.amount, date: entry.date };
  }

  if (entry.type === "withdrawal" && entry.purpose === "withdrawal") {
    return { amount: -entry.amount, date: entry.date };
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
  targetMonth,
}: {
  cashEntries: CashEntry[];
  openingPositions: OpeningPosition[];
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

  for (const position of openingPositions.filter((item) =>
    isWithinMonth(item.date, targetMonth),
  )) {
    externalFlows.push({
      amount: position.quantity * position.averageCostPrice,
      date: position.date,
    });
  }

  return {
    netExternalFlow: round(
      externalFlows.reduce((total, flow) => total + flow.amount, 0),
    ),
    status: "complete",
    warnings: [],
    weightedExternalFlow: round(
      externalFlows.reduce(
        (total, flow) =>
          total + flow.amount * flowWeight(flow.date, targetMonth),
        0,
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

  const totalValueChange = round(
    snapshot.portfolioValue - previousSnapshot.portfolioValue,
  );
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

  const marketMovement = round(totalValueChange - basis.netExternalFlow);
  const denominator = round(
    previousSnapshot.portfolioValue + basis.weightedExternalFlow,
  );

  return {
    denominator,
    marketMovement,
    marketMovementPct:
      denominator > 0 ? round((marketMovement / denominator) * 100) : null,
    netExternalFlow: basis.netExternalFlow,
    reason: denominator > 0 ? null : "invalid-denominator",
    status: denominator > 0 ? "available" : "partial",
    totalValueChange,
  };
}
