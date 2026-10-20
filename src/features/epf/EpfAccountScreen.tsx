import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  CategoryIcon,
  DisclosureButton,
  EmptyState,
  GroupedListRow,
  IconButton,
  MASKED_INR_VALUE,
  MaskedValue,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  SensitiveValueReveal,
  getAdaptiveLayoutMode,
  useSensitiveValueReveal,
} from "@/src/components/common";
import { DatePickerField, FormTextField, SelectionField } from "@/src/components/forms";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import type { EpfAccount } from "@/src/domain/epf";
import type { EpfChange } from "@/src/domain/epf/persistence";
import { summarizeEpfForReporting } from "@/src/domain/epf/reporting";
import { formatDate, formatINR } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { interaction, spacing, createThemedStyles } from "@/src/theme";
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
import { eventAmountLabel, eventTitle } from "./epfEntryForm";

type EpfAccountScreenProps = {
  accountId?: string;
  now?: Date;
  onBack: () => void;
  onComplete: (accountId: string) => void;
  onUpdateBalance: (accountId: string) => void;
  onOpenEntry?: (accountId: string, entryId?: string) => void;
  store?: StoreApi<PortfolioStoreState>;
};

/** Applies one validated EPF command; returns a user-facing error, or null. */
export function applyEpfChange(
  store: StoreApi<PortfolioStoreState>,
  command: { commandId: string; reason: string; change: EpfChange },
  expectedRevision: string,
) {
  try {
    store.getState().applyEpfCommand(command, expectedRevision);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/revision|changed/i.test(message)) return "Your portfolio changed on another screen. Review the latest values and try again.";
    return message || "CogVest could not save this EPF change safely.";
  }
}

export function EpfAccountScreen({
  accountId,
  now = new Date(),
  onBack,
  onComplete,
  onUpdateBalance,
  onOpenEntry,
  store = getPortfolioStore(),
}: EpfAccountScreenProps) {
  const styles = useStyles();
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const [savedAccountId, setSavedAccountId] = useState<string>();
  const resolvedId = accountId ?? savedAccountId;
  const existing = snapshot.epf.accounts.find((account) => account.id === resolvedId);
  const [isEditing, setIsEditing] = useState(!existing);
  const { isRevealed, reveal } = useSensitiveValueReveal(snapshot.preferences.maskWealthValues);

  if (accountId && !existing) {
    return (
      <ScreenContainer testID="epf-account-screen">
        <EmptyState actionLabel="Back to Holdings" message="It may have already been removed on another screen."
          onAction={onBack} title="EPF account unavailable" />
      </ScreenContainer>
    );
  }

  if (isEditing) {
    if (existing && !isRevealed) {
      return (
        <ScreenContainer testID="epf-account-form-screen">
          <View style={styles.content}>
            <ScreenHeader title="Edit EPF account" subtitle={`${existing.nickname} · values masked`} />
            <PremiumCard><SensitiveValueReveal onReveal={reveal} testID="reveal-epf-account" /></PremiumCard>
            <AppButton onPress={() => setIsEditing(false)} title="Back" variant="secondary" />
          </View>
        </ScreenContainer>
      );
    }
    return (
      <EpfAccountForm
        key={existing?.id ?? "new"}
        account={existing}
        now={now}
        onBack={() => (existing ? setIsEditing(false) : onBack())}
        onComplete={(id) => {
          setSavedAccountId(id);
          setIsEditing(false);
          onComplete(id);
        }}
        store={store}
      />
    );
  }

  return (
    <EpfAccountDetail account={existing as EpfAccount} now={now} onBack={onBack}
      onEdit={() => setIsEditing(true)} onUpdateBalance={() => onUpdateBalance((existing as EpfAccount).id)}
      onOpenEntry={onOpenEntry ? (entryId) => onOpenEntry((existing as EpfAccount).id, entryId) : undefined} store={store} />
  );
}

function EpfAccountDetail({ account, now, onBack, onEdit, onUpdateBalance, onOpenEntry, store }: {
  account: EpfAccount;
  now: Date;
  onBack: () => void;
  onEdit: () => void;
  onUpdateBalance: () => void;
  onOpenEntry?: (entryId?: string) => void;
  store: StoreApi<PortfolioStoreState>;
}) {
  const styles = useStyles();
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const { fontScale, width } = useWindowDimensions();
  const stacked = width < 360 || getAdaptiveLayoutMode(fontScale) !== "standard";
  const masked = snapshot.preferences.maskWealthValues;
  const today = formatLocalCalendarDate(now);
  const summary = useMemo(() => summarizeEpfForReporting(snapshot.epf, today), [snapshot.epf, today]);
  const value = summary.accounts.find((item) => item.accountId === account.id);
  const events = snapshot.epf.events
    .filter((event) => event.type === "transfer"
      ? event.sourceId === account.id || event.destinationId === account.id : event.accountId === account.id)
    .sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate) || right.recordedAt.localeCompare(left.recordedAt));
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const components = value?.balance.components ?? null;
  const reversedIds = new Set(events.flatMap((event) => event.type === "reversal" ? [event.reversesId] : []));
  const settlement = events.find((event) => event.type === "withdrawal" && event.settlement && !reversedIds.has(event.id));

  return (
    <ScreenContainer scroll testID="epf-account-screen">
      <View style={styles.content}>
        <ScreenHeader
          action={<IconButton accessibilityLabel="Edit EPF account" icon="create-outline" onPress={onEdit} testID="edit-epf-account" />}
          leading={<IconButton accessibilityLabel="Back to Holdings" icon="arrow-back" onPress={onBack} testID="epf-account-back" />}
          subtitle={[epfProviderLabel(account.provider), account.employerLabel,
            settlement ? `Settled on ${formatDate(settlement.effectiveDate)}` : epfStatusLabel(account.status)].filter(Boolean).join(" · ")}
          title={account.nickname}
        />

        <PremiumCard section style={styles.balanceCard} testID="epf-balance-card">
          <View style={styles.balanceHeading}>
            <CategoryIcon assetClass="debt" size={22} />
            <AppText color="secondary">Recorded balance</AppText>
          </View>
          {value ? (
            <MaskedValue exactValue={formatINR(value.balance.total)} masked={masked} style={styles.balanceValue}
              testID="epf-account-total" value={formatINR(value.balance.total)} weight="bold" />
          ) : (
            <AppText style={styles.balanceValue} testID="epf-account-total" weight="bold">Unavailable</AppText>
          )}
          <AppText color="secondary" variant="caption" testID="epf-account-evidence">
            {settlement ? `Paid out in full on ${formatDate(settlement.effectiveDate)}`
              : value
                ? `As of ${formatDate(value.lastEvidenceDate)} · ${value.historyComplete ? "all activity recorded" : "later activity not confirmed"}`
                : "This account's records need review before a balance can be shown."}
          </AppText>
          {account.status !== "active" && value && value.balance.total > 0 ? (
            <AppText color="secondary" variant="caption">
              {epfStatusLabel(account.status)} accounts keep their balance in your portfolio until it is withdrawn or moved.
            </AppText>
          ) : null}
          {settlement ? null : <AppButton onPress={onUpdateBalance} testID="update-epf-balance" title="Update balance" />}
        </PremiumCard>

        <PremiumCard section>
          <DisclosureButton expanded={breakdownOpen} onPress={() => setBreakdownOpen((open) => !open)}
            testID="epf-breakdown-toggle" title="Employee and employer balances" />
          {breakdownOpen ? (
            <View testID="epf-breakdown">
              {components ? (
                <>
                  <Row label="Employee EPF" masked={masked} stacked={stacked} testID="epf-employee-balance" value={formatINR(components.employee)} />
                  <Row label="Employer EPF" masked={masked} stacked={stacked} testID="epf-employer-balance" value={formatINR(components.employer)} />
                </>
              ) : (
                <AppText color="secondary" variant="caption">The split is unknown for this balance. Update the balance with both statement figures to record it.</AppText>
              )}
              <AppText color="secondary" variant="caption">
                EPS pension contributions are not part of this balance.
              </AppText>
            </View>
          ) : null}
          <View style={styles.separator} />
          {value && value.capital !== null ? (
            <>
              <Row label="Invested capital" masked={masked} stacked={stacked} testID="epf-capital" value={formatINR(value.capital)} />
              <AppText color="secondary" variant="caption">
                {settlement ? "Nothing remains invested after the final settlement."
                  : "Contributions recorded since this account started from ₹0. Interest is return, not invested capital."}
              </AppText>
            </>
          ) : (
            <>
              <Row label="Invested capital" stacked={stacked} testID="epf-capital" value="Unknown" />
              <AppText color="secondary" variant="caption">
                A statement balance includes past interest, so it does not show how much was contributed.
              </AppText>
            </>
          )}
        </PremiumCard>

        <PremiumCard section>
          <DisclosureButton expanded={activityOpen} onPress={() => setActivityOpen((open) => !open)}
            testID="epf-activity-toggle" title={`Activity (${events.length})`} />
          {activityOpen ? (
            <View testID="epf-activity">
              <GroupedListRow meta={formatDate(account.checkpoint.date)} title="Starting balance"
                value={masked ? MASKED_INR_VALUE : formatINR(account.checkpoint.balance.total)} />
              {events.map((event) => (
                <GroupedListRow key={event.id} meta={formatDate(event.effectiveDate)} testID={`epf-event-${event.id}`}
                  accessibilityLabel={`${eventTitle(event)}, ${formatDate(event.effectiveDate)}${masked ? "" : `, ${eventAmountLabel(event, account.id)}`}`}
                  onPress={onOpenEntry ? () => onOpenEntry(event.id) : undefined} showChevron title={eventTitle(event)}
                  value={masked ? MASKED_INR_VALUE : eventAmountLabel(event, account.id)} />
              ))}
            </View>
          ) : null}
          {onOpenEntry && !settlement ? (
            <AppButton onPress={() => onOpenEntry()} testID="add-epf-entry" title="Add entry" variant="secondary" />
          ) : null}
        </PremiumCard>

        <LegacyHoldingSection account={account} store={store} />
        <DeleteSection account={account} onDeleted={onBack} store={store} />
      </View>
    </ScreenContainer>
  );
}

function Row({ label, masked = false, stacked, testID, value }: {
  label: string; masked?: boolean; stacked: boolean; testID?: string; value: string;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.row, stacked && styles.stacked]}>
      <AppText color="secondary">{label}</AppText>
      <MaskedValue exactValue={value} masked={masked} testID={testID} value={value} weight="bold" />
    </View>
  );
}

function LegacyHoldingSection({ account, store }: {
  account: EpfAccount; store: StoreApi<PortfolioStoreState>;
}) {
  const styles = useStyles();
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const [choosing, setChoosing] = useState(false);
  const [pendingAssetId, setPendingAssetId] = useState<string>();
  const [error, setError] = useState("");
  const linkedElsewhere = new Set(snapshot.epf.accounts.flatMap((item) => item.id !== account.id && item.legacyAssetId ? [item.legacyAssetId] : []));
  const candidates = snapshot.assets.filter((asset) => asset.currency === "INR" && !linkedElsewhere.has(asset.id) &&
    (asset.instrumentType === undefined ? asset.assetClass === "debt" : asset.instrumentType === "debt" || asset.instrumentType === "other"));
  const linked = snapshot.assets.find((asset) => asset.id === account.legacyAssetId);
  const pending = candidates.find((asset) => asset.id === pendingAssetId);

  function save(legacyAssetId: string | undefined) {
    const { legacyAssetId: _previous, ...rest } = account;
    const next: EpfAccount = legacyAssetId ? { ...rest, legacyAssetId } : rest;
    const failure = applyEpfChange(store, { commandId: createId("epf-link"),
      reason: legacyAssetId ? "Link older holding" : "Remove older holding link",
      change: { type: "accountPut", account: next } }, store.getState().getBackupRevision());
    setError(failure ?? "");
    if (!failure) { setPendingAssetId(undefined); setChoosing(false); }
  }

  if (!linked && candidates.length === 0) return null;
  return (
    <PremiumCard section testID="epf-legacy-section">
      <SectionHeader title="Older holding" />
      {linked ? (
        <>
          <AppText testID="epf-legacy-linked">Replaces {linked.name} from {formatDate(account.checkpoint.date)}.</AppText>
          <AppText color="secondary" variant="caption">The original holding is kept for reference but no longer counted in portfolio totals from that date.</AppText>
          <AppButton onPress={() => save(undefined)} testID="epf-legacy-unlink" title="Remove link" variant="ghost" />
        </>
      ) : pending ? (
        <View testID="epf-legacy-confirm">
          <AppText weight="bold">Link {pending.name}?</AppText>
          <AppText color="secondary" variant="caption">
            From {formatDate(account.checkpoint.date)}, this EPF account replaces that holding in portfolio totals so EPF is counted once. The holding and its records stay unchanged.
          </AppText>
          <AppButton onPress={() => save(pending.id)} testID="epf-legacy-confirm-link" title="Link holding" />
          <AppButton onPress={() => setPendingAssetId(undefined)} title="Cancel" variant="secondary" />
        </View>
      ) : choosing ? (
        <View testID="epf-legacy-choices">
          <AppText color="secondary" variant="caption">Only rupee debt or other holdings can be linked.</AppText>
          {candidates.map((asset) => (
            <GroupedListRow key={asset.id} onPress={() => setPendingAssetId(asset.id)} showChevron
              testID={`epf-legacy-option-${asset.id}`} title={asset.name} />
          ))}
          <AppButton onPress={() => setChoosing(false)} title="Cancel" variant="secondary" />
        </View>
      ) : (
        <>
          <AppText color="secondary" variant="caption">
            If you tracked this EPF as a holding before, link it so it is not counted twice.
          </AppText>
          <AppButton onPress={() => setChoosing(true)} testID="epf-legacy-choose" title="Link an older holding" variant="secondary" />
        </>
      )}
      {error ? <AppText selectable style={styles.error}>{error}</AppText> : null}
    </PremiumCard>
  );
}

function DeleteSection({ account, onDeleted, store }: {
  account: EpfAccount; onDeleted: () => void; store: StoreApi<PortfolioStoreState>;
}) {
  const styles = useStyles();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [commandId] = useState(() => createId("epf-delete"));
  if (!confirming) {
    return <AppButton onPress={() => setConfirming(true)} testID="delete-epf-account" title="Delete EPF account" variant="ghost" />;
  }
  const preview = store.getState().previewEpfAccountDeletion(account.id);
  const transfers = store.getState().epf.events.filter((event) => preview.eventIds.includes(event.id) && event.type === "transfer");

  function remove() {
    // Each step is a complete, validated state; a retry resumes safely by command ID.
    for (const eventId of preview.eventIds) {
      const failure = applyEpfChange(store, { commandId: `${commandId}-${eventId}`, reason: "Delete EPF account",
        change: { type: "eventRemove", id: eventId } }, store.getState().getBackupRevision());
      if (failure) { setError(failure); return; }
    }
    const failure = applyEpfChange(store, { commandId, reason: "Delete EPF account",
      change: { type: "accountRemove", id: account.id } }, store.getState().getBackupRevision());
    if (failure) setError(failure);
    else onDeleted();
  }

  return (
    <PremiumCard testID="delete-epf-confirmation">
      <AppText weight="bold">Delete this EPF account?</AppText>
      {transfers.length > 0 ? (
        <AppText color="secondary" variant="caption" testID="delete-epf-blocked">
          This account has {transfers.length} transfer{transfers.length === 1 ? "" : "s"} with another EPF account. Remove those transfers first so the other account stays correct.
        </AppText>
      ) : (
        <AppText color="secondary" variant="caption" testID="delete-epf-impact">
          This removes the account{preview.eventIds.length ? ` and its ${preview.eventIds.length} recorded entr${preview.eventIds.length === 1 ? "y" : "ies"}` : ""}
          {preview.cashEntryIds.length ? `, including ${preview.cashEntryIds.length} linked Cash entr${preview.cashEntryIds.length === 1 ? "y" : "ies"}` : ""}. Its value leaves your portfolio totals.
        </AppText>
      )}
      {error ? <AppText selectable style={styles.error}>{error}</AppText> : null}
      <View style={styles.actions}>
        {transfers.length === 0 ? (
          <AppButton onPress={remove} testID="confirm-delete-epf-account" title="Delete account" variant="destructive" />
        ) : null}
        <AppButton onPress={() => { setConfirming(false); setError(""); }} title="Keep account" variant="secondary" />
      </View>
    </PremiumCard>
  );
}

const fieldOrder: EpfAccountField[] = ["nickname", "employerLabel", "employee", "employer", "date"];

function EpfAccountForm({ account, now, onBack, onComplete, store }: {
  account?: EpfAccount;
  now: Date;
  onBack: () => void;
  onComplete: (accountId: string) => void;
  store: StoreApi<PortfolioStoreState>;
}) {
  const styles = useStyles();
  const initial = useMemo(() => (account ? draftFromEpfAccount(account) : emptyEpfAccountDraft(now)), [account]);
  const [draft, setDraft] = useState<EpfAccountDraft>(initial);
  const [errors, setErrors] = useState<EpfFieldErrors<EpfAccountField>>({});
  const [message, setMessage] = useState("");
  const [review, setReview] = useState<{ account: EpfAccount; commandId: string; revision: string }>();
  const [confirmExit, setConfirmExit] = useState(false);
  const [newId] = useState(() => createId("epf"));
  const scrollRef = useRef<ScrollView>(null);
  const inputRefs = useRef<Partial<Record<EpfAccountField, TextInput | View | null>>>({});
  const isDirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const total = draftTotal(draft);

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

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  actions: { gap: spacing.sm },
  balanceCard: { gap: spacing.sm },
  balanceHeading: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  // A matching line height keeps comma descenders visible at this size.
  balanceValue: { fontSize: 34, lineHeight: 42 },
  content: { gap: spacing.cardGap, paddingTop: spacing.sm },
  detailValue: { flex: 1, textAlign: "right" },
  error: { color: colors.loss },
  flex: { flex: 1 },
  formSection: { paddingVertical: spacing.sm },
  row: { alignItems: "center", flexDirection: "row", gap: spacing.md, justifyContent: "space-between", minHeight: interaction.minimumTouchTarget },
  separator: { borderBottomColor: colors.border.subtle, borderBottomWidth: StyleSheet.hairlineWidth },
  stacked: { alignItems: "stretch", flexDirection: "column" },
  stackedValue: { flex: 0, textAlign: "left" },
}));
