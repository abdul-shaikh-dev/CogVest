import { useState, useSyncExternalStore } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  CategoryIcon,
  EmptyState,
  IconButton,
  MaskedValue,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SensitiveValueReveal,
  SectionHeader,
  getPressedStateStyle,
  getAdaptiveLayoutMode,
  useSensitiveValueReveal,
} from "@/src/components/common";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import {
  formatCompactINR,
  formatDate,
  formatINR,
} from "@/src/domain/formatters";
import {
  calculatePpfAccountSummary,
  comparePpfLedgerEntries,
} from "@/src/domain/ppf";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import type { PpfAccount } from "@/src/types";

import { Detail, Metric } from "./PpfAccountDetails";
import { PpfAccountForm } from "./PpfAccountForm";
import { useStyles } from "./ppfAccountStyles";
import { entryLabel, statusLabel } from "./ppfAccountViewModel";

type PpfAccountScreenProps = {
  accountId?: string;
  legacyAssetId?: string;
  legacyName?: string;
  now?: Date;
  onBack: () => void;
  onContinuePortfolioSetup?: () => void;
  onImport?: (accountId: string) => void;
  onComplete: (accountId: string) => void;
  onEntry: (accountId: string, entryId?: string) => void;
  store?: StoreApi<PortfolioStoreState>;
};

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function PpfAccountScreen({
  accountId,
  legacyAssetId,
  legacyName,
  now = new Date(),
  onBack,
  onContinuePortfolioSetup,
  onImport,
  onComplete,
  onEntry,
  store = getPortfolioStore(),
}: PpfAccountScreenProps) {
  const styles = useStyles();
  const snapshot = usePortfolioSnapshot(store);
  const { fontScale, width } = useWindowDimensions();
  const stackRows = width < 360 || getAdaptiveLayoutMode(fontScale) !== "standard";
  const [savedAccountId, setSavedAccountId] = useState<string>();
  const resolvedAccountId = accountId ?? savedAccountId;
  const existing = snapshot.ppfAccounts.find(
    (account) => account.id === resolvedAccountId,
  );
  const [isEditing, setIsEditing] = useState(!existing);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const { isRevealed, reveal } = useSensitiveValueReveal(
    snapshot.preferences.maskWealthValues,
  );

  if (accountId && !existing) {
    return (
      <ScreenContainer testID="ppf-account-screen">
        <EmptyState
          actionLabel="Back to Holdings"
          message="It may have already been removed on another screen."
          onAction={onBack}
          title="PPF account unavailable"
        />
      </ScreenContainer>
    );
  }

  if (isEditing) {
    if (existing && !isRevealed) {
      return (
        <ScreenContainer testID="ppf-account-form-screen">
          <View style={styles.content}>
            <ScreenHeader
              title="Edit PPF account"
              subtitle={`${existing.nickname} · values masked`}
            />
            <PremiumCard>
              <SensitiveValueReveal
                onReveal={reveal}
                testID="reveal-ppf-account"
              />
            </PremiumCard>
            <AppButton
              onPress={() => setIsEditing(false)}
              title="Back"
              variant="secondary"
            />
          </View>
        </ScreenContainer>
      );
    }

    return (
      <PpfAccountForm
        key={existing?.id ?? "new"}
        account={existing}
        legacyAssetId={legacyAssetId}
        legacyName={legacyName}
        now={now}
        onBack={() => (existing ? setIsEditing(false) : onBack())}
        onComplete={(savedId) => {
          setSavedAccountId(savedId);
          setIsEditing(false);
          onComplete(savedId);
        }}
        store={store}
      />
    );
  }

  const account = existing as PpfAccount;
  const entries = snapshot.ppfLedgerEntries.filter(
    (entry) => entry.accountId === account.id,
  );
  const summary = calculatePpfAccountSummary({
    account,
    asOf: formatLocalCalendarDate(now),
    entries,
  });
  const masked = snapshot.preferences.maskWealthValues;
  const hasCompletedEstimatePeriod =
    summary.estimatedInterest.status === "available" &&
    summary.estimatedInterest.estimatedThrough >
      summary.estimatedInterest.estimatedFrom;

  return (
    <ScreenContainer scroll testID="ppf-account-screen">
      <View style={styles.content}>
        <ScreenHeader
          action={
            <IconButton
              accessibilityLabel="Edit PPF account"
              icon="create-outline"
              onPress={() => setIsEditing(true)}
              testID="edit-ppf-account"
            />
          }
          leading={
            <IconButton
              accessibilityLabel="Back to Holdings"
              icon="arrow-back"
              onPress={onBack}
              testID="ppf-account-back"
            />
          }
          subtitle={`${account.provider} • ${statusLabel(account.status)}`}
          title={account.nickname}
        />

        <PremiumCard section style={styles.balanceCard} testID="ppf-confirmed-balance-card">
          <View style={styles.balanceHeading}>
            <CategoryIcon assetClass="debt" size={22} />
            <AppText color="secondary">Confirmed balance</AppText>
          </View>
          <MaskedValue
            masked={masked}
            style={styles.balanceValue}
            value={formatINR(summary.confirmedBalance)}
            weight="bold"
          />
          <AppText color="secondary" variant="caption">
            Ledger applied through {formatDate(summary.ledgerAppliedThrough)} • official records remain authoritative
          </AppText>
        </PremiumCard>

        <View style={[styles.metricRow, stackRows && styles.stacked]}>
          <Metric
            label={`Contributed FY ${summary.contributionContext.financialYearStart}-${String(summary.contributionContext.financialYearStart + 1).slice(-2)}`}
            masked={masked}
            value={formatCompactINR(summary.contributionContext.financialYearContributions)}
          />
          <Metric
            label="Remaining tracked capacity"
            masked={masked}
            value={formatCompactINR(summary.contributionContext.remainingTrackedCapacity)}
          />
        </View>
        <AppText color="secondary" variant="caption">
          Capacity uses only PPF contributions recorded in CogVest. It is context, not a contribution recommendation.
        </AppText>

        <View style={styles.sectionHeading} testID="ppf-ledger-actions">
          <SectionHeader title="Ledger" />
          <View style={styles.ledgerActions}>
            <AppButton
              onPress={() => onEntry(account.id)}
              testID="add-ppf-entry"
              title="Add entry"
              variant="secondary"
            />
            {onImport ? (
              <AppButton
                title="Import CSV"
                variant="secondary"
                testID="ppf-import-csv"
                onPress={() => onImport(account.id)}
              />
            ) : null}
          </View>
        </View>
        {entries.length === 0 ? (
          <PremiumCard>
            <AppText weight="bold">No ledger entries yet</AppText>
            <AppText color="secondary" variant="caption">
              Record contributions, official interest, withdrawals, or a passbook balance correction.
            </AppText>
          </PremiumCard>
        ) : (
          <PremiumCard section testID="ppf-ledger-list">
            {[...entries]
              .sort((left, right) => comparePpfLedgerEntries(right, left))
              .map((entry, index) => (
                <Pressable
                  accessibilityRole="button"
                  key={entry.id}
                  onPress={() => onEntry(account.id, entry.id)}
                  style={({ pressed }) => [
                    styles.ledgerRow,
                    stackRows && styles.stacked,
                    index < entries.length - 1 && styles.separator,
                    getPressedStateStyle({ pressed }),
                  ]}
                  testID={`ppf-ledger-entry-${entry.id}`}
                >
                  <View style={[styles.flex, stackRows && styles.intrinsic]}>
                    <AppText weight="bold">{entryLabel(entry.type)}</AppText>
                    <AppText color="secondary" variant="caption">
                      {formatDate(entry.date)}
                    </AppText>
                  </View>
                  <MaskedValue
                    masked={masked}
                    value={
                      entry.type === "reconciliation"
                        ? formatINR(entry.confirmedBalance)
                        : `${entry.type === "withdrawal" ? "-" : "+"}${formatINR(entry.amount)}`
                    }
                    weight="bold"
                  />
                </Pressable>
              ))}
          </PremiumCard>
        )}

        <PremiumCard section testID="ppf-interest-card">
          <SectionHeader title="Interest" />
          <View style={[styles.detailRow, stackRows && styles.stacked]}>
            <AppText color="secondary">Officially credited</AppText>
            <MaskedValue masked={masked} value={formatINR(summary.officialInterestEarned)} weight="bold" />
          </View>
          <View style={styles.separator} />
          <View style={[styles.detailRow, stackRows && styles.stacked]}>
            <View style={[styles.flex, stackRows && styles.intrinsic]}>
              <AppText color="secondary">Estimated, not credited</AppText>
              <AppText color="secondary" variant="caption">
                {summary.estimatedInterest.status === "available"
                  ? hasCompletedEstimatePeriod
                    ? `Through ${formatDate(summary.estimatedInterest.estimatedThrough)}`
                    : "No completed estimate period yet"
                  : `Rate unavailable for ${summary.estimatedInterest.missingMonth}`}
              </AppText>
            </View>
            <MaskedValue
              masked={
                masked &&
                summary.estimatedInterest.status === "available" &&
                hasCompletedEstimatePeriod
              }
              value={
                summary.estimatedInterest.status === "available"
                  ? hasCompletedEstimatePeriod
                    ? formatINR(summary.estimatedInterest.amount)
                    : "Not available yet"
                  : "Unavailable"
              }
              weight="bold"
            />
          </View>
          <AppText color="secondary" variant="caption">
            Your starting balance may include historic interest. CogVest cannot
            infer a lifetime gain percentage from it.
          </AppText>
        </PremiumCard>

        <PremiumCard section>
          <SectionHeader title="Account timeline" />
          <Detail label="Status" value={statusLabel(account.status)} />
          <Detail label="Maturity" value={formatDate(summary.maturityDate)} />
          {summary.extensionEndDate ? (
            <Detail
              label={
                account.status === "extendedWithContributions"
                  ? "Current extension ends"
                  : "Last contribution extension ended"
              }
              value={formatDate(summary.extensionEndDate)}
            />
          ) : null}
          {account.accountNumberSuffix ? (
            <Detail label="Account" value={`••${account.accountNumberSuffix}`} />
          ) : null}
          <AppText color="secondary" variant="caption">
            Dates are informational and derived from the opening financial year you confirmed.
          </AppText>
        </PremiumCard>

        {isConfirmingDelete ? (
          <PremiumCard testID="delete-ppf-confirmation">
            <AppText weight="bold">Delete this PPF account?</AppText>
            <AppText color="secondary" variant="caption">
              This permanently removes the account and all its local ledger entries.
            </AppText>
            <View style={styles.actions}>
              <AppButton
                onPress={() => {
                  const result = store.getState().deletePpfAccount(account.id);
                  if (result.status === "applied") onBack();
                }}
                testID="confirm-delete-ppf-account"
                title="Delete account"
                variant="destructive"
              />
              <AppButton
                onPress={() => setIsConfirmingDelete(false)}
                title="Keep account"
                variant="secondary"
              />
            </View>
          </PremiumCard>
        ) : (
          <AppButton
            onPress={() => setIsConfirmingDelete(true)}
            testID="delete-ppf-account"
            title="Delete PPF account"
            variant="ghost"
          />
        )}
        {onContinuePortfolioSetup ? (
          <AppButton
            onPress={onContinuePortfolioSetup}
            testID="continue-portfolio-setup"
            title="Continue portfolio setup"
            variant="secondary"
          />
        ) : null}
      </View>
    </ScreenContainer>
  );
}
