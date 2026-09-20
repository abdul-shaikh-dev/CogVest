import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AccessibilityInfo,
  BackHandler,
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
  EmptyState,
  IconButton,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SensitiveValueReveal,
  SectionHeader,
  useSensitiveValueReveal,
} from "@/src/components/common";
import { DatePickerField, FormTextField, SelectionField } from "@/src/components/forms";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { formatDate, formatINR } from "@/src/domain/formatters";
import { getFinancialYearStart, validatePpfLedgerEntry } from "@/src/domain/ppf";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, interaction, spacing } from "@/src/theme";
import type { PpfLedgerEntry } from "@/src/types";
import { createId } from "@/src/utils";

type EntryType = PpfLedgerEntry["type"];
type EntryField = "amount" | "date" | "reason";

const entryErrorFields: Record<string, EntryField> = {
  "Entry amount must be greater than zero.": "amount",
  "Entry date must be a valid non-future date.": "date",
  "PPF contributions must be in multiples of ₹50.": "amount",
  "Reconciled balance must be zero or greater.": "amount",
  "Reconciliation reason is required.": "reason",
};

export function PpfEntryScreen({
  accountId,
  entryId,
  now = new Date(),
  onBack,
  onComplete,
  store = getPortfolioStore(),
}: {
  accountId: string;
  entryId?: string;
  now?: Date;
  onBack: () => void;
  onComplete: () => void;
  store?: StoreApi<PortfolioStoreState>;
}) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const account = snapshot.ppfAccounts.find((item) => item.id === accountId);
  const existing = snapshot.ppfLedgerEntries.find((item) => item.id === entryId);
  const [type, setType] = useState<EntryType>(existing?.type ?? "contribution");
  const [amount, setAmount] = useState(
    existing
      ? String(existing.type === "reconciliation" ? existing.confirmedBalance : existing.amount)
      : "",
  );
  const [date, setDate] = useState(existing?.date ?? formatLocalCalendarDate(now));
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [isNoteExpanded, setIsNoteExpanded] = useState(Boolean(existing?.notes));
  const [areContributionRulesExpanded, setAreContributionRulesExpanded] =
    useState(false);
  const [reason, setReason] = useState(existing?.type === "reconciliation" ? existing.reason : "");
  const [reviewEntry, setReviewEntry] = useState<PpfLedgerEntry>();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<EntryField, string>>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const amountRef = useRef<TextInput>(null);
  const dateRef = useRef<View>(null);
  const reasonRef = useRef<TextInput>(null);
  const fieldY = useRef<Partial<Record<EntryField, number>>>({});
  const { isRevealed, reveal } = useSensitiveValueReveal(
    snapshot.preferences.maskWealthValues,
  );

  const initialType = existing?.type ?? "contribution";
  const initialAmount = existing
    ? String(existing.type === "reconciliation" ? existing.confirmedBalance : existing.amount)
    : "";
  const initialDate = existing?.date ?? formatLocalCalendarDate(now);
  const initialReason = existing?.type === "reconciliation" ? existing.reason : "";
  const isDirty =
    type !== initialType ||
    amount !== initialAmount ||
    date !== initialDate ||
    notes !== (existing?.notes ?? "") ||
    reason !== initialReason;

  function requestBack() {
    if (reviewEntry) {
      setReviewEntry(undefined);
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
  }, [confirmExit, isDirty, reviewEntry]);

  if (!account || (entryId && !existing)) {
    return (
      <ScreenContainer testID="ppf-entry-screen">
        <EmptyState actionLabel="Back" message="The account or entry is no longer available." onAction={onBack} title="PPF entry unavailable" />
      </ScreenContainer>
    );
  }

  if (existing && !isRevealed) {
    return (
      <ScreenContainer testID="ppf-entry-screen">
        <View style={styles.content}>
          <ScreenHeader
            title="Review PPF entry"
            subtitle={`${account.nickname} · values masked`}
          />
          <PremiumCard>
            <SensitiveValueReveal
              onReveal={reveal}
              testID="reveal-ppf-entry"
            />
          </PremiumCard>
          <AppButton onPress={onBack} title="Back" variant="secondary" />
        </View>
      </ScreenContainer>
    );
  }

  function buildEntry() {
    const parsedAmount = Number(amount);
    const base = {
      accountId: account!.id,
      date,
      id: existing?.id ?? createId("ppf_entry"),
      notes: notes.trim() || undefined,
      recordedAt: existing?.recordedAt ?? now.toISOString(),
    };
    const entry: PpfLedgerEntry =
      type === "reconciliation"
        ? { ...base, confirmedBalance: parsedAmount, reason: reason.trim(), type }
        : type === "interestCredit"
          ? { ...base, amount: parsedAmount, financialYearStart: getFinancialYearStart(date), type }
          : { ...base, amount: parsedAmount, type };
    const validation = validatePpfLedgerEntry(entry, now);
    if (!validation.isValid) {
      const nextFieldErrors: Partial<Record<EntryField, string>> = {};
      for (const message of validation.errors) {
        const field = entryErrorFields[message];
        if (field && !nextFieldErrors[field]) nextFieldErrors[field] = message;
      }
      const firstField = validation.errors
        .map((message) => entryErrorFields[message])
        .find((field): field is EntryField => Boolean(field));
      setFieldErrors(nextFieldErrors);
      setError(validation.errors.find((message) => !entryErrorFields[message]) ?? "");
      if (firstField) {
        requestAnimationFrame(() => {
          const input = firstField === "amount" ? amountRef.current : firstField === "reason" ? reasonRef.current : null;
          if (input) input.focus();
          else {
            const handle = findNodeHandle(dateRef.current);
            if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
          }
          scrollRef.current?.scrollTo({ animated: true, y: Math.max(0, (fieldY.current[firstField] ?? 0) - spacing.md) });
        });
      }
      return null;
    }
    setFieldErrors({});
    return entry;
  }

  if (confirmExit) {
    return (
      <ScreenContainer scroll testID="ppf-entry-exit-confirmation">
        <View style={styles.content}>
          <ScreenHeader title="Discard entry changes?" subtitle="Your unsaved edits will be lost" />
          <PremiumCard>
            <AppText color="secondary">Return to the populated editor or discard these unsaved changes.</AppText>
          </PremiumCard>
          <View style={styles.actions}>
            <AppButton onPress={() => setConfirmExit(false)} testID="keep-editing-ppf-entry" title="Keep editing" />
            <AppButton onPress={onBack} testID="discard-ppf-entry" title="Discard changes" variant="destructive" />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (reviewEntry) {
    return (
      <ScreenContainer scroll testID="ppf-entry-review-screen">
        <View style={styles.content}>
          <ScreenHeader
            leading={<IconButton accessibilityLabel="Back to entry editor" icon="arrow-back" onPress={() => setReviewEntry(undefined)} />}
            title="Review PPF entry"
            subtitle="Confirm before saving • local only"
          />
          <PremiumCard>
            <SectionHeader title={entryLabel(reviewEntry.type)} />
            <ReviewRow label="Account" value={account.nickname} />
            <ReviewRow label="Date" value={formatDate(reviewEntry.date)} />
            <ReviewRow
              label={reviewEntry.type === "reconciliation" ? "Confirmed balance" : "Amount"}
              value={formatINR(reviewEntry.type === "reconciliation" ? reviewEntry.confirmedBalance : reviewEntry.amount)}
            />
            {reviewEntry.type === "reconciliation" ? <ReviewRow label="Reason" value={reviewEntry.reason} /> : null}
          </PremiumCard>
          {reviewEntry.type === "interestCredit" ? (
            <AppText color="secondary" variant="caption">
              Record only interest shown as credited by the official passbook or provider statement.
            </AppText>
          ) : null}
          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          <View style={styles.actions}>
            <AppButton
              onPress={() => {
                const result = existing
                  ? store.getState().correctPpfLedgerEntry(reviewEntry)
                  : store.getState().addPpfLedgerEntry(reviewEntry);
                if (result.status === "applied" || result.status === "alreadyApplied") onComplete();
                else setError("This entry would make the PPF ledger inconsistent. Review the amount and date.");
              }}
              testID="save-ppf-entry"
              title="Save entry"
            />
            <AppButton onPress={() => setReviewEntry(undefined)} testID="edit-ppf-entry" title="Edit entry" variant="secondary" />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <KeyboardAvoidingView behavior="height" style={styles.flex}>
      <ScreenContainer scroll scrollRef={scrollRef} testID="ppf-entry-screen">
        <View style={styles.content}>
        <ScreenHeader
          leading={<IconButton accessibilityLabel="Back to PPF account" icon="arrow-back" onPress={requestBack} />}
          subtitle={`${account.nickname} • confirmed ledger`}
          title={existing ? "Review PPF entry" : "Add PPF entry"}
        />
        <PremiumCard>
          <SectionHeader title="Entry details" />
          <SelectionField
            label="Entry type"
            onChange={(value) => {
              setType(value);
              setError("");
              setFieldErrors({});
            }}
            options={[
              { label: "Contribution", value: "contribution" },
              { label: "Official interest credit", value: "interestCredit" },
              { label: "Withdrawal", value: "withdrawal" },
              { label: "Balance correction", value: "reconciliation" },
            ]}
            testIDPrefix="ppf-entry-type"
            value={type}
          />
          <View onLayout={(event) => { fieldY.current.amount = event.nativeEvent.layout.y; }}>
            <FormTextField
              error={fieldErrors.amount}
              inputRef={amountRef}
              keyboardType="decimal-pad"
              label={type === "reconciliation" ? "Confirmed balance (INR)" : "Amount (INR)"}
              onChangeText={(value) => { setAmount(value); setFieldErrors((current) => ({ ...current, amount: undefined })); }}
              testID="ppf-entry-amount"
              value={amount}
            />
          </View>
          <View onLayout={(event) => { fieldY.current.date = event.nativeEvent.layout.y; }}>
            <DatePickerField error={fieldErrors.date} fieldRef={dateRef} label={type === "reconciliation" ? "Balance confirmed on" : "Entry date"} onChange={(value) => { setDate(value); setFieldErrors((current) => ({ ...current, date: undefined })); }} testID="ppf-entry-date" value={date} />
          </View>
          {type === "reconciliation" ? (
            <View onLayout={(event) => { fieldY.current.reason = event.nativeEvent.layout.y; }}>
              <FormTextField error={fieldErrors.reason} inputRef={reasonRef} label="Why are you correcting the balance?" multiline onChangeText={(value) => { setReason(value); setFieldErrors((current) => ({ ...current, reason: undefined })); }} placeholder="Matched India Post passbook" testID="ppf-entry-reason" value={reason} />
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: isNoteExpanded }}
            onPress={() => setIsNoteExpanded((expanded) => !expanded)}
            style={({ pressed }) => [
              styles.optionalToggle,
              pressed && styles.pressed,
            ]}
            testID="ppf-entry-note-toggle"
          >
            <AppText color="secondary" variant="caption" weight="bold">
              {isNoteExpanded ? "Hide note" : notes ? "Show note" : "Add note"}
            </AppText>
          </Pressable>
          {isNoteExpanded ? (
            <FormTextField label="Note (optional)" multiline onChangeText={setNotes} testID="ppf-entry-notes" value={notes} />
          ) : null}
        </PremiumCard>
        {type === "contribution" ? (
          <View style={styles.rulesDisclosure}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: areContributionRulesExpanded }}
              onPress={() =>
                setAreContributionRulesExpanded((expanded) => !expanded)
              }
              style={styles.rulesToggle}
              testID="ppf-contribution-rules-toggle"
            >
              <View style={styles.rulesCopy}>
                <AppText weight="medium">Contribution rules</AppText>
                <AppText color="secondary" variant="caption">
                  ₹500 minimum · ₹1.5 lakh maximum · multiples of ₹50
                </AppText>
              </View>
              <AppText color="secondary" variant="caption" weight="bold">
                {areContributionRulesExpanded ? "Hide" : "Why"}
              </AppText>
            </Pressable>
            {areContributionRulesExpanded ? (
              <AppText color="secondary" variant="caption" testID="ppf-contribution-rules-details">
                CogVest shows these limits as non-blocking tracked context. Confirm the official rules with your provider.
              </AppText>
            ) : null}
          </View>
        ) : null}
        {error ? <AppText selectable style={styles.error}>{error}</AppText> : null}
        <View style={styles.actions}>
          <AppButton
            onPress={() => {
              setError("");
              const entry = buildEntry();
              if (entry) setReviewEntry(entry);
            }}
            testID="review-ppf-entry"
            title="Review entry"
          />
          <AppButton onPress={requestBack} title="Cancel" variant="secondary" />
        </View>
        {existing ? (
          confirmDelete ? (
            <PremiumCard>
              <AppText weight="bold">Delete this ledger entry?</AppText>
              <AppText color="secondary" variant="caption">CogVest will reject deletion if later entries would make the balance invalid.</AppText>
              <AppButton
                onPress={() => {
                  const result = store.getState().deletePpfLedgerEntry(existing.id);
                  if (result.status === "applied") onComplete();
                  else setError("This entry cannot be removed without making the later balance inconsistent.");
                }}
                testID="confirm-delete-ppf-entry"
                title="Delete entry"
                variant="destructive"
              />
              <AppButton onPress={() => setConfirmDelete(false)} title="Keep entry" variant="secondary" />
            </PremiumCard>
          ) : (
            <AppButton onPress={() => setConfirmDelete(true)} title="Delete entry" variant="ghost" />
          )
        ) : null}
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

function entryLabel(type: EntryType) {
  if (type === "interestCredit") return "Official interest credit";
  if (type === "reconciliation") return "Balance correction";
  return type === "contribution" ? "Contribution" : "Withdrawal";
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <AppText color="secondary">{label}</AppText>
      <AppText style={styles.reviewValue} weight="bold">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  content: { gap: spacing.cardGap, paddingTop: spacing.sm },
  error: { color: colors.loss },
  flex: { flex: 1 },
  optionalToggle: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: interaction.minimumTouchTarget,
  },
  pressed: { opacity: interaction.pressedOpacity },
  reviewRow: { alignItems: "center", flexDirection: "row", gap: spacing.md, justifyContent: "space-between", minHeight: 48 },
  reviewValue: { flex: 1, textAlign: "right" },
  rulesCopy: { flex: 1, gap: spacing.xs },
  rulesDisclosure: { gap: spacing.xs },
  rulesToggle: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 48,
  },
});
