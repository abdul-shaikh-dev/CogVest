import { formatLocalCalendarDate, parseCalendarDate } from "@/src/domain/dates";
import { calculateEpfLedger, epfAccountSchema, type EpfAccount, type EpfEvent } from "@/src/domain/epf";
import { formatDate } from "@/src/domain/formatters";
import { decimal } from "@/src/domain/precision";

export type EpfProvider = EpfAccount["provider"];
export type EpfStatus = EpfAccount["status"];
export type EpfEvidence = "statement" | "ownRecord";

export const epfProviderOptions: Array<{ label: string; value: EpfProvider }> = [
  { label: "EPFO", value: "epfo" },
  { label: "Employer PF trust", value: "employerTrust" },
];

export const epfStatusOptions: Array<{ label: string; value: EpfStatus }> = [
  { label: "Active", value: "active" },
  { label: "No longer contributing", value: "inactive" },
  { label: "Transferred", value: "transferred" },
  { label: "Closed", value: "closed" },
];

export const epfEvidenceOptions: Array<{ label: string; value: EpfEvidence }> = [
  { label: "Official passbook or statement", value: "statement" },
  { label: "My own record", value: "ownRecord" },
];

export const epfPassbookUrl = "https://passbook.epfindia.gov.in/MemberPassBook/login";
/** The passbook dates the current year's running balance at the coming year end, a future date. */
export const epfBalanceDateHint = "Use the date of the latest credit in your passbook, not the \"Closing balance as on\" date for the current year.";

export function epfStatusLabel(status: EpfStatus) {
  return epfStatusOptions.find((option) => option.value === status)?.label ?? status;
}

export function epfProviderLabel(provider: EpfProvider) {
  return epfProviderOptions.find((option) => option.value === provider)?.label ?? provider;
}

export type EpfBalanceDraft = { employee: string; employer: string; date: string };
export type EpfBalanceField = keyof EpfBalanceDraft;
export type EpfAccountDraft = EpfBalanceDraft & {
  nickname: string;
  provider: EpfProvider;
  employerLabel: string;
  status: EpfStatus;
  evidence: EpfEvidence;
};
export type EpfAccountField = "nickname" | "employerLabel" | EpfBalanceField;
export type EpfFieldErrors<Field extends string> = Partial<Record<Field, string>>;

export function emptyEpfAccountDraft(now: Date): EpfAccountDraft {
  return { nickname: "", provider: "epfo", employerLabel: "", status: "active", evidence: "statement",
    employee: "", employer: "", date: formatLocalCalendarDate(now) };
}

export function draftFromEpfAccount(account: EpfAccount): EpfAccountDraft {
  const { components } = account.checkpoint.balance;
  return {
    nickname: account.nickname,
    provider: account.provider,
    employerLabel: account.employerLabel ?? "",
    status: account.status,
    evidence: account.checkpoint.source === "userConfirmed" ? "ownRecord" : "statement",
    // A legacy total-only checkpoint keeps its unknown split until the user enters one.
    employee: components ? String(components.employee) : "",
    employer: components ? String(components.employer) : "",
    date: account.checkpoint.date,
  };
}

/** Parses an exact INR amount; never rounds away paise the user typed. */
export function parseInrAmount(text: string): number | null {
  const trimmed = text.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(decimal(value).times(100).toNumber()) ? value : null;
}

function validateBalance(draft: EpfBalanceDraft, now: Date) {
  const errors: EpfFieldErrors<EpfBalanceField> = {};
  const employee = parseInrAmount(draft.employee);
  const employer = parseInrAmount(draft.employer);
  if (employee === null) errors.employee = "Enter the employee EPF balance in rupees, up to 2 decimals.";
  if (employer === null) errors.employer = "Enter the employer EPF balance in rupees, up to 2 decimals.";
  if (!parseCalendarDate(draft.date) || draft.date.length !== 10) errors.date = "Choose the balance date.";
  else if (draft.date > formatLocalCalendarDate(now)) errors.date = "The balance date cannot be in the future.";
  return { errors, employee, employer };
}

/** Live total for the form; null until both balances are valid. */
export function draftTotal(draft: Pick<EpfBalanceDraft, "employee" | "employer">) {
  const employee = parseInrAmount(draft.employee);
  const employer = parseInrAmount(draft.employer);
  return employee === null || employer === null ? null : decimal(employee).plus(employer).toNumber();
}

export function buildEpfAccount(draft: EpfAccountDraft, options: { existing?: EpfAccount; id: string; now: Date }):
  { ok: true; account: EpfAccount } | { ok: false; errors: EpfFieldErrors<EpfAccountField>; message?: string } {
  const { errors: balanceErrors, employee, employer } = validateBalance(draft, options.now);
  const errors: EpfFieldErrors<EpfAccountField> = { ...balanceErrors };
  const nickname = draft.nickname.trim();
  const employerLabel = draft.employerLabel.trim();
  if (!nickname) errors.nickname = "Add a nickname, such as the employer or period.";
  else if (nickname.length > 60) errors.nickname = "Keep the nickname under 60 characters.";
  if (employerLabel.length > 80) errors.employerLabel = "Keep the employer name under 80 characters.";
  if (Object.keys(errors).length || employee === null || employer === null) return { ok: false, errors };

  const existing = options.existing;
  const checkpointChanged = !existing || existing.checkpoint.date !== draft.date ||
    existing.checkpoint.balance.components?.employee !== employee ||
    existing.checkpoint.balance.components?.employer !== employer;
  const candidate: EpfAccount = {
    id: existing?.id ?? options.id,
    nickname,
    provider: draft.provider,
    ...(employerLabel ? { employerLabel } : {}),
    status: draft.status,
    currency: "INR",
    checkpoint: {
      date: draft.date,
      balance: { total: decimal(employee).plus(employer).toNumber(), components: { employee, employer } },
      // A ₹0 balance holds no capital. Otherwise capital stays unknown, because a
      // statement balance includes years of interest.
      capital: employee === 0 && employer === 0 ? 0 : checkpointChanged ? null : existing!.checkpoint.capital,
      source: draft.evidence === "ownRecord" ? "userConfirmed"
        : draft.provider === "epfo" ? "epfoStatement" : "trustStatement",
      recordedAt: checkpointChanged ? options.now.toISOString() : existing!.checkpoint.recordedAt,
    },
    historyCompleteThrough: existing?.historyCompleteThrough && existing.historyCompleteThrough >= draft.date
      ? existing.historyCompleteThrough : null,
    ...(existing?.legacyAssetId ? { legacyAssetId: existing.legacyAssetId } : {}),
  };
  const parsed = epfAccountSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, errors: {}, message: "Check the account details and try again." };
  return { ok: true, account: parsed.data };
}

export type EpfBalanceUpdate = {
  event: Extract<EpfEvent, { type: "reconciliation" }>;
  previousTotal: number;
  newTotal: number;
  difference: number;
};

/**
 * A later statement balance is recorded as an explained reconciliation, never
 * as a deposit or an earned return. Unknown capital stays unknown.
 */
export function buildEpfBalanceUpdate(
  draft: EpfBalanceDraft & { reason: string },
  context: { account: EpfAccount; events: readonly EpfEvent[]; accounts: readonly EpfAccount[]; id: string; now: Date; evidence: EpfEvidence },
): { ok: true; update: EpfBalanceUpdate } | { ok: false; errors: EpfFieldErrors<EpfBalanceField | "reason">; message?: string } {
  const { errors, employee, employer } = validateBalance(draft, context.now);
  const allErrors: EpfFieldErrors<EpfBalanceField | "reason"> = { ...errors };
  const reason = draft.reason.trim();
  if (!reason) allErrors.reason = "Say where this balance comes from, such as an annual statement.";
  if (!allErrors.date && draft.date <= context.account.checkpoint.date) {
    allErrors.date = `Use a date after the starting balance (${formatDate(context.account.checkpoint.date)}). To fix the starting balance, edit the account.`;
  }
  if (Object.keys(allErrors).length || employee === null || employer === null) return { ok: false, errors: allErrors };

  const today = formatLocalCalendarDate(context.now);
  const before = calculateEpfLedger({ accounts: context.accounts, events: context.events }, draft.date, today);
  const previous = before.ok ? before.accounts.find((item) => item.accountId === context.account.id) : undefined;
  const total = decimal(employee).plus(employer).toNumber();
  const event: EpfBalanceUpdate["event"] = {
    id: context.id,
    type: "reconciliation",
    accountId: context.account.id,
    effectiveDate: draft.date,
    postedDate: draft.date,
    recordedAt: context.now.toISOString(),
    evidence: context.evidence === "ownRecord" ? "Own record"
      : context.account.provider === "epfo" ? "EPFO passbook" : "Employer trust statement",
    balance: { total, components: { employee, employer } },
    capital: null,
    reason,
  };
  const after = calculateEpfLedger({ accounts: context.accounts, events: [...context.events, event] }, today, today);
  if (!previous || !after.ok) {
    return { ok: false, errors: {}, message: "This balance conflicts with other recorded EPF entries. Review the account history first." };
  }
  return { ok: true, update: {
    event,
    previousTotal: previous.balance.total,
    newTotal: total,
    difference: decimal(total).minus(previous.balance.total).toNumber(),
  } };
}
