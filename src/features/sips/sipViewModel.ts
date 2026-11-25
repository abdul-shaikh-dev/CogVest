import { formatLocalCalendarDate } from "@/src/domain/dates";
import { formatDate, formatINR } from "@/src/domain/formatters";
import { parseDecimalInput } from "@/src/domain/decimalInput";
import { sipDueDate, sipTemplateProblems, type SipTemplateField } from "@/src/domain/sipTemplates";
import { isMutualFundAsset } from "@/src/services/mutualFunds/amfiQuote";
import type { SipTemplateInput } from "@/src/store";
import type { Asset, SipFunding, SipTemplate } from "@/src/types";

/** Holdings a SIP can buy: INR investments that Record Purchase accepts. */
export function sipHoldingOptions(assets: readonly Asset[]) {
  return assets
    .filter((asset) => asset.currency === "INR" && asset.assetClass !== "cash" &&
      asset.instrumentType !== "ppf" && asset.instrumentType !== "fixedDeposit")
    .map((asset) => ({ label: asset.name, value: asset.id }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

/** Funds allot fractional units; shares and ETFs buy whole units. */
export function buysWholeUnits(asset: Asset) {
  return !isMutualFundAsset(asset);
}

export function ordinalDay(day: number) {
  const tens = day % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] ?? "th";
  return `${day}${suffix}`;
}

/** "₹5,000 on the 5th of each month", noting when a short month moves it earlier. */
export function sipScheduleText(template: Pick<SipTemplate, "amountInr" | "dayOfMonth">, masked: boolean) {
  const amount = masked ? "An amount" : formatINR(template.amountInr);
  const day = template.dayOfMonth > 28
    ? `the ${ordinalDay(template.dayOfMonth)} (or the month's last day)`
    : `the ${ordinalDay(template.dayOfMonth)}`;
  return `${amount} on ${day} of each month`;
}

export function fundingText(funding: SipFunding) {
  return funding === "deposit" ? "Adds the money to Cash, then buys" : "Paid from Cash";
}

export function dueCountText(count: number) {
  return count === 1 ? "1 SIP instalment to confirm" : `${count} SIP instalments to confirm`;
}

export const fundingOptions = [
  { label: "Pay from Cash already recorded", value: "cash" },
  { label: "Add the money to Cash, then buy", value: "deposit" },
] as const satisfies ReadonlyArray<{ label: string; value: SipFunding }>;

export type SipDraft = { amount: string; assetId: string; firstDate: string; funding: SipFunding };
export type SipDraftErrors = Partial<Record<"amount" | "assetId" | "firstDate", string>>;

export function sipDraftFrom(template: SipTemplate | undefined, today: string): SipDraft {
  if (!template) return { amount: "", assetId: "", firstDate: today, funding: "cash" };
  return {
    amount: String(template.amountInr),
    assetId: template.assetId,
    firstDate: sipDueDate(template.startMonth, template.dayOfMonth),
    funding: template.funding,
  };
}

const fieldFor: Partial<Record<SipTemplateField, keyof SipDraftErrors>> = {
  amountInr: "amount",
  assetId: "assetId",
  dayOfMonth: "firstDate",
  startMonth: "firstDate",
};

/**
 * The first instalment date sets both the day of the month and the first
 * month. Editing keeps a day past the month's end (such as the 31st) unless
 * the user picks another date.
 */
export function buildSipInput(draft: SipDraft, id: string, saved?: SipTemplate):
  | { ok: true; input: SipTemplateInput }
  | { ok: false; errors: SipDraftErrors } {
  const amount = parseDecimalInput(draft.amount);
  const unchangedDate = saved && draft.firstDate === sipDueDate(saved.startMonth, saved.dayOfMonth);
  const input: SipTemplateInput = {
    amountInr: amount,
    assetId: draft.assetId,
    dayOfMonth: unchangedDate ? saved.dayOfMonth : Number(draft.firstDate.slice(8, 10)),
    funding: draft.funding,
    id,
    startMonth: unchangedDate ? saved.startMonth : draft.firstDate.slice(0, 7),
  };
  const problems = sipTemplateProblems({ ...input, createdAt: "", handledMonths: [], paused: false, updatedAt: "" });
  const errors: SipDraftErrors = {};
  for (const [field, message] of Object.entries(problems) as [SipTemplateField, string][]) {
    const key = fieldFor[field];
    if (key && !errors[key]) errors[key] = message;
  }
  return Object.keys(errors).length ? { errors, ok: false } : { input, ok: true };
}

export function dueDateText(dueDate: string) {
  return `Due ${formatDate(dueDate)}`;
}

/** Price window for one instalment: the due date and up to ten days after it, never past today. */
export function sipPriceWindow(dueDate: string, now: Date) {
  const today = formatLocalCalendarDate(now);
  const end = new Date(`${dueDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 10);
  const last = end.toISOString().slice(0, 10);
  return { from: dueDate, to: last < today ? last : today };
}
