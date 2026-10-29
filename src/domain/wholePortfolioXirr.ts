import { calculateCashBalance, calculateHoldings } from "./calculations/holdings";
import { calendarDateToLocalDate, getCalendarDatePart, parseCalendarDate } from "./dates";
import { distributionNetAmount } from "./distributions";
import { decimal, sumFinancialValues } from "./precision";
import { epfXirrFlows, futuresXirrFlows, ppfXirrFlows, type AccountXirrOutcome } from "./xirrAccountFlows";
import {
  compareFlows, terminalQuoteIssue, tradeFlow,
  type InvestmentsXirrInput, type XirrAssetIssue, type XirrFlow, type XirrInputResult, type XirrLimitation,
} from "./xirrInputs";
import type { MeasurementBasis } from "@/src/types";

/**
 * Whole-portfolio XIRR input (D9-D11 in docs/design/xirr-evidence-contract.md):
 * everything CogVest tracks, Cash included, measured from the user's
 * measurement basis. Only money crossing the portfolio's edge is a flow: Cash
 * deposits and withdrawals, payouts paid outside, trades and PPF entries paid
 * from outside, EPF contributions not paid from Cash, and external Futures
 * transfers. Anything linked to Cash moved inside the portfolio and is skipped.
 */
export type WholePortfolioReason =
  | "no-measurement-basis" | "basis-needs-reconfirming" | "records-before-start" | "opening-after-start"
  | "cash-uncategorized" | "trade-funding-unknown" | "ppf-funding-unknown" | "epf-withdrawal-destination";

export type WholePortfolioXirrInput = InvestmentsXirrInput & {
  basis: MeasurementBasis | null;
  /** Every stored record, for the fingerprint, when the flows above leave some out. Defaults to the input itself. */
  evidence?: DigestRecords;
};

export type DigestRecords = Pick<InvestmentsXirrInput,
  "trades" | "openingPositions" | "cashEntries" | "ppfAccounts" | "ppfLedgerEntries" | "epf" | "futuresAccounts" | "distributions">;

type DatedRecord = { key: string; date: string | null; record: unknown; holdsValue: boolean };

/** Every record with the date it takes effect. A null date is before any start. */
function datedRecords(input: DigestRecords): DatedRecord[] {
  const day = (value: string) => getCalendarDatePart(value) ?? value;
  return [
    ...input.trades.map((item) => ({ key: `trade:${item.id}`, date: day(item.date), record: item, holdsValue: true })),
    ...input.openingPositions.map((item) => ({ key: `opening:${item.id}`, date: item.date === null ? null : day(item.date), record: item, holdsValue: true })),
    ...input.cashEntries.map((item) => ({ key: `cash:${item.id}`, date: day(item.date), record: item, holdsValue: true })),
    ...input.ppfAccounts.map((item) => ({ key: `ppf:${item.id}`, date: item.balanceAsOf, record: item, holdsValue: item.confirmedBalance > 0 })),
    ...input.ppfLedgerEntries.map((item) => ({ key: `ppf-entry:${item.id}`, date: item.date, record: item, holdsValue: true })),
    ...input.epf.accounts.map((item) => ({ key: `epf:${item.id}`, date: item.checkpoint.date, record: item, holdsValue: item.checkpoint.balance.total > 0 })),
    ...input.epf.events.map((item) => ({ key: `epf-event:${item.id}`, date: item.effectiveDate, record: item, holdsValue: true })),
    ...input.futuresAccounts.flatMap((account) => [
      { key: `futures:${account.id}`, date: day(account.openingAt),
        record: { openingAt: account.openingAt, openingWalletUsdt: account.openingWalletUsdt, openingRate: account.openingRate },
        holdsValue: !decimal(account.openingWalletUsdt).isZero() },
      ...account.events.map((event) => ({ key: `futures-event:${account.id}:${event.id}`, date: day(event.at), record: event, holdsValue: true })),
    ]),
    ...input.distributions.map((item) => ({ key: `payout:${item.id}`, date: item.paidOn, record: item, holdsValue: true })),
  ];
}

/** JSON with sorted keys, so a restored backup with reordered fields keeps its fingerprint. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort()
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fnv1a(text: string, seed: number) {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Fingerprint of every record dated on or before the start date: the evidence
 * an opening value stands on. Editing, adding or deleting any of them changes
 * it, so the opening value must be confirmed again (D9).
 */
export function measurementEvidenceDigest(input: DigestRecords, startDate: string) {
  const text = datedRecords(input)
    .filter((item) => item.date === null || item.date <= startDate)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((item) => `${item.key}=${canonical(item.record)}`)
    .join("\n");
  return `${fnv1a(text, 0x811c9dc5)}${fnv1a(text, 0x050c5d1f)}`;
}

/** Problems with a basis as entered; empty when it can be saved. */
export function measurementBasisProblems(basis: Pick<MeasurementBasis, "startDate" | "kind" | "openingBreakdown">, today: string) {
  const problems: string[] = [];
  if (basis.startDate.length !== 10 || !parseCalendarDate(basis.startDate)) problems.push("Start date is not a valid date.");
  else if (basis.startDate > today) problems.push("Start date can't be in the future.");
  if (basis.kind === "inception" && basis.openingBreakdown.length) problems.push("A lifetime start has no opening value.");
  if (basis.kind === "openingValue") {
    if (!basis.openingBreakdown.length) problems.push("Add at least one opening value.");
    if (basis.openingBreakdown.length > 100) problems.push("Use at most 100 opening values.");
    for (const line of basis.openingBreakdown) {
      if (!line.label.trim()) problems.push("Each opening value needs a name.");
      if (!Number.isFinite(line.valueInr) || line.valueInr < 0 || !decimal(line.valueInr).equals(decimal(line.valueInr).toDecimalPlaces(2))) {
        problems.push("Opening values must be zero or more, to the paisa.");
      }
    }
  }
  return [...new Set(problems)];
}

export function buildWholePortfolioXirrInput(input: WholePortfolioXirrInput): XirrInputResult {
  const portfolio = "portfolio";
  const basis = input.basis;
  if (!basis) return { status: "unavailable", reasons: [{ assetId: portfolio, reason: "no-measurement-basis" }] };
  if (input.endDate.length !== 10 || !parseCalendarDate(input.endDate)) {
    return { status: "unavailable", reasons: [{ assetId: portfolio, reason: "invalid-end-date" }] };
  }
  const start = basis.startDate;
  const end = input.endDate;
  const inception = basis.kind === "inception";
  // A lifetime period counts activity on the start date; an opening value already includes it.
  const inWindow = (date: string | null) => date !== null && (inception ? date >= start : date > start) && date <= end;
  const reasons: XirrAssetIssue[] = [];
  const issue = (assetId: string, reason: XirrAssetIssue["reason"], recordId?: string) =>
    reasons.push({ assetId, reason, ...(recordId ? { recordId } : {}) });
  const limitations: Array<{ assetId: string; limitation: XirrLimitation; recordId?: string }> = [];
  const flows: XirrFlow[] = [];
  const records = datedRecords(input);
  // Account problems name the PPF entry, EPF event or Futures event behind them.
  const recordDates = new Map<string, string>([
    ...input.ppfLedgerEntries.map((entry) => [entry.id, entry.date] as const),
    ...input.epf.events.map((event) => [event.id, event.effectiveDate] as const),
    ...input.futuresAccounts.flatMap((account) => account.events.map((event) => [event.id, event.at.slice(0, 10)] as const)),
  ]);

  if (inception) {
    if (records.some((item) => item.holdsValue && (item.date === null || item.date < start))) issue(portfolio, "records-before-start");
  } else if (basis.evidenceDigest !== measurementEvidenceDigest(input.evidence ?? input, start)) {
    issue(portfolio, "basis-needs-reconfirming");
  }
  if (!inception && basis.openingValueInr !== null && basis.openingValueInr > 0) {
    flows.push({ date: start, amountInr: decimal(basis.openingValueInr).negated().toString(), source: "opening", id: portfolio });
  }

  // Cash: deposits in, withdrawals out. Linked legs moved money inside the portfolio.
  for (const cash of input.cashEntries) {
    const date = getCalendarDatePart(cash.date);
    if (!inWindow(date)) continue;
    if (cash.purpose === "capitalContribution" && cash.type === "addition") {
      flows.push({ date: date!, amountInr: decimal(cash.amount).negated().toString(), source: "cash", id: cash.id });
    } else if (cash.purpose === "withdrawal" && cash.type === "withdrawal") {
      flows.push({ date: date!, amountInr: decimal(cash.amount).toString(), source: "cash", id: cash.id });
    } else if (cash.purpose === "legacyUncategorized" ||
      ((cash.purpose === "purchaseFunding" || cash.purpose === "saleProceeds") && !cash.linkedTradeId)) {
      issue("cash", "cash-uncategorized", cash.id);
    }
  }

  // Trades: only those paid from, or into, money outside CogVest Cash.
  const cashLinkedTrades = new Set(input.cashEntries.map((cash) => cash.linkedTradeId).filter(Boolean));
  const reinvestedBuys = new Set(input.distributions.filter((item) => item.treatment === "reinvested").map((item) => item.linkedTradeId));
  const tradeCounts = new Map<string, number>();
  input.trades.forEach((trade) => tradeCounts.set(trade.id, (tradeCounts.get(trade.id) ?? 0) + 1));
  for (const trade of input.trades) {
    const date = getCalendarDatePart(trade.date);
    if (!date) issue(trade.assetId, "invalid-trade", trade.id);
    if (!inWindow(date)) continue;
    if ((tradeCounts.get(trade.id) ?? 0) > 1) issue(trade.assetId, "duplicate-trade", trade.id);
    else if (trade.type === "transferIn" || trade.type === "transferOut") issue(trade.assetId, "transfer-without-value", trade.id);
    else if (!Number.isFinite(trade.totalValue) || trade.totalValue <= 0) issue(trade.assetId, "invalid-trade", trade.id);
    else if (cashLinkedTrades.has(trade.id) || reinvestedBuys.has(trade.id)) continue;
    else if (trade.fundingSource !== "external") issue(trade.assetId, "trade-funding-unknown", trade.id);
    else {
      const provenance = trade.importProvenance;
      if (provenance && provenance.fees === undefined && provenance.taxes === undefined) {
        limitations.push({ assetId: trade.assetId, limitation: "fees-not-in-source", recordId: trade.id });
      }
      flows.push({ date: date!, amountInr: tradeFlow(trade).toString(), source: "trade", id: trade.id });
    }
  }
  for (const opening of input.openingPositions) {
    const date = opening.date === null ? null : getCalendarDatePart(opening.date);
    if (date !== null && (inception ? date >= start : date > start)) issue(opening.assetId, "opening-after-start", opening.id);
  }

  // Payouts: only those paid outside leave the portfolio. Reinvested and Cash payouts stay inside.
  for (const payout of input.distributions) {
    if (inWindow(payout.paidOn) && payout.treatment === "paidOutside") {
      flows.push({ date: payout.paidOn, amountInr: distributionNetAmount(payout).toString(), source: "distribution", id: payout.id });
    }
  }

  // Market holdings at the end date, valued as the Dashboard values them.
  const holdings = calculateHoldings({
    assets: [...input.assets], openingPositions: [...input.openingPositions], quoteCache: { ...input.quotes },
    trades: input.trades.filter((trade) => (getCalendarDatePart(trade.date) ?? "") <= end), now: calendarDateToLocalDate(end) ?? new Date(end),
  });
  const terminals: string[] = [];
  const valueDates: string[] = [];
  for (const holding of holdings) {
    const asset = holding.asset;
    if (asset.currency !== "INR") {
      issue(asset.id, "foreign-currency");
      continue;
    }
    const quote = input.quotes[asset.id];
    const quoteIssue = terminalQuoteIssue(quote, end);
    if (quoteIssue || !quote) {
      issue(asset.id, quoteIssue ?? "missing-quote");
      continue;
    }
    if (quote.source === "manual") limitations.push({ assetId: asset.id, limitation: "manual-price" });
    terminals.push(decimal(holding.calculationBasis?.totalUnits ?? holding.totalUnits).times(quote.price).toString());
    valueDates.push(getCalendarDatePart(quote.asOf)!);
  }
  // Every asset that can pay out and was held in the period needs payouts recorded from then on.
  const heldAtEnd = new Set(holdings.map((holding) => holding.asset.id));
  for (const asset of input.assets) {
    if (asset.assetClass === "crypto" || asset.assetClass === "cash") continue;
    const tradeDates = input.trades.filter((trade) => trade.assetId === asset.id)
      .map((trade) => getCalendarDatePart(trade.date)).filter((date): date is string => Boolean(date));
    if (!heldAtEnd.has(asset.id) && !tradeDates.some(inWindow)) continue;
    const openings = input.openingPositions.filter((item) => item.assetId === asset.id);
    const earliest = openings.some((item) => item.date === null) ? null
      : [...tradeDates, ...openings.map((item) => getCalendarDatePart(item.date!) ?? start)].sort()[0] ?? null;
    const required = earliest === null || earliest < start ? start : earliest;
    const coverage = input.distributionCoverage.find((item) => item.assetId === asset.id);
    if (!coverage || coverage.from > required) issue(asset.id, "distributions-not-recorded");
  }

  // Accounts: their own flows, reclassified by where the money came from or went.
  const ppfEntries = new Map(input.ppfLedgerEntries.map((entry) => [entry.id, entry]));
  const epfEvents = new Map(input.epf.events.map((event) => [event.id, event]));
  const cashLinkedEpf = new Set(input.cashEntries.map((cash) => cash.linkedEpf?.eventId).filter(Boolean));
  const futuresInternal = new Set(input.futuresAccounts.flatMap((account) => account.events
    .filter((event) => event.type === "transfer" && event.transferBoundary === "internal").map((event) => event.id)));
  const accounts: AccountXirrOutcome[] = [
    ppfXirrFlows(input.ppfAccounts, input.ppfLedgerEntries, end),
    epfXirrFlows(input.epf, end, input.today),
    futuresXirrFlows(input.futuresAccounts, input.cashEntries, end, input.valuationTime),
  ];
  for (const account of accounts) {
    // A problem tied to a record before the period is covered by the opening value.
    for (const item of account.reasons) {
      if (!item.recordId || inWindow(recordDates.get(item.recordId) ?? null)) reasons.push(item);
    }
    for (const item of account.limitations) {
      if (!item.recordId || inWindow(recordDates.get(item.recordId) ?? null)) limitations.push(item);
    }
    for (const flow of account.flows) {
      if (flow.opening) {
        if (flow.date > start) issue(flow.id, "account-history-after-start");
        else if (inception && flow.date === start) flows.push({ date: flow.date, amountInr: flow.amountInr, source: "account", id: flow.id });
        continue;
      }
      if (!inWindow(flow.date)) continue;
      const ppf = ppfEntries.get(flow.id);
      const epf = epfEvents.get(flow.id);
      if (ppf && (ppf.type === "contribution" || ppf.type === "withdrawal")) {
        if (ppf.fundingSource === "cash") continue;
        if (ppf.fundingSource !== "external") {
          issue(`ppf:${ppf.accountId}`, "ppf-funding-unknown", ppf.id);
          continue;
        }
      } else if (epf) {
        const original = epf.type === "reversal" ? epfEvents.get(epf.reversesId) : undefined;
        if (cashLinkedEpf.has(epf.id) || (original && cashLinkedEpf.has(original.id))) continue;
        if (epf.type === "withdrawal" && epf.destination === "unknown") {
          issue(`epf:${epf.accountId}`, "epf-withdrawal-destination", epf.id);
          continue;
        }
      } else if (futuresInternal.has(flow.id)) {
        continue;
      }
      flows.push({ date: flow.date, amountInr: flow.amountInr, source: "account", id: flow.id });
    }
    for (const terminal of account.terminals) {
      terminals.push(terminal.amountInr);
      valueDates.push(terminal.valueAsOf);
    }
  }

  const cashBalance = calculateCashBalance([...input.cashEntries], calendarDateToLocalDate(end) ?? new Date(end));
  if (cashBalance !== 0) terminals.push(decimal(cashBalance).toString());

  if (!reasons.length && !flows.length) issue(portfolio, "no-purchases");
  if (reasons.length) return { status: "unavailable", reasons };

  flows.sort(compareFlows);
  const terminalValue = sumFinancialValues(terminals);
  const allFlows = terminalValue.isZero() ? flows
    : [...flows, { date: end, amountInr: terminalValue.toString(), source: "terminal" as const, id: portfolio }];
  return {
    status: "ready",
    flows: allFlows,
    startDate: inception ? flows[0].date : start,
    endDate: end,
    valueAsOf: valueDates.length ? valueDates.sort()[0] : null,
    limitations,
    includedAssetIds: [...holdings.map((holding) => holding.asset.id), "cash",
      ...input.ppfAccounts.map((account) => `ppf:${account.id}`), ...input.epf.accounts.map((account) => `epf:${account.id}`),
      ...input.futuresAccounts.map((account) => `futures:${account.id}`)],
  };
}
