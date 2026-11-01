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
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { formatDate, formatINR } from "@/src/domain/formatters";
import { automaticMeasurementBasis } from "@/src/domain/wholePortfolioXirr";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing, createThemedStyles } from "@/src/theme";

import {
  basisKindOptions,
  basisStatus,
  buildBasisInput,
  draftTotal,
  initialBasisDraft,
  snapshotStarts,
  type BasisDraft,
} from "./measurementBasisForm";

/** Where the portfolio return starts (D9): the user's choice, or automatically the earliest snapshot (#610). */
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
  const [snapshotId, setSnapshotId] = useState("none");
  const snapshots = snapshotStarts(snapshot.monthlySnapshots, formatLocalCalendarDate(now));
  const snapshotOptions = [{ label: "Enter values myself", value: "none" }, ...snapshots.map((item) => ({ label: item.label, value: item.id }))];
  const basis = snapshot.measurementBasis;
  const status = basisStatus(snapshot);
  const automatic = basis ? null : automaticMeasurementBasis(snapshot.monthlySnapshots, formatLocalCalendarDate(now));
  const total = draftTotal(draft);

  const update = (next: Partial<BasisDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setError("");
    setMessage("");
  };
  const updateLine = (key: string, field: "label" | "value", value: string) => {
    setSnapshotId("none");
    update({ lines: draft.lines.map((line) => (line.key === key ? { ...line, [field]: value } : line)) });
  };
  const fillFromSnapshot = (id: string) => {
    setSnapshotId(id);
    const chosen = snapshots.find((item) => item.id === id);
    if (chosen) update({ startDate: chosen.startDate, lines: chosen.lines });
  };

  function save() {
    const built = buildBasisInput(draft);
    if (!built.ok) { setError(built.error); return; }
    const result = store.getState().setMeasurementBasis(built.input);
    if (result.status === "rejected") { setError(result.problems[0] ?? "Check the start date and values."); return; }
    setMessage("Start confirmed.");
  }

  if (!isRevealed) {
    return (
      <ScreenContainer testID="measurement-basis-screen">
        <View style={styles.content}>
          <ScreenHeader title="Return start" subtitle="Values masked" />
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
            subtitle="Where the portfolio return is measured from"
            title="Return start"
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
          ) : (
            <PremiumCard testID="measurement-basis-automatic">
              <AppText testID="measurement-basis-start" weight="bold">
                {automatic
                  ? `Automatic: from ${formatDate(automatic.startDate)} · ${formatINR(automatic.openingValueInr ?? 0)}`
                  : "Automatic: no month-end snapshot yet"}
              </AppText>
              <AppText color="secondary" variant="caption">
                {automatic
                  ? "Your earliest month-end snapshot. Set a start below only to measure from somewhere else."
                  : "Save a month-end snapshot in Progress, or set a start below."}
              </AppText>
            </PremiumCard>
          )}
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
            <DatePickerField label="Start date" maximumDate={now} onChange={(startDate) => { setSnapshotId("none"); update({ startDate }); }}
              testID="basis-start-date" value={draft.startDate} />
          </PremiumCard>
          {draft.kind === "openingValue" ? (
            <PremiumCard section style={styles.formSection} testID="basis-opening-lines">
              <AppText weight="bold">Value at the end of {formatDate(draft.startDate)}</AppText>
              <AppText color="secondary" variant="caption">
                Include every account CogVest tracks: holdings, Cash, PPF, EPF and Futures.
              </AppText>
              {snapshots.length ? (
                <SelectionField
                  helperText={snapshotId === "none"
                    ? "A stored month-end value can start the period at that month's last day."
                    : "Filled from the stored month-end value. Check it covers every account before confirming."}
                  label="Fill from a month-end snapshot"
                  onChange={fillFromSnapshot}
                  options={snapshotOptions}
                  testIDPrefix="basis-snapshot"
                  value={snapshotId}
                />
              ) : null}
              {draft.lines.map((line, index) => (
                <View key={line.key} style={styles.line}>
                  <FormTextField label="Account or holding" onChangeText={(value) => updateLine(line.key, "label", value)}
                    testID={`basis-line-label-${index}`} value={line.label} />
                  <FormTextField keyboardType="decimal-pad" label="Value (INR)" onChangeText={(value) => updateLine(line.key, "value", value)}
                    testID={`basis-line-value-${index}`} value={line.value} />
                  {draft.lines.length > 1 ? (
                    <AppButton onPress={() => { setSnapshotId("none"); update({ lines: draft.lines.filter((item) => item.key !== line.key) }); }}
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
          <AppButton onPress={save} testID="save-basis" title={basis ? "Confirm again" : "Use this start"} />
          {basis ? (
            <AppButton onPress={() => { store.getState().setMeasurementBasis(null); setMessage("Using the automatic start."); }}
              testID="remove-basis" title="Use automatic start" variant="secondary" />
          ) : null}
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  content: { gap: spacing.cardGap, paddingTop: spacing.sm },
  error: { color: colors.loss },
  flex: { flex: 1 },
  formSection: { gap: spacing.sm, paddingVertical: spacing.sm },
  line: { gap: spacing.xs },
  warning: { color: colors.warning },
}));
