import { useState, useSyncExternalStore } from "react";
import { KeyboardAvoidingView, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  IconButton,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SensitiveValueReveal,
  useSensitiveValueReveal,
} from "@/src/components/common";
import { DatePickerField, FormTextField, SelectionField } from "@/src/components/forms";
import { formatDate, formatINR } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing, createThemedStyles } from "@/src/theme";

import {
  basisKindOptions,
  basisStatus,
  buildBasisInput,
  draftTotal,
  initialBasisDraft,
  tradesWithoutCash,
  type BasisDraft,
} from "./measurementBasisForm";

/** Where the whole-portfolio return starts (D9), and the trade funding it needs (D10). */
export function MeasurementBasisScreen({ now = new Date(), onBack, store = getPortfolioStore() }: {
  now?: Date;
  onBack: () => void;
  store?: StoreApi<PortfolioStoreState>;
}) {
  const styles = useStyles();
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const { isRevealed, reveal } = useSensitiveValueReveal(snapshot.preferences.maskWealthValues);
  const [draft, setDraft] = useState<BasisDraft>(() => initialBasisDraft(snapshot, now));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmMark, setConfirmMark] = useState(false);
  const basis = snapshot.measurementBasis;
  const status = basisStatus(snapshot);
  const trades = tradesWithoutCash(snapshot, draft.startDate, draft.kind);
  const total = draftTotal(draft);

  const update = (next: Partial<BasisDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setError("");
    setMessage("");
  };
  const updateLine = (key: string, field: "label" | "value", value: string) =>
    update({ lines: draft.lines.map((line) => (line.key === key ? { ...line, [field]: value } : line)) });

  function save() {
    const built = buildBasisInput(draft);
    if (!built.ok) { setError(built.error); return; }
    const result = store.getState().setMeasurementBasis(built.input);
    if (result.status === "rejected") { setError(result.problems[0] ?? "Check the start date and values."); return; }
    setMessage("Start confirmed.");
  }

  function markTrades() {
    const result = store.getState().setTradeFundingSource(trades.unmarked, "external");
    setConfirmMark(false);
    if (result.status === "rejected") { setError("Some of these trades changed. Reopen this screen and try again."); return; }
    setMessage(`${trades.unmarked.length} ${trades.unmarked.length === 1 ? "trade" : "trades"} marked as paid from outside CogVest.`);
  }

  if (!isRevealed) {
    return (
      <ScreenContainer testID="measurement-basis-screen">
        <View style={styles.content}>
          <ScreenHeader title="Whole-portfolio start" subtitle="Values masked" />
          <PremiumCard><SensitiveValueReveal onReveal={reveal} testID="reveal-measurement-basis" /></PremiumCard>
          <AppButton onPress={onBack} title="Back" variant="secondary" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <KeyboardAvoidingView behavior="height" style={styles.flex}>
      <ScreenContainer scroll testID="measurement-basis-screen">
        <View style={styles.content}>
          <ScreenHeader
            leading={<IconButton accessibilityLabel="Back" icon="arrow-back" onPress={onBack} />}
            subtitle="Where the whole-portfolio return is measured from"
            title="Whole-portfolio start"
          />
          {basis ? (
            <PremiumCard testID="measurement-basis-current">
              <AppText testID="measurement-basis-start" weight="bold">
                {basis.kind === "inception"
                  ? `Since ${formatDate(basis.startDate)}`
                  : `From ${formatDate(basis.startDate)} · ${formatINR(basis.openingValueInr ?? 0)}`}
              </AppText>
              <AppText color={status === "needsConfirming" ? undefined : "secondary"} style={status === "needsConfirming" ? styles.warning : undefined}
                testID="measurement-basis-status" variant="caption">
                {status === "needsConfirming"
                  ? "Records on or before the start changed. Check the values and confirm again."
                  : `Confirmed ${formatDate(basis.confirmedAt.slice(0, 10))}.`}
              </AppText>
            </PremiumCard>
          ) : null}
          <PremiumCard section style={styles.formSection}>
            <SelectionField
              helperText={draft.kind === "inception"
                ? "Use this when CogVest holds every record from your first investment."
                : "Use this when earlier history isn't recorded. Enter what everything was worth at the end of the start date."}
              label="Measure"
              onChange={(kind) => update({ kind })}
              options={[...basisKindOptions]}
              testIDPrefix="basis-kind"
              value={draft.kind}
            />
            <DatePickerField label="Start date" maximumDate={now} onChange={(startDate) => update({ startDate })}
              testID="basis-start-date" value={draft.startDate} />
          </PremiumCard>
          {draft.kind === "openingValue" ? (
            <PremiumCard section style={styles.formSection} testID="basis-opening-lines">
              <AppText weight="bold">Value at the end of {formatDate(draft.startDate)}</AppText>
              <AppText color="secondary" variant="caption">
                Include every account CogVest tracks: holdings, Cash, PPF, EPF and Futures.
              </AppText>
              {draft.lines.map((line, index) => (
                <View key={line.key} style={styles.line}>
                  <FormTextField label="Account or holding" onChangeText={(value) => updateLine(line.key, "label", value)}
                    testID={`basis-line-label-${index}`} value={line.label} />
                  <FormTextField keyboardType="decimal-pad" label="Value (INR)" onChangeText={(value) => updateLine(line.key, "value", value)}
                    testID={`basis-line-value-${index}`} value={line.value} />
                  {draft.lines.length > 1 ? (
                    <AppButton onPress={() => update({ lines: draft.lines.filter((item) => item.key !== line.key) })}
                      title="Remove line" variant="ghost" />
                  ) : null}
                </View>
              ))}
              <AppButton onPress={() => update({ lines: [...draft.lines, { key: `line-${Date.now()}`, label: "", value: "" }] })}
                testID="basis-add-line" title="Add a line" variant="secondary" />
              <AppText testID="basis-total" weight="bold">{total === null ? "Total: —" : `Total: ${formatINR(total)}`}</AppText>
            </PremiumCard>
          ) : null}
          {error ? <AppText selectable style={styles.error} testID="basis-error">{error}</AppText> : null}
          {message ? <AppText testID="basis-message">{message}</AppText> : null}
          <AppButton onPress={save} testID="save-basis" title={basis ? "Confirm again" : "Confirm start"} />
          <PremiumCard section testID="basis-trade-funding">
            <AppText weight="bold">Trades without a Cash record</AppText>
            <AppText color="secondary" testID="basis-trade-funding-count" variant="caption">
              {trades.unmarked.length === 0
                ? trades.marked.length ? `${trades.marked.length} marked as paid from outside CogVest.` : "None in this period."
                : `${trades.unmarked.length} in this period ${trades.unmarked.length === 1 ? "isn't" : "aren't"} linked to Cash. If they were paid from a bank or broker account outside CogVest, mark them so.`}
            </AppText>
            {trades.unmarked.length ? (
              confirmMark ? (
                <View style={styles.actions}>
                  <AppText variant="caption">
                    Only mark them if the money didn't come from, or go to, CogVest Cash. Otherwise it is counted twice.
                  </AppText>
                  <AppButton onPress={markTrades} testID="basis-confirm-mark-external" title="Mark as paid from outside" />
                  <AppButton onPress={() => setConfirmMark(false)} title="Cancel" variant="secondary" />
                </View>
              ) : (
                <AppButton onPress={() => setConfirmMark(true)} testID="basis-mark-external" title="Mark as paid from outside" variant="secondary" />
              )
            ) : null}
            {trades.marked.length ? (
              <AppButton onPress={() => { store.getState().setTradeFundingSource(trades.marked, null); setMessage("Marks cleared."); }}
                testID="basis-clear-external" title="Clear marks" variant="ghost" />
            ) : null}
          </PremiumCard>
          {basis ? (
            <AppButton onPress={() => { store.getState().setMeasurementBasis(null); setMessage("Start removed."); }}
              testID="remove-basis" title="Remove start" variant="ghost" />
          ) : null}
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  actions: { gap: spacing.sm },
  content: { gap: spacing.cardGap, paddingTop: spacing.sm },
  error: { color: colors.loss },
  flex: { flex: 1 },
  formSection: { gap: spacing.sm, paddingVertical: spacing.sm },
  line: { gap: spacing.xs },
  warning: { color: colors.warning },
}));
