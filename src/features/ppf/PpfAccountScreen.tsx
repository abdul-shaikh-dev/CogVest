import { useRef, useState, useSyncExternalStore } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
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
  SectionHeader,
  getPressedStateStyle,
} from "@/src/components/common";
import {
  DatePickerField,
  FormTextField,
  SelectionField,
} from "@/src/components/forms";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { formatCompactINR, formatDate, formatINR } from "@/src/domain/formatters";
import {
  calculatePpfAccountSummary,
  comparePpfLedgerEntries,
  getFinancialYearStart,
  validatePpfAccount,
} from "@/src/domain/ppf";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, interaction, spacing } from "@/src/theme";
import type { PpfAccount, PpfAccountStatus } from "@/src/types";
import { createId } from "@/src/utils";

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

const statusOptions: Array<{ label: string; value: PpfAccountStatus }> = [
  { label: "Active", value: "active" },
  { label: "Discontinued", value: "discontinued" },
  { label: "Matured", value: "matured" },
  { label: "Extended with contributions", value: "extendedWithContributions" },
  { label: "Continued without contributions", value: "continuedWithoutContributions" },
];

type PpfAccountField =
  | "nickname"
  | "provider"
  | "suffix"
  | "openedOn"
  | "openingFinancialYear"
  | "extensionYear"
  | "balance"
  | "balanceAsOf"
  | "fyContributions";

type PpfFormSection = "account" | "opening" | "baseline";

const ppfAccountErrorFields: Record<string, PpfAccountField> = {
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

function statusLabel(status: PpfAccountStatus) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

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
  const snapshot = usePortfolioSnapshot(store);
  const [savedAccountId, setSavedAccountId] = useState<string>();
  const resolvedAccountId = accountId ?? savedAccountId;
  const existing = snapshot.ppfAccounts.find(
    (account) => account.id === resolvedAccountId,
  );
  const [isEditing, setIsEditing] = useState(!existing);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

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

        <PremiumCard style={styles.balanceCard} testID="ppf-confirmed-balance-card">
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

        <View style={styles.metricRow}>
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
          <PremiumCard testID="ppf-ledger-list">
            {[...entries]
              .sort((left, right) => comparePpfLedgerEntries(right, left))
              .map((entry, index) => (
                <Pressable
                  accessibilityRole="button"
                  key={entry.id}
                  onPress={() => onEntry(account.id, entry.id)}
                  style={({ pressed }) => [
                    styles.ledgerRow,
                    index < entries.length - 1 && styles.separator,
                    getPressedStateStyle({ pressed }),
                  ]}
                  testID={`ppf-ledger-entry-${entry.id}`}
                >
                  <View style={styles.flex}>
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

        <PremiumCard testID="ppf-interest-card">
          <SectionHeader title="Interest" />
          <View style={styles.detailRow}>
            <AppText color="secondary">Officially credited</AppText>
            <MaskedValue masked={masked} value={formatINR(summary.officialInterestEarned)} weight="bold" />
          </View>
          <View style={styles.separator} />
          <View style={styles.detailRow}>
            <View style={styles.flex}>
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

        <PremiumCard>
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

function PpfAccountForm({
  account,
  legacyAssetId,
  legacyName,
  now,
  onBack,
  onComplete,
  store,
}: {
  account?: PpfAccount;
  legacyAssetId?: string;
  legacyName?: string;
  now: Date;
  onBack: () => void;
  onComplete: (accountId: string) => void;
  store: StoreApi<PortfolioStoreState>;
}) {
  const currentFinancialYear = getFinancialYearStart(now);
  const [nickname, setNickname] = useState(account?.nickname ?? legacyName ?? "My PPF");
  const [provider, setProvider] = useState(account?.provider ?? "");
  const [suffix, setSuffix] = useState(account?.accountNumberSuffix ?? "");
  const [openingMode, setOpeningMode] = useState<"date" | "financialYear">(
    account?.opening.kind ?? "financialYear",
  );
  const [openedOn, setOpenedOn] = useState(
    account?.opening.kind === "date" ? account.opening.openedOn : "",
  );
  const [openingFinancialYear, setOpeningFinancialYear] = useState(
    String(
      account?.opening.kind === "financialYear"
        ? account.opening.financialYearStart
        : currentFinancialYear,
    ),
  );
  const [balance, setBalance] = useState(account ? String(account.confirmedBalance) : "");
  const [balanceAsOf, setBalanceAsOf] = useState(
    account?.balanceAsOf ?? formatLocalCalendarDate(now),
  );
  const [fyContributions, setFyContributions] = useState(
    account?.baselineFinancialYearContributions
      ? String(account.baselineFinancialYearContributions.amount)
      : "",
  );
  const [status, setStatus] = useState<PpfAccountStatus>(account?.status ?? "active");
  const [extensionYear, setExtensionYear] = useState(
    account?.confirmedExtensionStartFinancialYear
      ? String(account.confirmedExtensionStartFinancialYear)
      : "",
  );
  const [reviewAccount, setReviewAccount] = useState<PpfAccount>();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<PpfAccountField, string>>>({});
  const scrollRef = useRef<ScrollView>(null);
  const inputRefs = useRef<Partial<Record<PpfAccountField, TextInput | null>>>({});
  const controlRefs = useRef<Partial<Record<PpfAccountField, View | null>>>({});
  const sectionY = useRef<Partial<Record<PpfFormSection, number>>>({});
  const fieldLayout = useRef<Partial<Record<PpfAccountField, { section: PpfFormSection; y: number }>>>({});

  function clearFieldError(field: PpfAccountField) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function recordFieldLayout(field: PpfAccountField, section: PpfFormSection, y: number) {
    fieldLayout.current[field] = { section, y };
  }

  function revealField(field: PpfAccountField) {
    requestAnimationFrame(() => {
      const input = inputRefs.current[field];
      if (input) {
        input.focus();
      } else {
        const handle = findNodeHandle(controlRefs.current[field] ?? null);
        if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
      }
      const layout = fieldLayout.current[field];
      const sectionOffset = layout ? sectionY.current[layout.section] : undefined;
      if (layout && sectionOffset !== undefined) {
        scrollRef.current?.scrollTo({
          animated: true,
          y: Math.max(0, sectionOffset + layout.y - spacing.md),
        });
      }
    });
  }

  function buildAccount(): PpfAccount | null {
    const parsedBalance = Number(balance);
    const parsedOpeningYear = Number(openingFinancialYear);
    const parsedContribution = fyContributions.trim() ? Number(fyContributions) : undefined;
    const parsedExtensionYear = extensionYear.trim() ? Number(extensionYear) : undefined;
    const candidate: PpfAccount = {
      balanceAsOf,
      confirmedBalance: parsedBalance,
      createdAt: account?.createdAt ?? now.toISOString(),
      id: account?.id ?? createId("ppf"),
      ...(account?.legacyAssetId || legacyAssetId
        ? { legacyAssetId: account?.legacyAssetId ?? legacyAssetId }
        : {}),
      nickname: nickname.trim(),
      opening:
        openingMode === "date"
          ? { kind: "date", openedOn }
          : { financialYearStart: parsedOpeningYear, kind: "financialYear" },
      provider: provider.trim(),
      status,
      ...(suffix.trim() ? { accountNumberSuffix: suffix.trim() } : {}),
      ...(parsedContribution === undefined
        ? {}
        : {
            baselineFinancialYearContributions: {
              amount: parsedContribution,
              financialYearStart: getFinancialYearStart(balanceAsOf),
            },
          }),
      ...(status === "active" || parsedExtensionYear === undefined
        ? {}
        : { confirmedExtensionStartFinancialYear: parsedExtensionYear }),
    };
    const validation = validatePpfAccount(candidate, now);
    if (!validation.isValid) {
      const nextFieldErrors: Partial<Record<PpfAccountField, string>> = {};
      for (const message of validation.errors) {
        const field = ppfAccountErrorFields[message];
        if (field && !nextFieldErrors[field]) nextFieldErrors[field] = message;
      }
      const firstField = validation.errors
        .map((message) => ppfAccountErrorFields[message])
        .find((field): field is PpfAccountField => Boolean(field));
      const globalError = validation.errors.find((message) => !ppfAccountErrorFields[message]);
      setFieldErrors(nextFieldErrors);
      setError(globalError ?? "");
      if (firstField) revealField(firstField);
      return null;
    }
    return candidate;
  }

  if (reviewAccount) {
    const candidate = reviewAccount;
    return (
      <ScreenContainer scroll testID="ppf-account-review-screen">
        <View style={styles.content}>
          <ScreenHeader title="Review PPF account" subtitle="Confirm before saving • local only" />
          <PremiumCard>
            <SectionHeader title={candidate.nickname} />
            <Detail label="Provider" value={candidate.provider} />
            <Detail label="Confirmed balance" value={formatINR(candidate.confirmedBalance)} />
            <Detail label="Balance as of" value={formatDate(candidate.balanceAsOf)} />
            <Detail label="Status" value={statusLabel(candidate.status)} />
            <Detail
              label="Opening"
              value={
                candidate.opening.kind === "date"
                  ? formatDate(candidate.opening.openedOn)
                  : `FY ${candidate.opening.financialYearStart}-${String(candidate.opening.financialYearStart + 1).slice(-2)}`
              }
            />
          </PremiumCard>
          <AppText color="secondary" variant="caption">
            This balance becomes CogVest's confirmed baseline. Earlier contributions and interest are not reconstructed.
          </AppText>
          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          <View style={styles.actions}>
            <AppButton
              onPress={() => {
                const result = account
                  ? store.getState().correctPpfAccount(candidate)
                  : store.getState().addPpfAccount(candidate);
                if (result.status === "applied" || result.status === "alreadyApplied") {
                  onComplete(candidate.id);
                } else {
                  setError("CogVest could not save this PPF account safely.");
                }
              }}
              testID="save-ppf-account"
              title="Save PPF account"
            />
            <AppButton onPress={() => setReviewAccount(undefined)} title="Edit details" variant="secondary" />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <KeyboardAvoidingView behavior="height" style={styles.flex}>
      <ScreenContainer scroll scrollRef={scrollRef} testID="ppf-account-form-screen">
        <View style={styles.content}>
        <ScreenHeader
          leading={<IconButton accessibilityLabel="Back" icon="arrow-back" onPress={onBack} />}
          subtitle="Confirmed balance • local only"
          title={account ? "Edit PPF account" : "Add PPF account"}
        />
        {legacyName ? (
          <PremiumCard elevated>
            <AppText weight="bold">Move away from holding fields</AppText>
            <AppText color="secondary" variant="caption">
              Your existing record will remain stored for audit but will be excluded from portfolio totals once this account is saved.
            </AppText>
          </PremiumCard>
        ) : null}
          <View
            onLayout={(event) => {
              sectionY.current.account = event.nativeEvent.layout.y;
            }}
            testID="ppf-account-section"
          >
            <PremiumCard>
              <SectionHeader title="Account" />
              <View
                onLayout={(event) =>
                  recordFieldLayout("nickname", "account", event.nativeEvent.layout.y)
                }
              >
                <FormTextField
                  error={fieldErrors.nickname}
                  inputRef={(node) => {
                    inputRefs.current.nickname = node;
                  }}
                  label="Account nickname"
                  onChangeText={(value) => {
                    setNickname(value);
                    clearFieldError("nickname");
                  }}
                  testID="ppf-nickname-input"
                  value={nickname}
                />
              </View>
              <View
                onLayout={(event) =>
                  recordFieldLayout("provider", "account", event.nativeEvent.layout.y)
                }
                testID="ppf-provider-field"
              >
                <FormTextField
                  error={fieldErrors.provider}
                  inputRef={(node) => {
                    inputRefs.current.provider = node;
                  }}
                  label="Bank or Post Office"
                  onChangeText={(value) => {
                    setProvider(value);
                    clearFieldError("provider");
                  }}
                  placeholder="India Post"
                  testID="ppf-provider-input"
                  value={provider}
                />
              </View>
              <View
                onLayout={(event) =>
                  recordFieldLayout("suffix", "account", event.nativeEvent.layout.y)
                }
              >
                <FormTextField
                  error={fieldErrors.suffix}
                  inputRef={(node) => {
                    inputRefs.current.suffix = node;
                  }}
                  keyboardType="number-pad"
                  label="Account suffix (optional)"
                  onChangeText={(value) => {
                    setSuffix(value);
                    clearFieldError("suffix");
                  }}
                  placeholder="Last 2 to 4 digits"
                  testID="ppf-suffix-input"
                  value={suffix}
                />
              </View>
            </PremiumCard>
          </View>
          <View
            onLayout={(event) => {
              sectionY.current.opening = event.nativeEvent.layout.y;
            }}
          >
            <PremiumCard>
          <SectionHeader title="Opening and status" />
          <SelectionField
            label="Opening information"
            onChange={setOpeningMode}
            options={[
              { label: "I know the opening financial year", value: "financialYear" },
              { label: "I know the exact opening date", value: "date" },
            ]}
            testIDPrefix="ppf-opening-mode"
            value={openingMode}
          />
              {openingMode === "date" ? (
                <View onLayout={(event) => recordFieldLayout("openedOn", "opening", event.nativeEvent.layout.y)}>
                  <DatePickerField
                    error={fieldErrors.openedOn}
                    fieldRef={(node) => {
                      controlRefs.current.openedOn = node;
                    }}
                    label="Opening date"
                    onChange={(value) => {
                      setOpenedOn(value);
                      clearFieldError("openedOn");
                    }}
                    testID="ppf-opening-date"
                    value={openedOn}
                  />
                </View>
              ) : (
                <View onLayout={(event) => recordFieldLayout("openingFinancialYear", "opening", event.nativeEvent.layout.y)}>
                  <FormTextField
                    error={fieldErrors.openingFinancialYear}
                    inputRef={(node) => {
                      inputRefs.current.openingFinancialYear = node;
                    }}
                    keyboardType="number-pad"
                    label="Opening financial year"
                    onChangeText={(value) => {
                      setOpeningFinancialYear(value);
                      clearFieldError("openingFinancialYear");
                    }}
                    placeholder="2020"
                    testID="ppf-opening-fy-input"
                    value={openingFinancialYear}
                  />
                </View>
              )}
          <SelectionField label="Account status" onChange={setStatus} options={statusOptions} testIDPrefix="ppf-status" value={status} />
              {status === "extendedWithContributions" ? (
                <View onLayout={(event) => recordFieldLayout("extensionYear", "opening", event.nativeEvent.layout.y)}>
                  <FormTextField
                    error={fieldErrors.extensionYear}
                    inputRef={(node) => {
                      inputRefs.current.extensionYear = node;
                    }}
                    keyboardType="number-pad"
                    label="Extension start financial year"
                    onChangeText={(value) => {
                      setExtensionYear(value);
                      clearFieldError("extensionYear");
                    }}
                    placeholder="2036"
                    testID="ppf-extension-fy-input"
                    value={extensionYear}
                  />
                </View>
              ) : null}
            </PremiumCard>
          </View>
          <View
            onLayout={(event) => {
              sectionY.current.baseline = event.nativeEvent.layout.y;
            }}
          >
            <PremiumCard>
              <SectionHeader title="Confirmed baseline" />
              <View onLayout={(event) => recordFieldLayout("balance", "baseline", event.nativeEvent.layout.y)}>
                <FormTextField
                  error={fieldErrors.balance}
                  inputRef={(node) => {
                    inputRefs.current.balance = node;
                  }}
                  keyboardType="decimal-pad"
                  label="Confirmed balance (INR)"
                  onChangeText={(value) => {
                    setBalance(value);
                    clearFieldError("balance");
                  }}
                  testID="ppf-balance-input"
                  value={balance}
                />
              </View>
              <View onLayout={(event) => recordFieldLayout("balanceAsOf", "baseline", event.nativeEvent.layout.y)}>
                <DatePickerField
                  error={fieldErrors.balanceAsOf}
                  fieldRef={(node) => {
                    controlRefs.current.balanceAsOf = node;
                  }}
                  label="Balance confirmed on"
                  onChange={(value) => {
                    setBalanceAsOf(value);
                    clearFieldError("balanceAsOf");
                  }}
                  testID="ppf-balance-date"
                  value={balanceAsOf}
                />
              </View>
              <View onLayout={(event) => recordFieldLayout("fyContributions", "baseline", event.nativeEvent.layout.y)}>
                <FormTextField
                  error={fieldErrors.fyContributions}
                  inputRef={(node) => {
                    inputRefs.current.fyContributions = node;
                  }}
                  keyboardType="decimal-pad"
                  label="Contributed this financial year (optional)"
                  onChangeText={(value) => {
                    setFyContributions(value);
                    clearFieldError("fyContributions");
                  }}
                  testID="ppf-fy-contribution-input"
                  value={fyContributions}
                />
              </View>
          <AppText color="secondary" variant="caption">
            Enter only the amount already included in this confirmed balance. No transaction dates will be invented.
          </AppText>
            </PremiumCard>
          </View>
        {error ? <AppText selectable style={styles.error}>{error}</AppText> : null}
        <View style={styles.actions}>
          <AppButton
            onPress={() => {
              setError("");
              const candidate = buildAccount();
              if (candidate) setReviewAccount(candidate);
            }}
            testID="review-ppf-account"
            title="Review account"
          />
          <AppButton onPress={onBack} title="Cancel" variant="secondary" />
        </View>
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

function Metric({ label, masked, value }: { label: string; masked: boolean; value: string }) {
  return (
    <PremiumCard style={styles.metric}>
      <AppText color="secondary" variant="caption">{label}</AppText>
      <MaskedValue masked={masked} value={value} weight="bold" />
    </PremiumCard>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <AppText color="secondary">{label}</AppText>
      <AppText style={styles.detailValue} weight="bold">{value}</AppText>
    </View>
  );
}

function entryLabel(type: "contribution" | "interestCredit" | "withdrawal" | "reconciliation") {
  if (type === "interestCredit") return "Official interest";
  if (type === "reconciliation") return "Balance correction";
  return type === "contribution" ? "Contribution" : "Withdrawal";
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  balanceCard: { gap: spacing.sm },
  balanceHeading: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  balanceValue: { fontSize: 34 },
  content: { gap: spacing.cardGap, paddingTop: spacing.sm },
  detailRow: { alignItems: "center", flexDirection: "row", gap: spacing.md, justifyContent: "space-between", minHeight: interaction.minimumTouchTarget },
  detailValue: { flex: 1, textAlign: "right" },
  error: { color: colors.loss },
  flex: { flex: 1 },
  ledgerRow: { alignItems: "center", flexDirection: "row", gap: spacing.md, minHeight: 64, paddingVertical: spacing.sm },
  ledgerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metric: { flex: 1 },
  metricRow: { flexDirection: "row", gap: spacing.cardGap },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  separator: { borderBottomColor: colors.border.subtle, borderBottomWidth: StyleSheet.hairlineWidth },
});
