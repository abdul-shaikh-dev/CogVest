import { formatLocalCalendarDate, getCalendarDatePart } from "@/src/domain/dates";
import { formatCompactINR } from "@/src/domain/formatters";
import { decimal } from "@/src/domain/precision";
import { measurementEvidenceDigest } from "@/src/domain/wholePortfolioXirr";
import type { MeasurementBasisInput, PortfolioStoreState } from "@/src/store";
import type { MeasurementBasis, MonthlySnapshot } from "@/src/types";
import { compareCodeUnits } from "@/src/domain/ordering";

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

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type SnapshotStart = { id: string; label: string; startDate: string; lines: BasisLineDraft[] };

/**
 * Stored month-end snapshots that can start an opening-value period (#607):
 * months that have ended, newest first. Lines come from the snapshot's class
 * values; when those don't add up to its portfolio value, or Cash is negative,
 * one Portfolio value line keeps the total exact. The user still confirms.
 */
export function snapshotStarts(snapshots: MonthlySnapshot[], today: string): SnapshotStart[] {
  return snapshots.flatMap((snapshot): SnapshotStart[] => {
    const match = /^(\d{4})-(\d{2})$/.exec(snapshot.month);
    if (!match || !(snapshot.portfolioValue >= 0)) return [];
    const year = Number(match[1]);
    const month = Number(match[2]);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const startDate = `${snapshot.month}-${String(lastDay).padStart(2, "0")}`;
    if (startDate >= today) return [];
    const classes: Array<[string, number]> = [
      ["Equity", snapshot.equityValue], ["Debt", snapshot.debtValue], ["Crypto", snapshot.cryptoValue], ["Cash", snapshot.cashValue],
    ];
    const total = classes.reduce((sum, [, value]) => sum.plus(value), decimal(0));
    const exact = classes.every(([, value]) => value >= 0) && total.minus(snapshot.portfolioValue).abs().lessThan(0.005);
    const values = exact ? classes.filter(([, value]) => value !== 0) : [["Portfolio value", snapshot.portfolioValue] as [string, number]];
    const lines = (values.length ? values : [["Portfolio value", 0] as [string, number]])
      .map(([label, value], index) => ({ key: `snapshot-${index}`, label, value: decimal(value).toFixed(2) }));
    return [{ id: snapshot.id, label: `${monthNames[month - 1]} ${year} · ${formatCompactINR(snapshot.portfolioValue)}`, startDate, lines }];
  }).sort((a, b) => compareCodeUnits(b.startDate, a.startDate));
}

/** Whether the saved basis still stands on the records it was confirmed against. */
export function basisStatus(state: BasisState): "none" | "current" | "needsConfirming" {
  const basis = state.measurementBasis;
  if (!basis) return "none";
  if (basis.kind === "openingValue" && basis.evidenceDigest !== measurementEvidenceDigest(state, basis.startDate)) return "needsConfirming";
  return "current";
}
