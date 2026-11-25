import { decimal, FinancialDecimal } from "@/src/domain/precision";
import type { SipTemplate } from "@/src/types";

/**
 * Recurring purchase (SIP) templates (#766). Pure rules for templates and for
 * which instalments are due. Nothing here records a purchase: confirming an
 * instalment goes through the same funded-buy path as Record Purchase.
 */

export const maxSipTemplates = 50;
const maxAmountInr = 1_000_000_000;
/** Instalments before this month are not offered, whatever the start month. */
const earliestSipMonth = "2000-01";

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/u;

export function isSipMonth(value: string) {
  return monthPattern.test(value) && value >= earliestSipMonth;
}

function hasAtMostTwoDecimals(value: number) {
  return decimal(value).decimalPlaces() <= 2;
}

/** The instalment date in a month: the template's day, or the month's last day if shorter. */
export function sipDueDate(month: string, dayOfMonth: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const day = Math.min(dayOfMonth, lastDay);
  return `${month}-${String(day).padStart(2, "0")}`;
}

export function nextSipMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthNumber === 12 ? `${year + 1}-01` : `${year}-${String(monthNumber + 1).padStart(2, "0")}`;
}

export type SipTemplateField = "assetId" | "amountInr" | "dayOfMonth" | "startMonth" | "handledMonths";

/** Problems with a template's own fields, as user-facing messages keyed by field. */
export function sipTemplateProblems(template: SipTemplate) {
  const problems: Partial<Record<SipTemplateField, string>> = {};
  if (!template.assetId) problems.assetId = "Choose a holding.";
  if (!Number.isFinite(template.amountInr) || template.amountInr <= 0 ||
    template.amountInr > maxAmountInr || !hasAtMostTwoDecimals(template.amountInr)) {
    problems.amountInr = "Enter an amount above ₹0, with at most two decimal places.";
  }
  if (!Number.isInteger(template.dayOfMonth) || template.dayOfMonth < 1 || template.dayOfMonth > 31) {
    problems.dayOfMonth = "Choose a day from 1 to 31.";
  }
  if (!isSipMonth(template.startMonth)) problems.startMonth = "Choose the first month of this SIP.";
  const months = template.handledMonths.map((item) => item.month);
  if (new Set(months).size !== months.length ||
    template.handledMonths.some((item) => !isSipMonth(item.month) ||
      (item.status === "confirmed" && !item.tradeId))) {
    problems.handledMonths = "The confirmed and skipped months are invalid.";
  }
  return problems;
}

/** Problems across all templates: their own fields, duplicate ids, the limit and unknown holdings. */
export function sipTemplatesProblems(templates: readonly SipTemplate[], assetIds?: ReadonlySet<string>) {
  if (templates.length > maxSipTemplates) return [`Keep up to ${maxSipTemplates} SIPs.`];
  const problems: string[] = [];
  if (new Set(templates.map((template) => template.id)).size !== templates.length) problems.push("Two SIPs share an id.");
  for (const template of templates) {
    if (Object.keys(sipTemplateProblems(template)).length > 0) problems.push(`SIP ${template.id} is invalid.`);
    if (assetIds && !assetIds.has(template.assetId)) problems.push(`SIP ${template.id} names a holding that does not exist.`);
  }
  return problems;
}

export type DueSipInstalment = { templateId: string; month: string; dueDate: string };

/**
 * Instalments whose date has arrived and that were neither confirmed nor
 * skipped, oldest first. Missed months are listed, never filled in. With
 * `tradeIds`, a month whose confirmed purchase was later deleted is due again.
 */
export function dueSipInstalments(
  templates: readonly SipTemplate[],
  today: string,
  tradeIds?: ReadonlySet<string>,
): DueSipInstalment[] {
  const due: DueSipInstalment[] = [];
  const currentMonth = today.slice(0, 7);
  for (const template of templates) {
    if (template.paused || !isSipMonth(template.startMonth)) continue;
    const handled = new Set(template.handledMonths
      .filter((item) => item.status === "skipped" || !tradeIds || tradeIds.has(item.tradeId))
      .map((item) => item.month));
    for (let month = template.startMonth; month <= currentMonth; month = nextSipMonth(month)) {
      const dueDate = sipDueDate(month, template.dayOfMonth);
      if (dueDate <= today && !handled.has(month)) due.push({ dueDate, month, templateId: template.id });
    }
  }
  return due.sort((left, right) =>
    left.dueDate.localeCompare(right.dueDate) || left.templateId.localeCompare(right.templateId));
}

/**
 * Units an amount buys at a price. Funds allot units to three decimal places;
 * shares and ETFs buy whole units, so any remainder stays unspent.
 */
export function sipUnits(amountInr: number, price: number, wholeUnits: boolean) {
  if (!(amountInr > 0) || !(price > 0)) return 0;
  const units = decimal(amountInr).dividedBy(price);
  return wholeUnits ? units.toDecimalPlaces(0, FinancialDecimal.ROUND_DOWN).toNumber() : units.toDecimalPlaces(3, FinancialDecimal.ROUND_DOWN).toNumber();
}

/** The first price on or after the due date, so a holiday takes the next trading day's price. */
export function sipPriceOnOrAfter(points: ReadonlyArray<{ close: number; date: string }>, dueDate: string) {
  return [...points]
    .filter((point) => point.date >= dueDate && Number.isFinite(point.close) && point.close > 0)
    .sort((left, right) => left.date.localeCompare(right.date))[0] ?? null;
}
