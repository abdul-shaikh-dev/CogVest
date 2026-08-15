import { normalizeMoney, sumFinancialValues } from "@/src/domain/precision";
import type { PpfAccount, PpfLedgerEntry } from "@/src/types";

import { calculatePpfAccountSummary } from "./calculations";
import { getPpfOpeningDate } from "./validation";

export type PpfPortfolioSummary = {
  accounts: Array<
    ReturnType<typeof calculatePpfAccountSummary> & { account: PpfAccount }
  >;
  confirmedBalance: number;
  investedBasis: number;
  unavailableAccountIds: string[];
};

export function getPpfAccountOpeningDate(account: PpfAccount) {
  return getPpfOpeningDate(account);
}

export function getLinkedLegacyPpfAssetIds(
  accounts: readonly PpfAccount[],
  asOf: string,
) {
  return new Set(
    accounts
      .filter(
        (account) =>
          account.legacyAssetId !== undefined && account.balanceAsOf <= asOf,
      )
      .map((account) => account.legacyAssetId as string),
  );
}

export function calculatePpfPortfolioSummary({
  accounts,
  asOf,
  entries,
}: {
  accounts: readonly PpfAccount[];
  asOf: string;
  entries: readonly PpfLedgerEntry[];
}): PpfPortfolioSummary {
  const activeAccounts = accounts.filter(
    (account) => getPpfAccountOpeningDate(account) <= asOf,
  );
  const unavailableAccountIds = activeAccounts
    .filter((account) => account.balanceAsOf > asOf)
    .map((account) => account.id);
  const summaries = activeAccounts
    .filter((account) => account.balanceAsOf <= asOf)
    .map((account) => ({
      account,
      ...calculatePpfAccountSummary({ account, asOf, entries }),
    }));

  return {
    accounts: summaries,
    confirmedBalance: normalizeMoney(
      sumFinancialValues(summaries.map((summary) => summary.confirmedBalance)),
    ),
    investedBasis: normalizeMoney(
      sumFinancialValues(summaries.map((summary) => summary.investedBasis)),
    ),
    unavailableAccountIds,
  };
}
