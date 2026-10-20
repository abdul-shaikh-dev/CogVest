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
import type { EpfEvent } from "@/src/domain/epf";
import { formatDate, formatINR } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { interaction, spacing, createThemedStyles } from "@/src/theme";
import { createId } from "@/src/utils";
import { applyEpfChange } from "./EpfAccountScreen";
import { EpfCheckRow } from "./EpfCheckRow";
import { epfEvidenceOptions, type EpfFieldErrors } from "./epfAccountForm";
import {
  buildEpfEntry,
  buildEpfReversal,
  draftFromEpfEvent,
  emptyEpfEntryDraft,
  entryHasSplit,
  epfEntryKindOptions,
  epfWithdrawalDestinationOptions,
  eventTitle,
  financialYearOptions,
  financialYearPeriod,
  type EpfEntryDraft,
  type EpfEntryField,
  type EpfEntryKind,
  type EpfEntryPlan,
} from "./epfEntryForm";

const fieldOrder: EpfEntryField[] = ["amount", "employee", "employer", "settlementInterest", "settlementInterestEmployee",
  "settlementInterestEmployer", "contributionEmployee", "contributionEmployer", "interestEmployee", "interestEmployer",
  "closingEmployee", "closingEmployer", "targetAccountId", "periodStart", "date", "postedDate", "creditDate"];

const summaryFields: Array<{ field: "contributionEmployee" | "contributionEmployer" | "interestEmployee" | "interestEmployer"
  | "closingEmployee" | "closingEmployer"; label: string; testID: string }> = [
  { field: "contributionEmployee", label: "Employee contributions (INR)", testID: "epf-summary-contribution-employee-input" },
  { field: "contributionEmployer", label: "Employer contributions (INR)", testID: "epf-summary-contribution-employer-input" },
  { field: "interestEmployee", label: "Employee interest (INR)", testID: "epf-summary-interest-employee-input" },
  { field: "interestEmployer", label: "Employer interest (INR)", testID: "epf-summary-interest-employer-input" },
  { field: "closingEmployee", label: "Closing balance, employee (INR)", testID: "epf-summary-closing-employee-input" },
  { field: "closingEmployer", label: "Closing balance, employer (INR)", testID: "epf-summary-closing-employer-input" },
];

const dateLabel: Record<EpfEntryKind, string> = {
  employeeContribution: "Credited on",
  employerContribution: "Credited on",
  interest: "Interest for the period ending",
  withdrawal: "Paid out on",
  transferOut: "Left this account on",
  transferIn: "Received on",
  yearSummary: "Period ends on",
};

function roleCopy(plan: EpfEntryPlan, draft: EpfEntryDraft) {
  switch (draft.kind) {
    case "employeeContribution":
    case "employerContribution":
      return "Counted as money put in, not as a return. Payroll contributions do not pass through your tracked Cash, so Cash is unchanged.";
    case "interest":
      return "Counted as return earned, not as money put in.";
    case "withdrawal":
      if (plan.event.type === "withdrawal" && plan.event.settlement) {
        return `Pays out the whole balance, including ${formatINR(plan.event.settlement.interest.total)} interest credited with the claim. ` +
          "The interest counts as return, and the account ends at ₹0.";
      }
      return draft.destination === "cash"
        ? `Your tracked Cash increases by ${formatINR(plan.effect.cashChange)}. Both records are saved together.`
        : draft.destination === "external"
          ? "This money leaves your portfolio. Cash is not changed."
          : "Where this money went stays unknown and is shown as unresolved. Cash is not changed.";
    case "transferOut":
      return draft.transferStatus === "inTransit"
        ? `Combined EPF is unchanged. ${formatINR(plan.effect.inTransitAfter)} is counted once as moving until it arrives.`
        : "Moves money between your EPF accounts. Combined EPF is unchanged.";
    case "transferIn":
      return "Adds value from an account CogVest does not track. Its earlier history and contributions stay unknown.";
    case "yearSummary":
      return `Contributions count as money put in and interest as return, all on ${formatDate(plan.event.effectiveDate)}. ` +
        (plan.event.type === "yearSummary" && plan.event.closing ? "The result matches the passbook closing balance. " : "") +
        "Progress shows no EPF value for months inside the period, only at its end.";
  }
}


export function EpfEntryScreen({ accountId, entryId, now = new Date(), onBack, onComplete, store = getPortfolioStore() }: {
  accountId: string;
  entryId?: string;
  now?: Date;
  onBack: () => void;
  onComplete: () => void;
  store?: StoreApi<PortfolioStoreState>;
}) {
  const styles = useStyles();
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const { isRevealed, reveal } = useSensitiveValueReveal(snapshot.preferences.maskWealthValues);
  const existing = entryId ? snapshot.epf.events.find((event) => event.id === entryId) : undefined;
  // A transfer is one record owned by its source account, whichever side opened it.
  const ownerId = existing?.type === "transfer" ? existing.sourceId : accountId;
  const account = snapshot.epf.accounts.find((item) => item.id === ownerId);
  const link = existing ? snapshot.epf.cashLinks.find((item) => item.eventId === existing.id) : undefined;
  const editable = !existing || (existing.type !== "reconciliation" && existing.type !== "reversal");
  const [initial] = useState(() => (existing && editable && account
    ? draftFromEpfEvent(existing, ownerId, Boolean(link), now) : emptyEpfEntryDraft(now)));
  const [draft, setDraft] = useState<EpfEntryDraft>(initial);
  const [errors, setErrors] = useState<EpfFieldErrors<EpfEntryField>>({});
  const [message, setMessage] = useState("");
  const [review, setReview] = useState<{ plan: EpfEntryPlan; commandId: string; revision: string }>();
  const [confirmExit, setConfirmExit] = useState(false);
  const [ids] = useState(() => ({ event: createId("epf-entry"), cash: createId("cash") }));
  const inputRefs = useRef<Partial<Record<EpfEntryField, TextInput | View | null>>>({});
  const isDirty = JSON.stringify(draft) !== JSON.stringify(initial);

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

  if (!account || (entryId && !existing)) {
    return (
      <ScreenContainer testID="epf-entry-screen">
        <EmptyState actionLabel="Back" message="It may have already been removed on another screen."
          onAction={onBack} title="EPF entry unavailable" />
      </ScreenContainer>
    );
  }
  if (!isRevealed) {
    return (
      <ScreenContainer testID="epf-entry-screen">
        <View style={styles.content}>
          <ScreenHeader title={existing ? "EPF entry" : "Add EPF entry"} subtitle={`${account.nickname} · values masked`} />
          <PremiumCard><SensitiveValueReveal onReveal={reveal} testID="reveal-epf-entry" /></PremiumCard>
          <AppButton onPress={onBack} title="Back" variant="secondary" />
        </View>
      </ScreenContainer>
    );
  }

  const otherAccounts = snapshot.epf.accounts.filter((item) => item.id !== account.id);
  const yearOptions = financialYearOptions(account, now);
  function choosePeriod(yearStart: string) {
    const period = financialYearPeriod(yearStart, account!, now);
    update("periodStart", period.periodStart);
    update("date", period.date);
  }
  function update<Key extends keyof EpfEntryDraft>(key: Key, value: EpfEntryDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key as EpfEntryField];
      return next;
    });
  }

  function submit() {
    setMessage("");
    const result = buildEpfEntry(draft, { account: account!, accounts: snapshot.epf.accounts,
      events: snapshot.epf.events, id: ids.event, cashId: link?.cashEntryId ?? ids.cash, now, existing });
    if (!result.ok) {
      setErrors(result.errors);
      setMessage(result.message ?? "");
      const first = fieldOrder.find((field) => result.errors[field]);
      const target = first ? inputRefs.current[first] : undefined;
      if (target && "focus" in target) requestAnimationFrame(() => target.focus());
      return;
    }
    setReview({ plan: result.plan, commandId: createId("epf-entry-save"), revision: store.getState().getBackupRevision() });
  }

  if (confirmExit) {
    return (
      <ScreenContainer scroll testID="epf-entry-exit-confirmation">
        <View style={styles.content}>
          <ScreenHeader title="Discard this entry?" subtitle="What you entered will not be saved" />
          <View style={styles.actions}>
            <AppButton onPress={() => setConfirmExit(false)} testID="keep-editing-epf-entry" title="Keep editing" />
            <AppButton onPress={onBack} testID="discard-epf-entry" title="Discard entry" variant="destructive" />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (review) {
    const { plan } = review;
    return (
      <ScreenContainer scroll testID="epf-entry-review-screen">
        <View style={styles.content}>
          <ScreenHeader
            leading={<IconButton accessibilityLabel="Back to entry editor" icon="arrow-back" onPress={() => setReview(undefined)} />}
            subtitle={`${eventTitle(plan.event)} · ${formatDate(plan.event.effectiveDate)}`}
            title="Review EPF entry"
          />
          <PremiumCard>
            {plan.event.type === "yearSummary" ? (
              <Line label="Period" testID="epf-entry-summary-period"
                value={`${formatDate(plan.event.periodStart)} – ${formatDate(plan.event.effectiveDate)}`} />
            ) : null}
            {plan.effect.accounts.map((item) => (
              <Line key={item.accountId} label={item.nickname} testID={`epf-entry-effect-${item.accountId}`}
                value={`${item.before === null ? "—" : formatINR(item.before)} → ${item.after === null ? "—" : formatINR(item.after)}`} />
            ))}
            <Line label="All EPF" testID="epf-entry-effect-total"
              value={`${plan.effect.totalBefore === null ? "—" : formatINR(plan.effect.totalBefore)} → ${plan.effect.totalAfter === null ? "—" : formatINR(plan.effect.totalAfter)}`} />
          </PremiumCard>
          <AppText color="secondary" variant="caption" testID="epf-entry-role">{roleCopy(plan, draft)}</AppText>
          {message ? <AppText selectable style={styles.error} testID="epf-entry-error">{message}</AppText> : null}
          <View style={styles.actions}>
            <AppButton
              onPress={() => {
                const failure = applyEpfChange(store, { commandId: review.commandId,
                  reason: existing ? "Correct EPF entry" : "Add EPF entry",
                  change: { type: "eventPut", event: plan.event, cash: plan.cash } }, review.revision);
                if (failure) setMessage(failure);
                else onComplete();
              }}
              testID="save-epf-entry"
              title="Save entry"
            />
            <AppButton onPress={() => setReview(undefined)} title="Edit entry" variant="secondary" />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <KeyboardAvoidingView behavior="height" style={styles.flex}>
      <ScreenContainer scroll testID="epf-entry-screen">
        <View style={styles.content}>
          <ScreenHeader
            leading={<IconButton accessibilityLabel="Back" icon="arrow-back" onPress={requestBack} />}
            subtitle={account.nickname}
            title={existing ? eventTitle(existing) : "Add EPF entry"}
          />
          {!editable && existing ? (
            <PremiumCard section testID="epf-entry-summary">
              <Line label="Date" value={formatDate(existing.effectiveDate)} />
              {existing.type === "reconciliation" ? <Line label="Balance" value={formatINR(existing.balance.total)} /> : null}
              <Line label="Reason" value={existing.reason} />
              <AppText color="secondary" variant="caption">
                {existing.type === "reconciliation"
                  ? "Balance updates are corrected by deleting them and recording the statement again."
                  : "A reversal is removed by deleting it; the original entry then counts again."}
              </AppText>
            </PremiumCard>
          ) : (
            <>
              <PremiumCard section style={styles.formSection}>
                {existing ? null : (
                  <SelectionField label="Entry type" onChange={(value) => {
                    // A summary moves the date to its period end; other entries start from today again.
                    if (draft.kind === "yearSummary" && value !== "yearSummary") update("date", formatLocalCalendarDate(now));
                    update("kind", value);
                    const latest = financialYearOptions(account, now)[0];
                    if (value === "yearSummary" && latest) choosePeriod(latest.value);
                  }} options={epfEntryKindOptions} testIDPrefix="epf-entry-kind" value={draft.kind} />
                )}
                {draft.kind === "yearSummary" ? (
                  <>
                    <SelectionField label="Financial year" onChange={choosePeriod} options={yearOptions}
                      testIDPrefix="epf-summary-year" value={yearOptions.find((item) => item.value <= draft.periodStart)?.value ?? ""} />
                    <AppText color="secondary" variant="caption">
                      Copy the year's totals from your passbook. Enter the employer EPF share only, not the EPS pension share.
                    </AppText>
                    {summaryFields.map(({ field, label, testID }) => (
                      <FormTextField error={errors[field]} inputRef={(node) => { inputRefs.current[field] = node; }} key={field}
                        keyboardType="decimal-pad" label={field.startsWith("closing") && draft.date.slice(5) !== "03-31" ? label.replace("(INR)", "(INR, optional)") : label}
                        onChangeText={(value) => update(field, value)} testID={testID} value={draft[field]} />
                    ))}
                  </>
                ) : (
                  <FormTextField error={errors.amount} inputRef={(node) => { inputRefs.current.amount = node; }}
                    keyboardType="decimal-pad" label="Amount (INR)" onChangeText={(value) => update("amount", value)}
                    testID="epf-entry-amount-input" value={draft.amount} />
                )}
                {draft.kind === "employeeContribution" ? (
                  <EpfCheckRow checked={draft.voluntary} helper="Extra amount you chose to contribute above the required share."
                    label="Voluntary PF" onToggle={() => update("voluntary", !draft.voluntary)} testID="epf-entry-voluntary" />
                ) : null}
                {draft.kind === "employerContribution" ? (
                  <AppText color="secondary" variant="caption">Enter the employer EPF share only, not the EPS pension share.</AppText>
                ) : null}
                {entryHasSplit(draft.kind) ? (
                  <>
                    <FormTextField error={errors.employee} inputRef={(node) => { inputRefs.current.employee = node; }}
                      keyboardType="decimal-pad" label="Employee part (optional)" onChangeText={(value) => update("employee", value)}
                      testID="epf-entry-employee-input" value={draft.employee} />
                    <FormTextField error={errors.employer} inputRef={(node) => { inputRefs.current.employer = node; }}
                      keyboardType="decimal-pad" label="Employer part (optional)" onChangeText={(value) => update("employer", value)}
                      testID="epf-entry-employer-input" value={draft.employer} />
                    <AppText color="secondary" variant="caption">
                      Without both parts, the employee and employer split becomes unknown until your next balance update.
                    </AppText>
                  </>
                ) : null}
                {draft.kind === "withdrawal" ? (
                  <>
                    <EpfCheckRow checked={draft.settlement} label="Final settlement (closes the account)"
                      helper="The claim paid out everything, including interest up to the settlement date that the passbook may list under the year end."
                      onToggle={() => update("settlement", !draft.settlement)} testID="epf-entry-settlement" />
                    {draft.settlement ? (
                      <>
                        <FormTextField error={errors.settlementInterest} inputRef={(node) => { inputRefs.current.settlementInterest = node; }}
                          keyboardType="decimal-pad" label="Interest paid with the settlement (INR)"
                          onChangeText={(value) => update("settlementInterest", value)}
                          testID="epf-entry-settlement-interest-input" value={draft.settlementInterest} />
                        <FormTextField error={errors.settlementInterestEmployee} inputRef={(node) => { inputRefs.current.settlementInterestEmployee = node; }}
                          keyboardType="decimal-pad" label="Employee interest (optional)"
                          onChangeText={(value) => update("settlementInterestEmployee", value)}
                          testID="epf-entry-settlement-interest-employee-input" value={draft.settlementInterestEmployee} />
                        <FormTextField error={errors.settlementInterestEmployer} inputRef={(node) => { inputRefs.current.settlementInterestEmployer = node; }}
                          keyboardType="decimal-pad" label="Employer interest (optional)"
                          onChangeText={(value) => update("settlementInterestEmployer", value)}
                          testID="epf-entry-settlement-interest-employer-input" value={draft.settlementInterestEmployer} />
                      </>
                    ) : null}
                  </>
                ) : null}
                {draft.kind === "withdrawal" ? (
                  <SelectionField label="Where did the money go?" onChange={(value) => update("destination", value)}
                    options={epfWithdrawalDestinationOptions} testIDPrefix="epf-entry-destination" value={draft.destination} />
                ) : null}
                {draft.kind === "transferOut" ? (
                  otherAccounts.length === 0 ? (
                    <AppText color="secondary" testID="epf-entry-no-target">
                      Add the receiving EPF account first, then record the transfer here.
                    </AppText>
                  ) : (
                    <>
                      <View ref={(node) => { inputRefs.current.targetAccountId = node; }}>
                        <SelectionField label="Moved to" onChange={(value) => update("targetAccountId", value)}
                          options={otherAccounts.map((item) => ({ label: item.nickname, value: item.id }))}
                          testIDPrefix="epf-entry-target" value={draft.targetAccountId} />
                        {errors.targetAccountId ? <AppText style={styles.error} variant="caption">{errors.targetAccountId}</AppText> : null}
                      </View>
                      <SelectionField label="Has it arrived?" onChange={(value) => update("transferStatus", value)}
                        options={[{ label: "Yes, it arrived", value: "completed" }, { label: "Not yet, still moving", value: "inTransit" }]}
                        testIDPrefix="epf-entry-transfer-status" value={draft.transferStatus} />
                    </>
                  )
                ) : null}
              </PremiumCard>
              <PremiumCard section style={styles.formSection}>
                <SectionHeader title="Dates and source" />
                {draft.kind === "yearSummary" ? (
                  <>
                    <DatePickerField error={errors.periodStart} fieldRef={(node) => { inputRefs.current.periodStart = node; }}
                      label="Period starts on" maximumDate={now} onChange={(value) => update("periodStart", value)}
                      testID="epf-summary-period-start" value={draft.periodStart} />
                    <AppText color="secondary" variant="caption" testID="epf-summary-period-hint">
                      Keep the whole year unless it had a withdrawal or final settlement. Then end this period the day before the withdrawal, or on the settlement date, and record the rest separately.
                    </AppText>
                  </>
                ) : null}
                <DatePickerField error={errors.date} fieldRef={(node) => { inputRefs.current.date = node; }}
                  label={draft.kind === "withdrawal" && draft.settlement ? "Settled on" : dateLabel[draft.kind]} maximumDate={now} onChange={(value) => update("date", value)}
                  testID="epf-entry-date" value={draft.date} />
                {draft.kind === "interest" ? (
                  <DatePickerField error={errors.postedDate} fieldRef={(node) => { inputRefs.current.postedDate = node; }}
                    label="Credited on" maximumDate={now} onChange={(value) => update("postedDate", value)}
                    testID="epf-entry-posted-date" value={draft.postedDate} />
                ) : null}
                {draft.kind === "transferOut" && draft.transferStatus === "completed" ? (
                  <DatePickerField error={errors.creditDate} fieldRef={(node) => { inputRefs.current.creditDate = node; }}
                    label="Arrived on" maximumDate={now} onChange={(value) => update("creditDate", value)}
                    testID="epf-entry-credit-date" value={draft.creditDate} />
                ) : null}
                <SelectionField label="Source" onChange={(value) => update("evidence", value)}
                  options={epfEvidenceOptions} testIDPrefix="epf-entry-evidence" value={draft.evidence} />
              </PremiumCard>
              {message ? <AppText selectable style={styles.error} testID="epf-entry-error">{message}</AppText> : null}
              <View style={styles.actions}>
                <AppButton onPress={submit} testID="review-epf-entry" title="Review entry" />
                <AppButton onPress={requestBack} title="Cancel" variant="secondary" />
              </View>
            </>
          )}
          {existing ? <ExistingEntryActions event={existing} linkedCash={Boolean(link)} now={now} onDone={onComplete} store={store} /> : null}
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

function ExistingEntryActions({ event, linkedCash, now, onDone, store }: {
  event: EpfEvent; linkedCash: boolean; now: Date; onDone: () => void; store: StoreApi<PortfolioStoreState>;
}) {
  const styles = useStyles();
  const [mode, setMode] = useState<"idle" | "delete" | "reverse">("idle");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(formatLocalCalendarDate(now));
  const [errors, setErrors] = useState<EpfFieldErrors<"date" | "reason">>({});
  const [message, setMessage] = useState("");
  const [ids] = useState(() => ({ remove: createId("epf-entry-remove"), reverse: createId("epf-reversal") }));
  const reversible = event.type === "contribution" || event.type === "interest" || event.type === "withdrawal";

  if (mode === "delete") {
    return (
      <PremiumCard testID="delete-epf-entry-confirmation">
        <AppText weight="bold">Delete this entry?</AppText>
        <AppText color="secondary" variant="caption" testID="delete-epf-entry-impact">
          {event.type === "transfer" ? "Both EPF accounts change back. " : ""}
          {linkedCash ? "The linked Cash entry is removed too. " : ""}
          Use this for an entry recorded by mistake. If your provider reversed it, record a reversal instead.
        </AppText>
        {message ? <AppText selectable style={styles.error} testID="delete-epf-entry-error">{message}</AppText> : null}
        <View style={styles.actions}>
          <AppButton onPress={() => {
            const failure = applyEpfChange(store, { commandId: ids.remove, reason: "Remove EPF entry recorded by mistake",
              change: { type: "eventRemove", id: event.id } }, store.getState().getBackupRevision());
            if (failure) setMessage(failure);
            else onDone();
          }} testID="confirm-delete-epf-entry" title="Delete entry" variant="destructive" />
          <AppButton onPress={() => { setMode("idle"); setMessage(""); }} title="Keep entry" variant="secondary" />
        </View>
      </PremiumCard>
    );
  }
  if (mode === "reverse") {
    return (
      <PremiumCard testID="epf-reversal-panel">
        <SectionHeader title="Provider reversal" />
        <AppText color="secondary" variant="caption">
          Records that your provider reversed this {eventTitle(event).toLowerCase()}. The original stays in your history.
        </AppText>
        <DatePickerField error={errors.date} label="Reversed on" maximumDate={now}
          onChange={(value) => { setDate(value); setErrors((current) => ({ ...current, date: undefined })); }}
          testID="epf-reversal-date" value={date} />
        <FormTextField error={errors.reason} label="Reason" onChangeText={(value) => { setReason(value); setErrors((current) => ({ ...current, reason: undefined })); }}
          testID="epf-reversal-reason-input" value={reason} />
        {message ? <AppText selectable style={styles.error} testID="epf-reversal-error">{message}</AppText> : null}
        <View style={styles.actions}>
          <AppButton onPress={() => {
            setMessage("");
            const state = store.getState();
            const result = buildEpfReversal(event, { date, reason }, { accounts: state.epf.accounts, events: state.epf.events, id: ids.reverse, now });
            if (!result.ok) { setErrors(result.errors); setMessage(result.message ?? ""); return; }
            const failure = applyEpfChange(store, { commandId: ids.reverse, reason: reason.trim(),
              change: { type: "eventPut", event: result.event, cash: null } }, state.getBackupRevision());
            if (failure) setMessage(failure);
            else onDone();
          }} testID="save-epf-reversal" title="Save reversal" />
          <AppButton onPress={() => { setMode("idle"); setMessage(""); }} title="Cancel" variant="secondary" />
        </View>
      </PremiumCard>
    );
  }
  return (
    <View style={styles.actions}>
      {reversible ? <AppButton onPress={() => setMode("reverse")} testID="reverse-epf-entry" title="Provider reversed this" variant="secondary" /> : null}
      <AppButton onPress={() => setMode("delete")} testID="delete-epf-entry" title="Delete entry" variant="ghost" />
    </View>
  );
}

function Line({ label, testID, value }: { label: string; testID?: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.line}>
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
  line: { alignItems: "center", columnGap: spacing.md, flexDirection: "row", flexWrap: "wrap",
    justifyContent: "space-between", minHeight: interaction.minimumTouchTarget },
}));
