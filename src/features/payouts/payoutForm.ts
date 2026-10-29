import { formatLocalCalendarDate, parseCalendarDate } from "@/src/domain/dates";
import { distributionNetAmount, type DistributionInput } from "@/src/domain/distributions";
import { formatDate, formatINR } from "@/src/domain/formatters";
import { decimal } from "@/src/domain/precision";
import type { Asset, BuyTrade, Distribution, DistributionCoverage, DistributionTreatment, Trade } from "@/src/types";
import { parseInrAmount } from "@/src/features/epf/epfAccountForm";

export type PayoutDraft = {
  paidOn: string;
  gross: string;
  tax: string;
  treatment: DistributionTreatment;
  linkedTradeId: string;
};
export type PayoutField = "paidOn" | "gross" | "tax" | "linkedTradeId";
export type PayoutFieldErrors = Partial<Record<PayoutField, string>>;

export const payoutTreatmentOptions: Array<{ label: string; value: DistributionTreatment }> = [
  { label: "Paid into my tracked Cash", value: "paidToCash" },
  { label: "Paid outside CogVest (bank account)", value: "paidOutside" },
  { label: "Reinvested into more units", value: "reinvested" },
];

export const treatmentLabel: Record<DistributionTreatment, string> = {
  paidToCash: "To Cash",
  paidOutside: "Paid outside",
  reinvested: "Reinvested",
};

/** Payouts need an INR asset that can pay one; crypto and Cash cannot (D2). */
export function canRecordPayouts(asset: Asset) {
  return asset.currency === "INR" && asset.assetClass !== "crypto" && asset.assetClass !== "cash";
}

export function emptyPayoutDraft(now: Date): PayoutDraft {
  return { paidOn: formatLocalCalendarDate(now), gross: "", tax: "", treatment: "paidToCash", linkedTradeId: "" };
}

export function draftFromDistribution(item: Distribution): PayoutDraft {
  return { paidOn: item.paidOn, gross: String(item.grossAmount), tax: item.taxWithheld ? String(item.taxWithheld) : "",
    treatment: item.treatment, linkedTradeId: item.linkedTradeId ?? "" };
}

/** Buys of this asset on or after the pay date that a reinvestment can point at. */
export function reinvestmentBuyOptions(trades: readonly Trade[], assetId: string, paidOn: string,
  distributions: readonly Distribution[], editingId?: string) {
  const taken = new Set(distributions.filter((item) => item.id !== editingId).map((item) => item.linkedTradeId));
  return trades
    .filter((trade): trade is BuyTrade => trade.assetId === assetId && trade.type === "buy" && trade.date.slice(0, 10) >= paidOn && !taken.has(trade.id))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((trade) => ({ label: `${formatDate(trade.date.slice(0, 10))} · ${formatINR(trade.totalValue)}`, value: trade.id }));
}

/** Net amount while typing; null until gross and tax are both valid. */
export function draftNet(draft: Pick<PayoutDraft, "gross" | "tax">) {
  const gross = parseInrAmount(draft.gross);
  const tax = draft.tax.trim() === "" ? 0 : parseInrAmount(draft.tax);
  if (gross === null || tax === null || gross <= 0 || tax >= gross) return null;
  return decimal(gross).minus(tax).toNumber();
}

export function buildPayoutInput(draft: PayoutDraft, context: { assetId: string; id: string; now: Date }):
  { ok: true; input: DistributionInput } | { ok: false; errors: PayoutFieldErrors } {
  const errors: PayoutFieldErrors = {};
  const gross = parseInrAmount(draft.gross);
  const tax = draft.tax.trim() === "" ? 0 : parseInrAmount(draft.tax);
  if (gross === null || gross <= 0) errors.gross = "Enter the payout before tax in rupees, up to 2 decimals.";
  if (tax === null) errors.tax = "Enter the tax withheld in rupees, or leave it blank for none.";
  else if (gross !== null && gross > 0 && tax >= gross) errors.tax = "Tax withheld must be less than the payout.";
  if (!parseCalendarDate(draft.paidOn) || draft.paidOn.length !== 10) errors.paidOn = "Choose the date it was paid.";
  else if (draft.paidOn > formatLocalCalendarDate(context.now)) errors.paidOn = "The pay date cannot be in the future.";
  if (draft.treatment === "reinvested" && !draft.linkedTradeId) {
    errors.linkedTradeId = "Choose the purchase this payout paid for. Record the purchase first if it is missing.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, input: { id: context.id, assetId: context.assetId, paidOn: draft.paidOn, grossAmount: gross!,
    taxWithheld: tax!, treatment: draft.treatment,
    ...(draft.treatment === "reinvested" ? { linkedTradeId: draft.linkedTradeId } : {}) } };
}

/** What saving does, in one sentence. */
export function payoutEffectCopy(draft: PayoutDraft) {
  const net = draftNet(draft);
  const amount = net === null ? "The amount after tax" : formatINR(net);
  switch (draft.treatment) {
    case "paidToCash":
      return `${amount} is added to your tracked Cash as a payout. It counts as return earned, not new money.`;
    case "paidOutside":
      return `${amount} counts as return earned. Cash is not changed.`;
    case "reinvested":
      return `${amount} counts as return earned. The linked purchase stays a separate purchase.`;
  }
}

export function sortedPayouts(distributions: readonly Distribution[], assetId: string) {
  return distributions.filter((item) => item.assetId === assetId)
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn) || a.id.localeCompare(b.id));
}

/** One line for the holding detail row and the payouts screen. */
export function payoutsSummary(distributions: readonly Distribution[], coverage: DistributionCoverage | undefined, assetId: string) {
  const count = distributions.filter((item) => item.assetId === assetId).length;
  const recorded = count === 0 ? "None recorded" : `${count} recorded`;
  return coverage ? `${recorded} · complete since ${formatDate(coverage.from)}` : `${recorded} · not confirmed complete`;
}

export function payoutNet(item: Distribution) {
  return distributionNetAmount(item);
}

export function payoutRejectionMessage(reason: "notFound" | "invalidEntry" | "insufficientCash") {
  if (reason === "notFound") return "This payout was already removed on another screen.";
  if (reason === "insufficientCash") {
    return "Later Cash activity depends on this payout's Cash. Correct that activity first.";
  }
  return "Check the payout. A reinvested payout needs a purchase of this holding on or after the pay date.";
}
