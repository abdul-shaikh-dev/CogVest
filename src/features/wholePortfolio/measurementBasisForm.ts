import { formatLocalCalendarDate, getCalendarDatePart } from "@/src/domain/dates";
import { decimal } from "@/src/domain/precision";
import { measurementEvidenceDigest } from "@/src/domain/wholePortfolioXirr";
import type { MeasurementBasisInput, PortfolioStoreState } from "@/src/store";
import type { MeasurementBasis } from "@/src/types";

type BasisState = Pick<PortfolioStoreState, "cashEntries" | "distributions" | "epf" | "futuresAccounts" | "measurementBasis"
  | "openingPositions" | "ppfAccounts" | "ppfLedgerEntries" | "trades">;

export type BasisLineDraft = { key: string; label: string; value: string };
export type BasisDraft = { kind: MeasurementBasis["kind"]; startDate: string; lines: BasisLineDraft[] };

export const basisKindOptions = [
  { label: "Since I started", value: "inception" },
  { label: "From a date, with its value", value: "openingValue" },
] as const;

/** The earliest date any record holds value, which is where a lifetime start belongs. */
export function earliestRecordDate(state: BasisState) {
  const dates = [
    ...state.trades.map((item) => item.date),
    ...state.cashEntries.map((item) => item.date),
    ...state.openingPositions.flatMap((item) => (item.date ? [item.date] : [])),
    ...state.ppfAccounts.filter((item) => item.confirmedBalance > 0).map((item) => item.balanceAsOf),
    ...state.ppfLedgerEntries.map((item) => item.date),
    ...state.epf.accounts.filter((item) => item.checkpoint.balance.total > 0).map((item) => item.checkpoint.date),
    ...state.epf.events.map((item) => item.effectiveDate),
    ...state.futuresAccounts.map((item) => item.openingAt),
    ...state.distributions.map((item) => item.paidOn),
  ].map((value) => getCalendarDatePart(value)).filter((value): value is string => Boolean(value));
  return dates.sort()[0] ?? null;
}

export function initialBasisDraft(state: BasisState, now: Date): BasisDraft {
  const basis = state.measurementBasis;
  if (basis) {
    return {
      kind: basis.kind,
      startDate: basis.startDate,
      lines: basis.openingBreakdown.length
        ? basis.openingBreakdown.map((line, index) => ({ key: `line-${index}`, label: line.label, value: String(line.valueInr) }))
        : [{ key: "line-0", label: "", value: "" }],
    };
  }
  return { kind: "inception", startDate: earliestRecordDate(state) ?? formatLocalCalendarDate(now), lines: [{ key: "line-0", label: "", value: "" }] };
}

function parseAmount(value: string) {
  const cleaned = value.replace(/[,\s₹]/g, "");
  return /^\d+(\.\d{1,2})?$/.test(cleaned) ? Number(cleaned) : null;
}

/** Sum of the opening lines, or null while any value is missing or invalid. */
export function draftTotal(draft: BasisDraft) {
  const values = draft.lines.map((line) => parseAmount(line.value));
  return values.every((value): value is number => value !== null)
    ? values.reduce((sum, value) => sum.plus(value), decimal(0)).toNumber() : null;
}

export function buildBasisInput(draft: BasisDraft): { ok: true; input: MeasurementBasisInput } | { ok: false; error: string } {
  if (draft.kind === "inception") return { ok: true, input: { kind: "inception", startDate: draft.startDate, openingBreakdown: [] } };
  const lines = draft.lines.filter((line) => line.label.trim() || line.value.trim());
  if (!lines.length) return { ok: false, error: "Add the value of each account or holding at the end of the start date." };
  const openingBreakdown = [];
  for (const line of lines) {
    const valueInr = parseAmount(line.value);
    if (!line.label.trim()) return { ok: false, error: "Name each opening value, for example Holdings or Cash." };
    if (valueInr === null) return { ok: false, error: `Enter ${line.label.trim()} in rupees, up to two decimals.` };
    openingBreakdown.push({ label: line.label.trim(), valueInr });
  }
  return { ok: true, input: { kind: "openingValue", startDate: draft.startDate, openingBreakdown } };
}

/** Whether the saved basis still stands on the records it was confirmed against. */
export function basisStatus(state: BasisState): "none" | "current" | "needsConfirming" {
  const basis = state.measurementBasis;
  if (!basis) return "none";
  if (basis.kind === "openingValue" && basis.evidenceDigest !== measurementEvidenceDigest(state, basis.startDate)) return "needsConfirming";
  return "current";
}

/** Purchases and sales in the period with no Cash leg, split by whether they're marked as paid from outside. */
export function tradesWithoutCash(state: BasisState, startDate: string, kind: MeasurementBasis["kind"]) {
  const linked = new Set(state.cashEntries.map((cash) => cash.linkedTradeId).filter(Boolean));
  const reinvested = new Set(state.distributions.map((item) => item.linkedTradeId).filter(Boolean));
  const inPeriod = state.trades.filter((trade) => {
    const date = getCalendarDatePart(trade.date);
    return (trade.type === "buy" || trade.type === "sell") && date !== null && (kind === "inception" ? date >= startDate : date > startDate)
      && !linked.has(trade.id) && !reinvested.has(trade.id);
  });
  return {
    unmarked: inPeriod.filter((trade) => !("fundingSource" in trade) || trade.fundingSource !== "external").map((trade) => trade.id),
    marked: inPeriod.filter((trade) => "fundingSource" in trade && trade.fundingSource === "external").map((trade) => trade.id),
  };
}
