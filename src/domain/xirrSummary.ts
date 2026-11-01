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
  | { status: "unavailable"; messages: string[]; blockers: XirrBlocker[] };

/**
 * One reason a return is unavailable, with what it applies to. `count` is the
 * number of records for record-level reasons (`unit` says which kind) and of
 * holdings or accounts otherwise. `assetIds` leaves out the portfolio itself.
 */
export type XirrBlocker = {
  reason: XirrUnavailableReason | "calculation";
  message: string;
  unit: "holdings" | "trades" | "cashEntries" | "ppfEntries" | null;
  count: number;
  assetIds: string[];
};

// Reasons raised once per record; the rest are counted by holding or account.
const recordUnits: Partial<Record<XirrUnavailableReason, XirrBlocker["unit"]>> = {
  "trade-funding-unknown": "trades",
  "cash-uncategorized": "cashEntries",
  "ppf-funding-unknown": "ppfEntries",
};
const PORTFOLIO_ID = "portfolio";

const NO_RATE = "A return can't be calculated from these flows.";

// Structural gaps first: fixing a later reason is pointless while an earlier one remains.
const inputMessages: Array<[XirrUnavailableReason, string]> = [
  ["no-measurement-basis", "Save a month-end snapshot in Progress, or set a start date, to measure the return."],
  ["basis-needs-reconfirming", "Records on or before the start date changed. Confirm the opening value again."],
  ["records-before-start", "Records exist before your start date. Use the automatic start, or choose an earlier date."],
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
  ["opening-after-start", "An opening position is dated after the start date. Record it as a purchase."],
  ["cash-uncategorized", "A Cash entry after the start date needs a purpose: deposit or withdrawal."],
  ["trade-funding-unknown", "Link this trade to Cash or mark its funding as external."],
  ["ppf-funding-unknown", "Say whether this PPF deposit came from Cash."],
  ["epf-withdrawal-destination", "Say where an EPF withdrawal went."],
  ["no-assets", "No investments are recorded."],
];

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What each assumption means, by how many records or holdings it covers. Most consequential first. */
const limitationNotes: Record<XirrLimitation, (n: number) => string> = {
  "payouts-not-recorded": (n) => `Dividends aren't recorded for ${count(n, "holding", "holdings")}, so the return may be understated.`,
  "funding-assumed-external": (n) => `${count(n, "trade", "trades")} without a Cash record ${n === 1 ? "is" : "are"} counted as paid from outside CogVest.`,
  "price-missing-at-cost": (n) => `${count(n, "holding has", "holdings have")} no price and ${n === 1 ? "is" : "are"} valued at what was paid.`,
  "stale-price": (n) => `${count(n, "holding uses", "holdings use")} a price older than 7 days.`,
  "cash-purpose-assumed": (n) => `${count(n, "Cash entry", "Cash entries")} without a clear purpose ${n === 1 ? "is" : "are"} counted as money in or out.`,
  "ppf-funding-assumed": (n) => `${count(n, "PPF entry is", "PPF entries are")} counted as paid from outside CogVest.`,
  "epf-withdrawal-assumed": (n) => `${count(n, "EPF withdrawal is", "EPF withdrawals are")} counted as money taken out.`,
  "opening-after-start-at-cost": (n) => `${count(n, "opening position", "opening positions")} after the start ${n === 1 ? "is" : "are"} counted as bought at average cost.`,
  "account-opened-after-start": (n) => `${count(n, "account", "accounts")} opened after the start count their starting balance as money put in.`,
  "basis-records-changed": () => "Records before your start date changed after you confirmed it.",
  "epf-history-incomplete": () => "EPF history isn't confirmed complete, so EPF may be missing contributions.",
  "fees-not-in-source": (n) => `${count(n, "imported trade", "imported trades")} didn't include fees, so they aren't counted.`,
  "manual-price": (n) => `${count(n, "holding uses", "holdings use")} a manually entered price.`,
  "ppf-interest-accrual": () => "PPF uses its confirmed balance, without interest earned since the last credit.",
  "epf-summarised-year": () => "Some EPF contributions come from a yearly passbook summary and are dated at its end.",
};

/** One note per kind of assumption, counting distinct records (or holdings when there is no record). */
function limitationSummary(limitations: Array<{ assetId: string; limitation: XirrLimitation; recordId?: string }>) {
  return (Object.keys(limitationNotes) as XirrLimitation[]).flatMap((kind) => {
    const items = limitations.filter((item) => item.limitation === kind);
    return items.length ? [limitationNotes[kind](new Set(items.map((item) => item.recordId ?? item.assetId)).size)] : [];
  });
}

const solverMessages: Record<XirrUnavailable, string> = {
  "invalid-flow": NO_RATE,
  "single-date": "All activity is on one day, so there is no period to annualise.",
  "no-negative-flow": NO_RATE,
  "no-positive-flow": NO_RATE,
  "no-rate-in-range": NO_RATE,
  "multiple-rates": NO_RATE,
  undetermined: NO_RATE,
};

function noRate(message: string): XirrSummary {
  return { status: "unavailable", messages: [message], blockers: [{ reason: "calculation", message, unit: null, count: 0, assetIds: [] }] };
}

export function summariseXirr(input: XirrInputResult): XirrSummary {
  if (input.status === "unavailable") {
    const blockers = inputMessages.flatMap(([reason, message]): XirrBlocker[] => {
      const issues = input.reasons.filter((item) => item.reason === reason);
      if (!issues.length) return [];
      const assetIds = [...new Set(issues.map((item) => item.assetId))].filter((id) => id !== PORTFOLIO_ID);
      const unit = recordUnits[reason] ?? (assetIds.length ? "holdings" : null);
      const count = recordUnits[reason]
        ? new Set(issues.map((item) => item.recordId ?? item.assetId)).size
        : assetIds.length;
      return [{ reason, message, unit, count, assetIds }];
    });
    return blockers.length ? { status: "unavailable", messages: blockers.map((item) => item.message), blockers } : noRate(NO_RATE);
  }
  // Same-day flows net out before solving, so say why directly rather than "no rate".
  if (new Set(input.flows.map((flow) => flow.date)).size < 2) {
    return noRate(solverMessages["single-date"]);
  }
  const result = calculateXirr(input.flows);
  if (result.status === "unavailable") return noRate(solverMessages[result.reason]);
  const notes = limitationSummary(input.limitations);
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
