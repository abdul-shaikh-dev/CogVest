import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BackHandler, KeyboardAvoidingView, StyleSheet, TextInput, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  EmptyState,
  IconButton,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  SensitiveValueReveal,
  useSensitiveValueReveal,
} from "@/src/components/common";
import { DatePickerField, FormTextField, SelectionField } from "@/src/components/forms";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { calculateEpfLedger } from "@/src/domain/epf";
import { formatDate, formatINR } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing, createThemedStyles } from "@/src/theme";
import { createId } from "@/src/utils";
import { applyEpfChange } from "./EpfAccountScreen";
import { EpfCheckRow } from "./EpfCheckRow";
import {
  buildEpfBalanceUpdate,
  draftTotal,
  epfBalanceDateHint,
  epfEvidenceOptions,
  type EpfBalanceUpdate,
  type EpfEvidence,
  type EpfFieldErrors,
} from "./epfAccountForm";

// The sign is spelled out so the difference never relies on colour alone.
const formatDifference = (value: number) => (value === 0 ? formatINR(0) : `${value > 0 ? "+" : "−"}${formatINR(Math.abs(value))}`);

type Field = "employee" | "employer" | "date" | "reason";
const fieldOrder: Field[] = ["employee", "employer", "date", "reason"];

export function EpfBalanceUpdateScreen({ accountId, now = new Date(), onBack, onComplete, store = getPortfolioStore() }: {
  accountId: string;
  now?: Date;
  onBack: () => void;
  onComplete: () => void;
  store?: StoreApi<PortfolioStoreState>;
}) {
  const styles = useStyles();
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const account = snapshot.epf.accounts.find((item) => item.id === accountId);
  const { isRevealed, reveal } = useSensitiveValueReveal(snapshot.preferences.maskWealthValues);
  const [draft, setDraft] = useState({ employee: "", employer: "", date: formatLocalCalendarDate(now), reason: "Annual statement" });
  const [evidence, setEvidence] = useState<EpfEvidence>("statement");
  const [historyComplete, setHistoryComplete] = useState(false);
  const [errors, setErrors] = useState<EpfFieldErrors<Field>>({});
  const [message, setMessage] = useState("");
  const [review, setReview] = useState<{ update: EpfBalanceUpdate; commandId: string; revision: string }>();
  const [confirmExit, setConfirmExit] = useState(false);
  const [eventId] = useState(() => createId("epf-balance"));
  const inputRefs = useRef<Partial<Record<Field, TextInput | View | null>>>({});
  const isDirty = draft.employee !== "" || draft.employer !== "" || historyComplete;

  function requestBack() {
    if (review) { setReview(undefined); return; }
    if (confirmExit) { setConfirmExit(false); return; }
    if (isDirty) { setConfirmExit(true); return; }
    onBack();
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      requestBack();
      return true;
    });
    return () => subscription.remove();
  }, [confirmExit, isDirty, review]);

  if (!account) {
    return (
      <ScreenContainer testID="epf-update-screen">
        <EmptyState actionLabel="Back" message="It may have already been removed on another screen."
          onAction={onBack} title="EPF account unavailable" />
      </ScreenContainer>
    );
  }

  if (!isRevealed) {
    return (
      <ScreenContainer testID="epf-update-screen">
        <View style={styles.content}>
          <ScreenHeader title="Update EPF balance" subtitle={`${account.nickname} · values masked`} />
          <PremiumCard><SensitiveValueReveal onReveal={reveal} testID="reveal-epf-update" /></PremiumCard>
          <AppButton onPress={onBack} title="Back" variant="secondary" />
        </View>
      </ScreenContainer>
    );
  }

  const today = formatLocalCalendarDate(now);
  const current = calculateEpfLedger({ accounts: snapshot.epf.accounts, events: snapshot.epf.events }, today, today);
  const currentValue = current.ok ? current.accounts.find((item) => item.accountId === account.id) : undefined;
  const total = draftTotal(draft);

  function update(key: Field, value: string) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  function submit() {
    setMessage("");
    const result = buildEpfBalanceUpdate(draft, { account: account!, accounts: snapshot.epf.accounts,
      events: snapshot.epf.events, id: eventId, now, evidence });
    if (!result.ok) {
      setErrors(result.errors);
      setMessage(result.message ?? "");
      const first = fieldOrder.find((field) => result.errors[field]);
      const target = first ? inputRefs.current[first] : undefined;
      if (target && "focus" in target) requestAnimationFrame(() => target.focus());
      return;
    }
    setReview({ update: result.update, commandId: createId("epf-update"), revision: store.getState().getBackupRevision() });
  }

  function save() {
    if (!review) return;
    const failure = applyEpfChange(store, { commandId: review.commandId, reason: review.update.event.reason,
      change: { type: "eventPut", event: review.update.event, cash: null } }, review.revision);
    if (failure) { setMessage(failure); return; }
    const latest = store.getState().epf.accounts.find((item) => item.id === account!.id);
    const through = review.update.event.effectiveDate;
    if (historyComplete && latest && (latest.historyCompleteThrough ?? "") < through) {
      // Recorded only after the balance itself is saved; failure leaves a valid, more cautious state.
      const coverageFailure = applyEpfChange(store, { commandId: `${review.commandId}-coverage`,
        reason: "All activity recorded through statement date",
        change: { type: "accountPut", account: { ...latest, historyCompleteThrough: through } } },
        store.getState().getBackupRevision());
      if (coverageFailure) { setMessage(`Balance saved. ${coverageFailure}`); return; }
    }
    onComplete();
  }

  if (confirmExit) {
    return (
      <ScreenContainer scroll testID="epf-update-exit-confirmation">
        <View style={styles.content}>
          <ScreenHeader title="Discard this update?" subtitle="The balance you entered will not be saved" />
          <View style={styles.actions}>
            <AppButton onPress={() => setConfirmExit(false)} testID="keep-editing-epf-update" title="Keep editing" />
            <AppButton onPress={onBack} testID="discard-epf-update" title="Discard update" variant="destructive" />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (review) {
    const { update: result } = review;
    return (
      <ScreenContainer scroll testID="epf-update-review-screen">
        <View style={styles.content}>
          <ScreenHeader
            leading={<IconButton accessibilityLabel="Back to balance editor" icon="arrow-back" onPress={() => setReview(undefined)} />}
            title="Review balance update"
            subtitle={account.nickname}
          />
          <PremiumCard>
            <Detail label={`Before update, as of ${formatDate(result.event.effectiveDate)}`} testID="epf-update-previous" value={formatINR(result.previousTotal)} />
            <Detail label="New balance" testID="epf-update-new" value={formatINR(result.newTotal)} />
            <Detail label="Difference" testID="epf-update-difference" value={formatDifference(result.difference)} />
          </PremiumCard>
          <AppText color="secondary" variant="caption" testID="epf-update-explanation">
            This is saved as a balance correction from your statement. The difference is not counted as a contribution or as earned interest, and invested capital stays unknown.
          </AppText>
          {historyComplete ? (
            <AppText color="secondary" variant="caption">
              You confirmed all activity up to {formatDate(result.event.effectiveDate)} is recorded.
            </AppText>
          ) : null}
          {message ? <AppText selectable style={styles.error} testID="epf-update-error">{message}</AppText> : null}
          <View style={styles.actions}>
            <AppButton onPress={save} testID="save-epf-update" title="Save balance" />
            <AppButton onPress={() => setReview(undefined)} title="Edit balance" variant="secondary" />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <KeyboardAvoidingView behavior="height" style={styles.flex}>
      <ScreenContainer scroll testID="epf-update-screen">
        <View style={styles.content}>
          <ScreenHeader
            leading={<IconButton accessibilityLabel="Back" icon="arrow-back" onPress={requestBack} />}
            subtitle={account.nickname}
            title="Update EPF balance"
          />
          {currentValue ? (
            <AppText color="secondary" testID="epf-update-current">
              Currently {formatINR(currentValue.balance.total)}, as of {formatDate(currentValue.lastEvidenceDate)}.
            </AppText>
          ) : null}
          <PremiumCard section style={styles.formSection}>
            <SectionHeader title="New statement balance" />
            <FormTextField error={errors.employee} inputRef={(node) => { inputRefs.current.employee = node; }}
              keyboardType="decimal-pad" label="Employee EPF balance (INR)"
              onChangeText={(value) => update("employee", value)} testID="epf-update-employee-input" value={draft.employee} />
            <FormTextField error={errors.employer} inputRef={(node) => { inputRefs.current.employer = node; }}
              keyboardType="decimal-pad" label="Employer EPF balance (INR)"
              onChangeText={(value) => update("employer", value)} testID="epf-update-employer-input" value={draft.employer} />
            <AppText color="secondary" variant="caption">Leave out the EPS pension contribution.</AppText>
            <View style={styles.row}>
              <AppText color="secondary">New total</AppText>
              <AppText testID="epf-update-total" weight="bold">{total === null ? "—" : formatINR(total)}</AppText>
            </View>
            <DatePickerField error={errors.date} fieldRef={(node) => { inputRefs.current.date = node; }}
              label="Balance as of" maximumDate={now} onChange={(value) => update("date", value)}
              testID="epf-update-date" value={draft.date} />
            <AppText color="secondary" testID="epf-update-date-hint" variant="caption">{epfBalanceDateHint}</AppText>
            <SelectionField label="Source" onChange={setEvidence} options={epfEvidenceOptions}
              testIDPrefix="epf-update-evidence" value={evidence} />
            <FormTextField error={errors.reason} inputRef={(node) => { inputRefs.current.reason = node; }}
              label="Reason" onChangeText={(value) => update("reason", value)} testID="epf-update-reason-input" value={draft.reason} />
            <EpfCheckRow checked={historyComplete} helper="Lets Progress treat month ends up to this date as confirmed."
              label="All activity up to this date is recorded" onToggle={() => setHistoryComplete((checked) => !checked)}
              testID="epf-update-history-complete" />
          </PremiumCard>
          {message ? <AppText selectable style={styles.error}>{message}</AppText> : null}
          <View style={styles.actions}>
            <AppButton onPress={submit} testID="review-epf-update" title="Review update" />
            <AppButton onPress={requestBack} title="Cancel" variant="secondary" />
          </View>
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

function Detail({ label, testID, value }: { label: string; testID?: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <AppText color="secondary" style={styles.flex}>{label}</AppText>
      <AppText testID={testID} weight="bold">{value}</AppText>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  actions: { gap: spacing.sm },
  content: { gap: spacing.cardGap, paddingTop: spacing.sm },
  error: { color: colors.loss },
  flex: { flex: 1 },
  formSection: { paddingVertical: spacing.sm },
  row: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "space-between", minHeight: 48 },
}));
