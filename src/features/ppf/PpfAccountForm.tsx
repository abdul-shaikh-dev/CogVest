import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  findNodeHandle,
  KeyboardAvoidingView,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  IconButton,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import {
  DatePickerField,
  FormTextField,
  SelectionField,
} from "@/src/components/forms";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { formatDate, formatINR } from "@/src/domain/formatters";
import { getFinancialYearStart, validatePpfAccount } from "@/src/domain/ppf";
import type { PortfolioStoreState } from "@/src/store";
import { spacing } from "@/src/theme";
import type { PpfAccount, PpfAccountStatus } from "@/src/types";
import { createId } from "@/src/utils";

import { Detail } from "./PpfAccountDetails";
import { useStyles } from "./ppfAccountStyles";
import {
  ppfAccountErrorFields,
  type PpfAccountField,
  type PpfFormSection,
  statusLabel,
  statusOptions,
} from "./ppfAccountViewModel";

export function PpfAccountForm({
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
  const styles = useStyles();
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
  const [confirmExit, setConfirmExit] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<PpfAccountField, string>>>({});
  const scrollRef = useRef<ScrollView>(null);
  const inputRefs = useRef<Partial<Record<PpfAccountField, TextInput | null>>>({});
  const controlRefs = useRef<Partial<Record<PpfAccountField, View | null>>>({});
  const sectionY = useRef<Partial<Record<PpfFormSection, number>>>({});
  const fieldLayout = useRef<Partial<Record<PpfAccountField, { section: PpfFormSection; y: number }>>>({});

  const isDirty =
    nickname !== (account?.nickname ?? legacyName ?? "My PPF") ||
    provider !== (account?.provider ?? "") ||
    suffix !== (account?.accountNumberSuffix ?? "") ||
    openingMode !== (account?.opening.kind ?? "financialYear") ||
    openedOn !== (account?.opening.kind === "date" ? account.opening.openedOn : "") ||
    openingFinancialYear !== String(account?.opening.kind === "financialYear" ? account.opening.financialYearStart : currentFinancialYear) ||
    balance !== (account ? String(account.confirmedBalance) : "") ||
    balanceAsOf !== (account?.balanceAsOf ?? formatLocalCalendarDate(now)) ||
    fyContributions !== (account?.baselineFinancialYearContributions ? String(account.baselineFinancialYearContributions.amount) : "") ||
    status !== (account?.status ?? "active") ||
    extensionYear !== (account?.confirmedExtensionStartFinancialYear ? String(account.confirmedExtensionStartFinancialYear) : "");

  function requestBack() {
    if (reviewAccount) {
      setReviewAccount(undefined);
      return;
    }
    if (confirmExit) {
      setConfirmExit(false);
      return;
    }
    if (isDirty) {
      setConfirmExit(true);
      return;
    }
    onBack();
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      requestBack();
      return true;
    });
    return () => subscription.remove();
  }, [confirmExit, isDirty, reviewAccount]);

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

  if (confirmExit) {
    return (
      <ScreenContainer scroll testID="ppf-account-exit-confirmation">
        <View style={styles.content}>
          <ScreenHeader title="Discard account changes?" subtitle="Your unsaved edits will be lost" />
          <PremiumCard>
            <AppText color="secondary">Return to the populated editor or discard these unsaved changes.</AppText>
          </PremiumCard>
          <View style={styles.actions}>
            <AppButton onPress={() => setConfirmExit(false)} testID="keep-editing-ppf-account" title="Keep editing" />
            <AppButton onPress={onBack} testID="discard-ppf-account" title="Discard changes" variant="destructive" />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (reviewAccount) {
    const candidate = reviewAccount;
    return (
      <ScreenContainer scroll testID="ppf-account-review-screen">
        <View style={styles.content}>
          <ScreenHeader
            leading={<IconButton accessibilityLabel="Back to account editor" icon="arrow-back" onPress={() => setReviewAccount(undefined)} />}
            title="Review PPF account"
          />
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
            CogVest starts tracking from this balance. It does not rebuild earlier contributions or interest.
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
            <AppButton onPress={() => setReviewAccount(undefined)} testID="edit-ppf-account-details" title="Edit details" variant="secondary" />
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
          leading={<IconButton accessibilityLabel="Back" icon="arrow-back" onPress={requestBack} />}
          subtitle="Start with a confirmed balance"
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
            <PremiumCard section style={styles.formSection}>
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
            </PremiumCard>
          </View>
          <View
            onLayout={(event) => {
              sectionY.current.baseline = event.nativeEvent.layout.y;
            }}
          >
            <PremiumCard section style={styles.formSection}>
              <SectionHeader title="Starting balance" />
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
          <View
            onLayout={(event) => {
              sectionY.current.opening = event.nativeEvent.layout.y;
            }}
          >
            <PremiumCard section style={styles.formSection}>
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
              sectionY.current.identification = event.nativeEvent.layout.y;
            }}
            testID="ppf-identification-section"
          >
            <PremiumCard section style={styles.formSection}>
              <SectionHeader title="Optional identification" />
              <View
                onLayout={(event) =>
                  recordFieldLayout("suffix", "identification", event.nativeEvent.layout.y)
                }
                testID="ppf-suffix-field"
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
          <AppButton onPress={requestBack} title="Cancel" variant="secondary" />
        </View>
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}
