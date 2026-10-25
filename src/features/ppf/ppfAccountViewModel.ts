import type { PpfAccountStatus } from "@/src/types";

// Pure view logic for the PPF account screen and form: status and entry
// labels, and which form field each validation message belongs to.

export const statusOptions: Array<{ label: string; value: PpfAccountStatus }> = [
  { label: "Active", value: "active" },
  { label: "Discontinued", value: "discontinued" },
  { label: "Matured", value: "matured" },
  { label: "Extended with contributions", value: "extendedWithContributions" },
  { label: "Continued without contributions", value: "continuedWithoutContributions" },
];

export type PpfAccountField =
  | "nickname"
  | "provider"
  | "suffix"
  | "openedOn"
  | "openingFinancialYear"
  | "extensionYear"
  | "balance"
  | "balanceAsOf"
  | "fyContributions";

export type PpfFormSection = "account" | "opening" | "baseline" | "identification";

export const ppfAccountErrorFields: Record<string, PpfAccountField> = {
  "Nickname is required.": "nickname",
  "Bank or Post Office is required.": "provider",
  "Account suffix must contain the final 2 to 4 digits only.": "suffix",
  "Confirmed balance must be zero or greater.": "balance",
  "Balance date must be a valid non-future date.": "balanceAsOf",
  "Opening date must be a valid non-future date.": "openedOn",
  "Opening financial year is invalid.": "openingFinancialYear",
  "Balance date cannot precede the opening financial year.": "balanceAsOf",
  "Balance date cannot precede the exact opening date.": "balanceAsOf",
  "Extended accounts require a confirmed extension start year.": "extensionYear",
  "Extension must start at maturity or a later five-year block.": "extensionYear",
  "Active accounts cannot have an extension start year.": "extensionYear",
  "Baseline financial-year contributions are invalid.": "fyContributions",
};

export function statusLabel(status: PpfAccountStatus) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

export function entryLabel(type: "contribution" | "interestCredit" | "withdrawal" | "reconciliation") {
  if (type === "interestCredit") return "Official interest";
  if (type === "reconciliation") return "Balance correction";
  return type === "contribution" ? "Contribution" : "Withdrawal";
}
