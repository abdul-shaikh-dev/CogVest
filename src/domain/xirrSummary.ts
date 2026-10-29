import { calculateXirr, type XirrUnavailable } from "./xirr";
import type { XirrFlow, XirrInputResult, XirrLimitation, XirrUnavailableReason } from "./xirrInputs";

/**
 * Presentation-ready XIRR: either a rate with its period and the flows behind
 * it, or the user-facing reasons it can't be shown. Derived on demand; never
 * stored (#535, docs/design/xirr-evidence-contract.md).
 */
export type XirrSummary =
  | {
    status: "rate";
    /** Annual rate as a fraction: 0.1 is 10%. */
    rate: number;
    startDate: string;
    endDate: string;
    days: number;
    shortPeriod: boolean;
    valueAsOf: string | null;
    flows: XirrFlow[];
    notes: string[];
  }
  | { status: "unavailable"; messages: string[] };

const NO_RATE = "A return can't be calculated from these flows.";

// Structural gaps first: fixing a later reason is pointless while an earlier one remains.
const inputMessages: Array<[XirrUnavailableReason, string]> = [
  ["missing-asset", "This holding's record is missing."],
  ["cash-asset", "Cash has no return of its own."],
  ["foreign-currency", "Returns are only measured for INR holdings."],
  ["invalid-end-date", "The measurement date isn't valid."],
  ["opening-history", "Purchase history before the opening position isn't recorded."],
  ["transfer-without-value", "A transfer in needs its value on the transfer date."],
  ["demerger", "Measured together with its demerger successor, not on its own."],
  ["split-needs-review", "A split or bonus needs review before returns can be measured."],
  ["invalid-trade", "A transaction has an invalid date or amount."],
  ["duplicate-trade", "A transaction is recorded twice."],
  ["units-mismatch", "Sold units exceed the units held at that time."],
  ["no-purchases", "No purchases are recorded."],
  ["payout-before-purchase", "A payout is dated before the first purchase."],
  ["distributions-not-recorded", "Dividends or payouts aren't recorded for this period."],
  ["missing-quote", "No current price is available."],
  ["quote-currency", "The current price isn't in INR."],
  ["quote-after-end", "The current price is dated after the measurement date."],
  ["stale-quote", "Price is older than 7 days."],
  ["account-history-after-start", "An account's history before its starting balance isn't recorded."],
  ["ppf-reconciliation", "A PPF balance correction isn't explained by recorded deposits or interest."],
  ["epf-ledger-invalid", "EPF records need review before returns can be measured."],
  ["epf-history-incomplete", "EPF history isn't confirmed complete up to today."],
  ["epf-reconciliation", "An EPF balance update isn't explained by recorded contributions."],
  ["futures-not-valued", "Futures needs a reconciled wallet valuation."],
  ["futures-stale-valuation", "The Futures valuation is older than 7 days."],
  ["futures-rates-missing", "A Futures transfer needs its INR rate on the transfer date."],
  ["no-assets", "No investments are recorded."],
];

const limitationNotes: Record<XirrLimitation, string> = {
  "fees-not-in-source": "Some imported trades didn't include fees, so they aren't counted.",
  "manual-price": "Uses a manually entered price.",
  "ppf-interest-accrual": "PPF uses its confirmed balance, without interest earned since the last credit.",
  "epf-summarised-year": "Some EPF contributions come from a yearly passbook summary and are dated at its end.",
};

const solverMessages: Record<XirrUnavailable, string> = {
  "invalid-flow": NO_RATE,
  "single-date": "All activity is on one day, so there is no period to annualise.",
  "no-negative-flow": NO_RATE,
  "no-positive-flow": NO_RATE,
  "no-rate-in-range": NO_RATE,
  "multiple-rates": NO_RATE,
  undetermined: NO_RATE,
};

export function summariseXirr(input: XirrInputResult): XirrSummary {
  if (input.status === "unavailable") {
    const present = new Set(input.reasons.map((item) => item.reason));
    const messages = inputMessages.filter(([reason]) => present.has(reason)).map(([, message]) => message);
    return { status: "unavailable", messages: messages.length ? messages : [NO_RATE] };
  }
  // Same-day flows net out before solving, so say why directly rather than "no rate".
  if (new Set(input.flows.map((flow) => flow.date)).size < 2) {
    return { status: "unavailable", messages: [solverMessages["single-date"]] };
  }
  const result = calculateXirr(input.flows);
  if (result.status === "unavailable") return { status: "unavailable", messages: [solverMessages[result.reason]] };
  const notes = [...new Set(input.limitations.map((item) => limitationNotes[item.limitation]))];
  return {
    status: "rate",
    rate: result.rate,
    startDate: result.startDate,
    endDate: result.endDate,
    days: result.days,
    shortPeriod: result.shortPeriod,
    valueAsOf: input.valueAsOf,
    flows: input.flows,
    notes,
  };
}
