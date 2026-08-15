export type PpfAccountStatus =
  | "active"
  | "discontinued"
  | "matured"
  | "extendedWithContributions"
  | "continuedWithoutContributions";

export type PpfOpeningBasis =
  | {
      kind: "date";
      openedOn: string;
    }
  | {
      financialYearStart: number;
      kind: "financialYear";
    };

export type PpfBaselineContributionContext = {
  amount: number;
  financialYearStart: number;
};

export type PpfAccount = {
  accountNumberSuffix?: string;
  balanceAsOf: string;
  baselineFinancialYearContributions?: PpfBaselineContributionContext;
  confirmedBalance: number;
  confirmedExtensionStartFinancialYear?: number;
  createdAt: string;
  id: string;
  legacyAssetId?: string;
  nickname: string;
  opening: PpfOpeningBasis;
  provider: string;
  status: PpfAccountStatus;
};

type PpfLedgerEntryBase = {
  accountId: string;
  date: string;
  id: string;
  notes?: string;
  recordedAt: string;
};

export type PpfContributionEntry = PpfLedgerEntryBase & {
  amount: number;
  type: "contribution";
};

export type PpfInterestCreditEntry = PpfLedgerEntryBase & {
  amount: number;
  financialYearStart: number;
  type: "interestCredit";
};

export type PpfWithdrawalEntry = PpfLedgerEntryBase & {
  amount: number;
  type: "withdrawal";
};

export type PpfReconciliationEntry = PpfLedgerEntryBase & {
  confirmedBalance: number;
  reason: string;
  type: "reconciliation";
};

export type PpfLedgerEntry =
  | PpfContributionEntry
  | PpfInterestCreditEntry
  | PpfWithdrawalEntry
  | PpfReconciliationEntry;

export type PpfInterestRatePeriod = {
  annualRatePct: number;
  effectiveFrom: string;
  effectiveTo: string;
  notificationDate: string;
  sourceLabel: string;
  sourceUrl: string;
};
