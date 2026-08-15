import { normalizeMoney } from "@/src/domain/precision";
import type {
  PpfAccount,
  PpfInterestRatePeriod,
  PpfLedgerEntry,
} from "@/src/types";

import {
  findPpfInterestRate,
  ppfInterestRateSchedule,
  ppfInterestRateScheduleVersion,
} from "./interestRates";
import { getFinancialYearStart } from "./validation";

const annualContributionMaximum = 150_000;
const annualContributionMinimum = 500;

export function comparePpfLedgerEntries(left: PpfLedgerEntry, right: PpfLedgerEntry) {
  return (
    left.date.localeCompare(right.date) ||
    left.recordedAt.localeCompare(right.recordedAt) ||
    left.id.localeCompare(right.id)
  );
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
}

function calendarDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function monthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
}

function roundRupee(value: number) {
  return Math.floor(value + 0.5);
}

export function getPpfOpeningFinancialYear(account: PpfAccount) {
  return account.opening.kind === "date"
    ? getFinancialYearStart(account.opening.openedOn)
    : account.opening.financialYearStart;
}

export function getPpfMaturityDate(account: PpfAccount) {
  return `${getPpfOpeningFinancialYear(account) + 16}-03-31`;
}

export function getPpfExtensionEndDate(account: PpfAccount) {
  return account.confirmedExtensionStartFinancialYear === undefined
    ? null
    : `${account.confirmedExtensionStartFinancialYear + 5}-03-31`;
}

export function calculatePpfConfirmedBalance(
  account: PpfAccount,
  entries: readonly PpfLedgerEntry[],
  asOf: string,
) {
  let balance = account.confirmedBalance;
  let investedBasis = account.confirmedBalance;

  for (const entry of [...entries].sort(comparePpfLedgerEntries)) {
    if (
      entry.accountId !== account.id ||
      entry.date <= account.balanceAsOf ||
      entry.date > asOf
    ) {
      continue;
    }

    if (entry.type === "contribution") {
      balance += entry.amount;
      investedBasis += entry.amount;
    } else if (entry.type === "interestCredit") {
      balance += entry.amount;
    } else if (entry.type === "withdrawal") {
      balance -= entry.amount;
      investedBasis = Math.max(0, investedBasis - entry.amount);
    } else {
      balance = entry.confirmedBalance;
    }
  }

  return {
    confirmedBalance: normalizeMoney(balance),
    investedBasis: normalizeMoney(investedBasis),
  };
}

function getLatestEstimateAnchor(
  account: PpfAccount,
  entries: readonly PpfLedgerEntry[],
  asOf: string,
) {
  return entries
    .filter(
      (entry) =>
        entry.accountId === account.id &&
        entry.date <= asOf &&
        (entry.type === "interestCredit" || entry.type === "reconciliation"),
    )
    .reduce(
      (latest, entry) => (entry.date > latest ? entry.date : latest),
      account.balanceAsOf,
    );
}

function calculateEligibleMonthlyBalance({
  account,
  entries,
  estimatedCarry,
  month,
}: {
  account: PpfAccount;
  entries: readonly PpfLedgerEntry[];
  estimatedCarry: number;
  month: Date;
}) {
  const fifth = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-05`;
  const end = calendarDate(monthEnd(month));
  let eligible =
    calculatePpfConfirmedBalance(account, entries, fifth).confirmedBalance +
    estimatedCarry;

  for (const entry of [...entries].sort(comparePpfLedgerEntries)) {
    if (
      entry.accountId !== account.id ||
      entry.date <= fifth ||
      entry.date > end ||
      entry.date <= account.balanceAsOf
    ) {
      continue;
    }
    const nextBalance =
      calculatePpfConfirmedBalance(account, entries, entry.date).confirmedBalance +
      estimatedCarry;
    eligible = Math.min(eligible, nextBalance);
  }

  return Math.max(0, Math.floor(eligible));
}

export type PpfInterestEstimate =
  | {
      amount: number;
      estimatedFrom: string;
      estimatedThrough: string;
      scheduleVersion: string;
      status: "available";
    }
  | {
      missingMonth: string;
      reason: "rate-unavailable";
      scheduleVersion: string;
      status: "unavailable";
    };

export function estimatePpfInterest({
  account,
  asOf,
  entries,
  schedule = ppfInterestRateSchedule,
}: {
  account: PpfAccount;
  asOf: string;
  entries: readonly PpfLedgerEntry[];
  schedule?: readonly PpfInterestRatePeriod[];
}): PpfInterestEstimate {
  const anchor = getLatestEstimateAnchor(account, entries, asOf);
  let month = new Date(`${anchor.slice(0, 7)}-01T12:00:00`);
  if (Number(anchor.slice(8, 10)) > 5) month = addMonths(month, 1);
  const finalCompleteMonth = new Date(`${asOf.slice(0, 7)}-01T12:00:00`);
  let annualAccrued = 0;
  let estimatedCarry = 0;
  let total = 0;
  let estimatedThrough = anchor;

  while (month < finalCompleteMonth) {
    const monthDate = calendarDate(monthEnd(month));
    const rate = findPpfInterestRate(monthDate, schedule);
    if (!rate) {
      return {
        missingMonth: monthDate.slice(0, 7),
        reason: "rate-unavailable",
        scheduleVersion: ppfInterestRateScheduleVersion,
        status: "unavailable",
      };
    }

    const eligibleBalance = calculateEligibleMonthlyBalance({
      account,
      entries,
      estimatedCarry,
      month,
    });
    annualAccrued += (eligibleBalance * rate.annualRatePct) / 1200;
    estimatedThrough = monthDate;

    if (month.getMonth() === 2) {
      const annualCredit = roundRupee(annualAccrued);
      total += annualCredit;
      estimatedCarry += annualCredit;
      annualAccrued = 0;
    }

    month = addMonths(month, 1);
  }

  total += annualAccrued;
  return {
    amount: normalizeMoney(total),
    estimatedFrom: anchor,
    estimatedThrough,
    scheduleVersion: ppfInterestRateScheduleVersion,
    status: "available",
  };
}

export function calculatePpfFinancialYearContributions(
  account: PpfAccount,
  entries: readonly PpfLedgerEntry[],
  financialYearStart: number,
) {
  const baseline =
    account.baselineFinancialYearContributions?.financialYearStart ===
    financialYearStart
      ? account.baselineFinancialYearContributions.amount
      : 0;
  const recorded = entries
    .filter(
      (entry) =>
        entry.accountId === account.id &&
        entry.type === "contribution" &&
        entry.date > account.balanceAsOf &&
        getFinancialYearStart(entry.date) === financialYearStart,
    )
    .reduce((total, entry) => total + (entry.type === "contribution" ? entry.amount : 0), 0);
  return normalizeMoney(baseline + recorded);
}

export function calculatePpfAccountSummary({
  account,
  asOf,
  entries,
}: {
  account: PpfAccount;
  asOf: string;
  entries: readonly PpfLedgerEntry[];
}) {
  const accountEntries = entries.filter((entry) => entry.accountId === account.id);
  const balances = calculatePpfConfirmedBalance(account, accountEntries, asOf);
  const financialYearStart = getFinancialYearStart(asOf);
  const financialYearContributions = calculatePpfFinancialYearContributions(
    account,
    accountEntries,
    financialYearStart,
  );
  const latestAppliedEntry = accountEntries
    .filter((entry) => entry.date > account.balanceAsOf && entry.date <= asOf)
    .sort(comparePpfLedgerEntries)
    .at(-1);

  return {
    ...balances,
    contributionContext: {
      belowMinimum: financialYearContributions < annualContributionMinimum,
      exceedsMaximum: financialYearContributions > annualContributionMaximum,
      financialYearContributions,
      financialYearStart,
      remainingTrackedCapacity: Math.max(
        0,
        normalizeMoney(annualContributionMaximum - financialYearContributions),
      ),
    },
    estimatedInterest: estimatePpfInterest({ account, asOf, entries: accountEntries }),
    extensionEndDate: getPpfExtensionEndDate(account),
    ledgerAppliedThrough: latestAppliedEntry?.date ?? account.balanceAsOf,
    maturityDate: getPpfMaturityDate(account),
    officialInterestEarned: normalizeMoney(
      accountEntries
        .filter(
          (entry) =>
            entry.type === "interestCredit" &&
            entry.date > account.balanceAsOf &&
            entry.date <= asOf,
        )
        .reduce(
          (total, entry) =>
            total + (entry.type === "interestCredit" ? entry.amount : 0),
          0,
        ),
    ),
  };
}
