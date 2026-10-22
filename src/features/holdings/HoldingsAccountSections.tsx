import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import {
  AppButton,
  AppText,
  CategoryIcon,
  MaskedValue,
  PremiumCard,
  SectionHeader,
  getPressedStateStyle,
} from "@/src/components/common";
import type { summarizeEpfForReporting } from "@/src/domain/epf/reporting";
import { formatCompactINR, formatDate, formatINR } from "@/src/domain/formatters";
import { epfProviderLabel, epfStatusLabel } from "@/src/features/epf/epfAccountForm";
import type { PortfolioStoreState } from "@/src/store";

import { useStyles } from "./holdingsStyles";
import type { useHoldings } from "./useHoldings";

type HoldingsData = ReturnType<typeof useHoldings>;

/** PPF accounts, older PPF holdings awaiting the ledger, and PPF holding rows. */
export function PpfAccountsSection({
  legacyPpfHoldings,
  maskWealthValues,
  onAddPpfAccount,
  onReviewPpfAccount,
  ppfHoldingRows,
  ppfSummary,
}: {
  legacyPpfHoldings: HoldingsData["holdings"];
  maskWealthValues: boolean;
  onAddPpfAccount?: (legacy?: { assetId?: string; name?: string }) => void;
  onReviewPpfAccount?: (accountId: string) => void;
  ppfHoldingRows: ReactNode;
  ppfSummary: HoldingsData["ppfSummary"];
}) {
  const styles = useStyles();
  return (
    <View style={styles.ppfSection} testID="holdings-ppf-section">
      <View style={styles.sectionActionHeader}>
        <SectionHeader title="PPF accounts" />
        {onAddPpfAccount ? (
          <AppButton
            onPress={() => onAddPpfAccount()}
            testID="add-ppf-account"
            title="Add account"
            variant="secondary"
          />
        ) : null}
      </View>
      {ppfSummary.accounts.map((item) => (
        <Pressable
          accessibilityLabel={`Open ${item.account.nickname}`}
          accessibilityRole="button"
          key={item.account.id}
          onPress={() => onReviewPpfAccount?.(item.account.id)}
          style={({ pressed }) => [
            styles.ppfAccountCard,
            getPressedStateStyle({ pressed }),
          ]}
          testID={`ppf-account-${item.account.id}`}
        >
          <CategoryIcon assetClass="debt" size={22} />
          <View style={styles.flex}>
            <AppText weight="bold">{item.account.nickname}</AppText>
            <AppText color="secondary" variant="caption">
              {item.account.provider} •{" "}
              {maskWealthValues
                ? "Contribution details hidden"
                : item.contributionContext.financialYearContributions > 0
                  ? `${formatCompactINR(item.contributionContext.financialYearContributions)} contributed this FY`
                  : "No contribution recorded this FY"}
            </AppText>
          </View>
          <View style={styles.ppfValue}>
            <MaskedValue
              masked={maskWealthValues}
              value={formatCompactINR(item.confirmedBalance)}
              weight="bold"
            />
            <AppText color="secondary" variant="caption">
              Confirmed
            </AppText>
          </View>
        </Pressable>
      ))}
      {legacyPpfHoldings.map((holding) => (
        <PremiumCard
          elevated
          key={holding.asset.id}
          testID={`legacy-ppf-${holding.asset.id}`}
        >
          <AppText weight="bold">
            Move {holding.asset.name} to the PPF ledger
          </AppText>
          <AppText color="secondary" variant="caption">
            This older holding uses market-style fields. Linking it
            preserves the original record for audit and replaces it in
            portfolio totals with the confirmed account balance.
          </AppText>
          {onAddPpfAccount ? (
            <AppButton
              onPress={() =>
                onAddPpfAccount({
                  assetId: holding.asset.id,
                  name: holding.asset.name,
                })
              }
              testID={`convert-legacy-ppf-${holding.asset.id}`}
              title="Set up PPF account"
              variant="secondary"
            />
          ) : null}
        </PremiumCard>
      ))}
      {ppfHoldingRows}
    </View>
  );
}

/** EPF accounts with their recorded balances. */
export function EpfAccountsSection({
  epfState,
  epfSummary,
  maskWealthValues,
  onAddEpfAccount,
  onReviewEpfAccount,
}: {
  epfState: PortfolioStoreState["epf"];
  epfSummary: ReturnType<typeof summarizeEpfForReporting>;
  maskWealthValues: boolean;
  onAddEpfAccount?: () => void;
  onReviewEpfAccount?: (accountId: string) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.ppfSection} testID="holdings-epf-section">
      <View style={styles.sectionActionHeader}>
        <SectionHeader title="EPF accounts" />
        {onAddEpfAccount ? (
          <AppButton onPress={onAddEpfAccount} testID="add-epf-account" title="Add account" variant="secondary" />
        ) : null}
      </View>
      <View style={styles.epfTotalRow} testID="holdings-epf-total">
        <AppText color="secondary">Recorded EPF · in Debt</AppText>
        {epfSummary.value === null ? (
          <AppText weight="bold">Unavailable</AppText>
        ) : (
          <MaskedValue exactValue={formatINR(epfSummary.value)} masked={maskWealthValues}
            testID="holdings-epf-total-value" value={formatCompactINR(epfSummary.value)} weight="bold" />
        )}
      </View>
      {epfState.accounts.map((account) => {
        const value = epfSummary.accounts.find((item) => item.accountId === account.id);
        return (
          <Pressable
            accessibilityLabel={`Open ${account.nickname}`}
            accessibilityRole="button"
            key={account.id}
            onPress={() => onReviewEpfAccount?.(account.id)}
            style={({ pressed }) => [styles.ppfAccountCard, getPressedStateStyle({ pressed })]}
            testID={`epf-account-${account.id}`}
          >
            <CategoryIcon assetClass="debt" size={22} />
            <View style={styles.flex}>
              <AppText weight="bold">{account.nickname}</AppText>
              <AppText color="secondary" variant="caption">
                {[account.employerLabel ?? epfProviderLabel(account.provider),
                  account.status === "active" ? null : epfStatusLabel(account.status)].filter(Boolean).join(" · ")}
              </AppText>
            </View>
            <View style={styles.ppfValue}>
              {value ? (
                <MaskedValue exactValue={formatINR(value.balance.total)} masked={maskWealthValues}
                  value={formatCompactINR(value.balance.total)} weight="bold" />
              ) : (
                <AppText weight="bold">Unavailable</AppText>
              )}
              <AppText color="secondary" variant="caption">
                {value ? `As of ${formatDate(value.lastEvidenceDate)}` : "Needs review"}
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
