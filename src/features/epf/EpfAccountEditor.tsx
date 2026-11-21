import { useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  type ScrollViewInstance,
  type TextInputInstance,
  useWindowDimensions,
  View,
  type ViewInstance,
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
  getAdaptiveLayoutMode,
} from "@/src/components/common";
import { DatePickerField, FormTextField, SelectionField } from "@/src/components/forms";
import type { EpfAccount } from "@/src/domain/epf";
import { formatDate, formatINR } from "@/src/domain/formatters";
import { type PortfolioStoreState } from "@/src/store";
import { createId } from "@/src/utils";
import {
  buildEpfAccount,
  draftFromEpfAccount,
  draftTotal,
  emptyEpfAccountDraft,
  epfBalanceDateHint,
  epfEvidenceOptions,
  epfPassbookUrl,
  epfProviderLabel,
  epfProviderOptions,
  epfStatusLabel,
  epfStatusOptions,
  type EpfAccountDraft,
  type EpfAccountField,
  type EpfFieldErrors,
} from "./epfAccountForm";
import { useBackHandler } from "@/src/hooks";

import { applyEpfChange } from "./epfChange";
import { useStyles } from "./epfAccountStyles";

const fieldOrder: EpfAccountField[] = ["nickname", "employerLabel", "employee", "employer", "date"];

export function EpfAccountForm({ account, now, onBack, onComplete, onImportPassbooks, store }: {
  account?: EpfAccount;
  now: Date;
  onBack: () => void;
  onComplete: (accountId: string) => void;
  onImportPassbooks?: () => void;
  store: StoreApi<PortfolioStoreState>;
}) {
  const styles = useStyles();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the empty draft's date is fixed when the form opens.
  const initial = useMemo(() => (account ? draftFromEpfAccount(account) : emptyEpfAccountDraft(now)), [account]);
  const [draft, setDraft] = useState<EpfAccountDraft>(initial);
  const [errors, setErrors] = useState<EpfFieldErrors<EpfAccountField>>({});
  const [message, setMessage] = useState("");
  const [review, setReview] = useState<{ account: EpfAccount; commandId: string; revision: string }>();
  const [confirmExit, setConfirmExit] = useState(false);
  const [newId] = useState(() => createId("epf"));
  const scrollRef = useRef<ScrollViewInstance>(null);
  const inputRefs = useRef<Partial<Record<EpfAccountField, TextInputInstance | ViewInstance | null>>>({});
  const isDirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const total = draftTotal(draft);

  function requestBack() {
    if (review) { setReview(undefined); return; }
    if (confirmExit) { setConfirmExit(false); return; }
    if (isDirty) { setConfirmExit(true); return; }
    onBack();
  }

  useBackHandler(requestBack);

  function update<Key extends keyof EpfAccountDraft>(key: Key, value: EpfAccountDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key as EpfAccountField];
      return next;
    });
  }

  function submit() {
    setMessage("");
    const result = buildEpfAccount(draft, { existing: account, id: newId, now });
    if (!result.ok) {
      setErrors(result.errors);
      setMessage(result.message ?? "");
      const first = fieldOrder.find((field) => result.errors[field]);
      const target = first ? inputRefs.current[first] : undefined;
      if (target && "focus" in target) requestAnimationFrame(() => target.focus());
      return;
    }
    setReview({ account: result.account, commandId: createId("epf-save"), revision: store.getState().getBackupRevision() });
  }

  if (confirmExit) {
    return (
      <ScreenContainer scroll testID="epf-account-exit-confirmation">
        <View style={styles.content}>
          <ScreenHeader title="Discard account changes?" subtitle="Your unsaved edits will be lost" />
          <View style={styles.actions}>
            <AppButton onPress={() => setConfirmExit(false)} testID="keep-editing-epf-account" title="Keep editing" />
            <AppButton onPress={onBack} testID="discard-epf-account" title="Discard changes" variant="destructive" />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (review) {
    const candidate = review.account;
    const components = candidate.checkpoint.balance.components!;
    return (
      <ScreenContainer scroll testID="epf-account-review-screen">
        <View style={styles.content}>
          <ScreenHeader
            leading={<IconButton accessibilityLabel="Back to account editor" icon="arrow-back" onPress={() => setReview(undefined)} />}
            title="Review EPF account"
          />
          <PremiumCard>
            <SectionHeader title={candidate.nickname} />
            <ReviewDetail label="Provider" value={[epfProviderLabel(candidate.provider), candidate.employerLabel].filter(Boolean).join(" · ")} />
            <ReviewDetail label="Employee EPF" value={formatINR(components.employee)} />
            <ReviewDetail label="Employer EPF" value={formatINR(components.employer)} />
            <ReviewDetail label="Total EPF" testID="epf-review-total" value={formatINR(candidate.checkpoint.balance.total)} />
            <ReviewDetail label="Balance as of" value={formatDate(candidate.checkpoint.date)} />
            <ReviewDetail label="Status" value={epfStatusLabel(candidate.status)} />
          </PremiumCard>
          <AppText color="secondary" variant="caption">
            {candidate.checkpoint.capital === 0
              ? "Starting from ₹0, so the contributions you add count as invested capital. Interest counts as return."
              : "CogVest tracks EPF from this balance in Debt. Earlier contributions and interest are not rebuilt, and invested capital stays unknown."}
          </AppText>
          {message ? <AppText selectable style={styles.error} testID="epf-account-save-error">{message}</AppText> : null}
          <View style={styles.actions}>
            <AppButton
              onPress={() => {
                const failure = applyEpfChange(store, { commandId: review.commandId,
                  reason: account ? "Edit EPF account" : "Add EPF account",
                  change: { type: "accountPut", account: candidate } }, review.revision);
                if (failure) setMessage(failure);
                else onComplete(candidate.id);
              }}
              testID="save-epf-account"
              title="Save EPF account"
            />
            <AppButton onPress={() => setReview(undefined)} testID="edit-epf-account-details" title="Edit details" variant="secondary" />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <KeyboardAvoidingView behavior="height" style={styles.flex}>
      <ScreenContainer scroll scrollRef={scrollRef} testID="epf-account-form-screen">
        <View style={styles.content}>
          <ScreenHeader
            leading={<IconButton accessibilityLabel="Back" icon="arrow-back" onPress={requestBack} />}
            subtitle="Start with your latest statement balance"
            title={account ? "Edit EPF account" : "Add EPF account"}
          />
          {!account && onImportPassbooks ? (
            <AppButton onPress={onImportPassbooks} testID="import-epf-passbooks" title="Import EPFO passbooks instead"
              variant="secondary" />
          ) : null}
          <PremiumCard section style={styles.formSection}>
            <SectionHeader title="Account" />
            <FormTextField error={errors.nickname} inputRef={(node) => { inputRefs.current.nickname = node; }}
              label="Account nickname" onChangeText={(value) => update("nickname", value)}
              placeholder="Acme EPF" testID="epf-nickname-input" value={draft.nickname} />
            <SelectionField label="Managed by" onChange={(value) => update("provider", value)}
              options={epfProviderOptions} testIDPrefix="epf-provider" value={draft.provider} />
            <FormTextField error={errors.employerLabel} inputRef={(node) => { inputRefs.current.employerLabel = node; }}
              label="Employer (optional)" onChangeText={(value) => update("employerLabel", value)}
              testID="epf-employer-label-input" value={draft.employerLabel} />
            {account ? (
              <SelectionField helperText="An account keeps its balance in your portfolio whatever its status."
                label="Status" onChange={(value) => update("status", value)}
                options={epfStatusOptions} testIDPrefix="epf-status" value={draft.status} />
            ) : null}
          </PremiumCard>

          <PremiumCard section style={styles.formSection}>
            <SectionHeader title="Statement balance" />
            <FormTextField error={errors.employee} inputRef={(node) => { inputRefs.current.employee = node; }}
              keyboardType="decimal-pad" label="Employee EPF balance (INR)"
              onChangeText={(value) => update("employee", value)} testID="epf-employee-input" value={draft.employee} />
            <FormTextField error={errors.employer} inputRef={(node) => { inputRefs.current.employer = node; }}
              keyboardType="decimal-pad" label="Employer EPF balance (INR)"
              onChangeText={(value) => update("employer", value)} testID="epf-employer-input" value={draft.employer} />
            <AppText color="secondary" variant="caption" testID="epf-eps-note">
              Use the two EPF balances only. Leave out the EPS pension contribution; it is not an account balance.
            </AppText>
            <View style={styles.row}>
              <AppText color="secondary">Total EPF</AppText>
              <AppText testID="epf-form-total" weight="bold">{total === null ? "—" : formatINR(total)}</AppText>
            </View>
            <DatePickerField error={errors.date} fieldRef={(node) => { inputRefs.current.date = node; }}
              label="Balance as of" maximumDate={now} onChange={(value) => update("date", value)}
              testID="epf-balance-date" value={draft.date} />
            <AppText color="secondary" testID="epf-balance-date-hint" variant="caption">{epfBalanceDateHint}</AppText>
            <SelectionField label="Source" onChange={(value) => update("evidence", value)}
              options={epfEvidenceOptions} testIDPrefix="epf-evidence" value={draft.evidence} />
          </PremiumCard>

          <PremiumCard section>
            <AppText color="secondary" variant="caption">
              Find both balances in the EPFO member passbook ({epfPassbookUrl.replace("https://", "")}) or your employer trust's annual statement. CogVest never asks for your UAN or login.
            </AppText>
            <AppButton onPress={() => { void Linking.openURL(epfPassbookUrl).catch(() => undefined); }}
              testID="epf-passbook-link" title="Open EPFO passbook site" variant="ghost" />
          </PremiumCard>

          {message ? <AppText selectable style={styles.error}>{message}</AppText> : null}
          <View style={styles.actions}>
            <AppButton onPress={submit} testID="review-epf-account" title="Review account" />
            <AppButton onPress={requestBack} title="Cancel" variant="secondary" />
          </View>
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

function ReviewDetail({ label, testID, value }: { label: string; testID?: string; value: string }) {
  const styles = useStyles();
  const { fontScale, width } = useWindowDimensions();
  const stacked = width < 360 || getAdaptiveLayoutMode(fontScale) !== "standard";
  return (
    <View style={[styles.row, stacked && styles.stacked]}>
      <AppText color="secondary">{label}</AppText>
      <AppText style={[styles.detailValue, stacked && styles.stackedValue]} testID={testID} weight="bold">{value}</AppText>
    </View>
  );
}
