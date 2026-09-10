import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BackHandler, Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  EmptyState,
  IconButton,
  MaskedValue,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import { DatePickerField, FormTextField } from "@/src/components/forms";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { formatINR } from "@/src/domain/formatters";
import { getFinancialYearStart } from "@/src/domain/ppf";
import {
  planPpfCsvImport,
  type PpfCsvImportInput,
  type PpfCsvImportPlan,
} from "@/src/domain/ppfCsvImport";
import { ppfCsvMaxBytes } from "@/src/domain/ppfCsv";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, spacing } from "@/src/theme";
import type { PpfLedgerEntry } from "@/src/types";

type PickedPpfCsv = { name: string; size: number; text: string };

type PpfImportScreenProps = {
  accountId: string;
  onCancel: () => void;
  onImported: (accountId: string) => void;
  pickCsvFile: () => Promise<PickedPpfCsv | undefined>;
  saveCsvTemplate: () => Promise<string | undefined>;
  store?: StoreApi<PortfolioStoreState>;
  now?: () => Date;
};

const rowsPerPage = 50;

export function PpfImportScreen({
  accountId,
  onCancel,
  onImported,
  pickCsvFile,
  saveCsvTemplate,
  store = getPortfolioStore(),
  now = () => new Date(),
}: PpfImportScreenProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const account = snapshot.ppfAccounts.find((item) => item.id === accountId);
  const today = formatLocalCalendarDate(now());
  const [csv, setCsv] = useState<string>();
  const [fileName, setFileName] = useState<string>();
  const [openingBalance, setOpeningBalance] = useState(
    account ? String(account.confirmedBalance) : "",
  );
  const [balanceAsOf, setBalanceAsOf] = useState(account?.balanceAsOf ?? today);
  const [baselineContribution, setBaselineContribution] = useState(
    String(account?.baselineFinancialYearContributions?.amount ?? ""),
  );
  const [expectedClosingBalance, setExpectedClosingBalance] = useState("");
  const [completeThroughToday, setCompleteThroughToday] = useState(false);
  const [preview, setPreview] = useState<PpfCsvImportPlan>();
  const [previewInput, setPreviewInput] = useState<PpfCsvImportInput>();
  const [confirmDuplicateRows, setConfirmDuplicateRows] = useState(false);
  const [confirmReplacement, setConfirmReplacement] = useState(false);
  const [visibleRows, setVisibleRows] = useState(rowsPerPage);
  const [error, setError] = useState<string>();
  const [fileError, setFileError] = useState<string>();
  const [templateStatus, setTemplateStatus] = useState<string>();
  const [isPicking, setIsPicking] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const mounted = useRef(true);
  const pickingInFlight = useRef(false);
  const templateSaveInFlight = useRef(false);

  useEffect(() => {
    // Strict Mode replays effects, so each mounted lifetime must re-enable guards.
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (preview) {
        setPreview(undefined);
        setPreviewInput(undefined);
        return true;
      }
      onCancel();
      return true;
    });
    return () => subscription.remove();
  }, [onCancel, preview]);

  if (!account) {
    return (
      <ScreenContainer testID="ppf-import-screen">
        <EmptyState
          actionLabel="Back"
          message="This PPF account is no longer available."
          onAction={onCancel}
          title="PPF import unavailable"
        />
      </ScreenContainer>
    );
  }

  const financialYear = getFinancialYearStart(balanceAsOf);
  const masked = snapshot.preferences.maskWealthValues;
  const busy = isPicking || isSavingTemplate || isSaving;

  function buildInput(): PpfCsvImportInput | undefined {
    if (!csv) {
      setError("Choose a CSV statement before creating a preview.");
      return undefined;
    }
    if (!openingBalance.trim() || !baselineContribution.trim()) {
      setError("Enter the opening balance and contributions already included in this financial year. Enter 0 only when none are included.");
      return undefined;
    }
    const expected = expectedClosingBalance.trim();
    return {
      accountId,
      csv,
      openingBalance: Number(openingBalance),
      balanceAsOf,
      baselineFyContribution: Number(baselineContribution),
      completeThrough: completeThroughToday ? today : "",
      ...(expected ? { expectedClosingBalance: Number(expected) } : {}),
    };
  }

  function createPreview() {
    const input = buildInput();
    if (!input) return;
    const next = planPpfCsvImport(input, snapshot.ppfAccounts, snapshot.ppfLedgerEntries, now());
    setPreview(next);
    setPreviewInput(input);
    setConfirmDuplicateRows(false);
    setConfirmReplacement(false);
    setVisibleRows(rowsPerPage);
    setError(next.errors[0]?.message);
  }

  function changeBalanceAsOf(value: string) {
    setBalanceAsOf(value);
    // The included-contributions amount belongs to the selected financial year.
    setBaselineContribution("");
    setCompleteThroughToday(false);
    setPreview(undefined);
    setPreviewInput(undefined);
  }

  async function chooseCsv() {
    if (busy || pickingInFlight.current) return;
    pickingInFlight.current = true;
    setIsPicking(true);
    setFileError(undefined);
    setError(undefined);
    try {
      const file = await pickCsvFile();
      if (!mounted.current || !file) return;
      if (file.size > ppfCsvMaxBytes) {
        setFileError("CSV must be 256 KiB or smaller.");
        return;
      }
      setCsv(file.text);
      setFileName(file.name);
      setPreview(undefined);
      setPreviewInput(undefined);
    } catch {
      if (mounted.current) setFileError("The CSV could not be read. Check access and try again.");
    } finally {
      pickingInFlight.current = false;
      if (mounted.current) setIsPicking(false);
    }
  }

  async function saveTemplate() {
    if (busy || templateSaveInFlight.current) return;
    templateSaveInFlight.current = true;
    setIsSavingTemplate(true);
    setTemplateStatus(undefined);
    try {
      const name = await saveCsvTemplate();
      if (mounted.current && name) setTemplateStatus(`${name} saved. Replace the example rows before importing.`);
    } catch {
      if (mounted.current) setTemplateStatus("The template could not be saved. Choose another folder and try again.");
    } finally {
      templateSaveInFlight.current = false;
      if (mounted.current) setIsSavingTemplate(false);
    }
  }

  function saveImport() {
    if (!preview || !previewInput || preview.errors.length || isSaving) return;
    if (preview.duplicateRows > 0 && !confirmDuplicateRows) {
      setError("Confirm that repeated CSV rows are separate transactions before saving.");
      return;
    }
    if (preview.requiresReplacement && !confirmReplacement) {
      setError("Confirm replacement of the existing PPF checkpoint and ledger before saving.");
      return;
    }
    setIsSaving(true);
    setError(undefined);
    try {
      const result = store.getState().importPpfCsv({
        input: previewInput,
        expectedState: preview.expectedState,
        confirmDuplicateRows,
        confirmReplacement,
      });
      if (result.status === "applied" || result.status === "alreadyApplied") {
        onImported(accountId);
      } else if ("reason" in result) {
        setError(result.reason);
      }
    } catch {
      setError("The import could not be saved. Your PPF records are unchanged. Generate a fresh preview and try again.");
    } finally {
      if (mounted.current) setIsSaving(false);
    }
  }

  if (preview && previewInput) {
    return (
      <ScreenContainer key="preview" scroll testID="ppf-import-preview-screen">
        <View style={styles.content}>
          <ScreenHeader
            leading={<IconButton accessibilityLabel="Back to PPF import form" icon="arrow-back" onPress={() => { setPreview(undefined); setPreviewInput(undefined); }} testID="ppf-import-preview-back" />}
            subtitle={`${account.nickname} • no changes saved yet`}
            title="Review PPF history"
          />
          <PremiumCard elevated>
            <SectionHeader title="Balance summary" />
            {preview.summary && hasFiniteSummary(preview.summary) ? (
              <View style={styles.summaryGrid}>
                <Summary label="Existing balance" masked={masked} value={preview.summary.previousClosing} />
                <Summary label="Imported closing balance" masked={masked} value={preview.summary.closing} />
                <Summary label="Opening balance" masked={masked} value={preview.summary.opening} />
                <Summary label="Prior ledger entries" value={String(preview.summary.previousEntries)} />
                <Summary label="Contributions" masked={masked} value={preview.summary.contributions} />
                <Summary label="Interest credited" masked={masked} value={preview.summary.interest} />
                <Summary label="Withdrawals" masked={masked} value={preview.summary.withdrawals} />
                <Summary
                  label="Contributions included at start"
                  masked={masked}
                  value={previewInput.baselineFyContribution}
                />
              </View>
            ) : null}
            <View style={styles.checkpointDates}>
              <AppText color="secondary" variant="caption">Previous checkpoint: {account.balanceAsOf}</AppText>
              <AppText color="secondary" testID="ppf-import-proposed-checkpoint-date" variant="caption">Proposed checkpoint: {previewInput.balanceAsOf}</AppText>
              <AppText color="secondary" testID="ppf-import-complete-through-date" variant="caption">History complete through: {previewInput.completeThrough}</AppText>
            </View>
            <AppText color="secondary" variant="caption">
              Preview only. Saving replaces this account's imported checkpoint and ledger only after confirmation.
            </AppText>
          </PremiumCard>

          {preview.errors.map((item, index) => (
            <AppText key={`${item.rowNumber ?? "form"}-${index}`} style={styles.error} testID="ppf-import-preview-error" weight="bold">
              {item.rowNumber ? `Row ${item.rowNumber}: ` : ""}{item.message}
            </AppText>
          ))}
          {preview.duplicateRows > 0 ? (
            <PremiumCard>
              <AppText weight="bold">Repeated rows retained</AppText>
              <AppText color="secondary" variant="caption">
                {preview.duplicateRows} repeated row{preview.duplicateRows === 1 ? " is" : "s are"} retained because they may be separate transactions.
              </AppText>
              <Checkbox
                checked={confirmDuplicateRows}
                label="I confirm these repeated rows are separate transactions"
                onPress={() => setConfirmDuplicateRows((value) => !value)}
                testID="ppf-import-confirm-duplicates"
              />
            </PremiumCard>
          ) : null}
          {preview.requiresReplacement ? (
            <PremiumCard>
              <AppText weight="bold">Replace existing PPF history?</AppText>
              <AppText color="secondary" variant="caption">
                This replaces this account's checkpoint and ledger with the reviewed CSV. It does not merge records.
              </AppText>
              <Checkbox
                checked={confirmReplacement}
                label="I understand this replaces the existing checkpoint and ledger"
                onPress={() => setConfirmReplacement((value) => !value)}
                testID="ppf-import-confirm-replacement"
              />
            </PremiumCard>
          ) : null}

          <PremiumCard>
            <SectionHeader title={`CSV rows (${preview.entries.length})`} />
            {preview.entries.slice(0, visibleRows).map((entry, index) => (
              <View key={entry.id} style={styles.row} testID={`ppf-import-row-${index}`}>
                <View style={styles.rowDetails}>
                  <AppText>{entry.date} · {friendlyEntryType(entry.type)}</AppText>
                  {entry.notes ? <AppText color="secondary" style={styles.notes} variant="caption">{entry.notes}</AppText> : null}
                </View>
                <MaskedValue masked={masked} value={formatINR(entry.type === "reconciliation" ? entry.confirmedBalance : entry.amount)} weight="bold" />
              </View>
            ))}
            {visibleRows < preview.entries.length ? (
              <AppButton
                onPress={() => setVisibleRows((value) => Math.min(value + rowsPerPage, preview.entries.length))}
                testID="ppf-import-show-more-rows"
                title={`Show next ${Math.min(rowsPerPage, preview.entries.length - visibleRows)} rows`}
                variant="secondary"
              />
            ) : null}
          </PremiumCard>
          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          <View style={styles.actions}>
            <AppButton disabled={preview.errors.length > 0 || isSaving} onPress={saveImport} testID="ppf-import-save" title={isSaving ? "Saving import..." : "Save PPF import"} />
            <AppButton disabled={isSaving} onPress={() => setPreview(undefined)} title="Edit import" variant="secondary" />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer key="form" scroll testID="ppf-import-screen">
      <View style={styles.content}>
        <ScreenHeader
          leading={<IconButton accessibilityLabel="Back to PPF account" icon="arrow-back" onPress={onCancel} testID="ppf-import-back" />}
          subtitle="CSV ledger import • local only"
          title="Import PPF history"
        />
        <PremiumCard>
          <SectionHeader title={account.nickname} />
          <AppText color="secondary" variant="caption">The CSV will apply only to this PPF account.</AppText>
          <AppText color="secondary" variant="caption">
            Columns: date, type, amount, note. Use contribution, interest or withdrawal,
            positive INR amounts without commas, and YYYY-MM-DD dates. Up to 1,000 rows.
          </AppText>
          <AppButton disabled={busy} onPress={chooseCsv} testID="ppf-import-choose-csv" title={isPicking ? "Choosing CSV..." : fileName ? "Choose another CSV" : "Choose CSV"} />
          <AppButton disabled={busy} onPress={saveTemplate} testID="ppf-import-save-template" title={isSavingTemplate ? "Saving template..." : "Save CSV template"} variant="secondary" />
          {fileName ? <AppText color="secondary" variant="caption">Selected: {fileName}</AppText> : null}
          {fileError ? <AppText accessibilityLiveRegion="polite" style={styles.error} testID="ppf-import-file-error">{fileError}</AppText> : null}
          {templateStatus ? <AppText color="secondary" testID="ppf-import-template-status" variant="caption">{templateStatus}</AppText> : null}
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Opening checkpoint" />
          <FormTextField keyboardType="decimal-pad" label="Opening balance (INR)" onChangeText={setOpeningBalance} testID="ppf-import-opening-balance" value={openingBalance} />
          <DatePickerField label="Opening balance as of" maximumDate={now()} onChange={changeBalanceAsOf} testID="ppf-import-balance-as-of" value={balanceAsOf} />
          <FormTextField
            keyboardType="decimal-pad"
            label={`Contributions already included in FY ${financialYear}-${String(financialYear + 1).slice(-2)} (INR)`}
            onChangeText={setBaselineContribution}
            testID="ppf-import-baseline-contribution"
            value={baselineContribution}
          />
          <AppText color="secondary" variant="caption">
            Enter 0 only when this opening balance includes no contributions in the selected financial year through the opening balance date.
          </AppText>
          <AppText color="secondary" variant="caption">
            Use your bank's official value date. For example, interest credited in April may have a 31 March value date.
          </AppText>
          <FormTextField keyboardType="decimal-pad" label="Expected closing balance (optional, INR)" onChangeText={setExpectedClosingBalance} testID="ppf-import-expected-closing" value={expectedClosingBalance} />
        </PremiumCard>

        <PremiumCard>
          <Checkbox
            checked={completeThroughToday}
            label="Every transaction after this opening balance through today is included"
            onPress={() => setCompleteThroughToday((value) => !value)}
            testID="ppf-import-complete-through-today"
          />
          <AppText color="secondary" variant="caption">
            Replace every template example row with your official records. A reviewed import replaces, rather than appends to, this account's imported PPF checkpoint and ledger.
          </AppText>
        </PremiumCard>
        {error ? <AppText style={styles.error} testID="ppf-import-error">{error}</AppText> : null}
        <View style={styles.actions}>
          <AppButton disabled={busy} onPress={createPreview} testID="ppf-import-preview" title="Preview PPF import" />
          <AppButton disabled={busy} onPress={onCancel} title="Cancel" variant="secondary" />
        </View>
      </View>
    </ScreenContainer>
  );
}

function Checkbox({ checked, label, onPress, testID }: { checked: boolean; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={styles.checkbox} testID={testID}>
      <AppText color={checked ? "primary" : "secondary"} weight="bold">{checked ? "✓" : "○"}</AppText>
      <AppText style={styles.checkboxText}>{label}</AppText>
    </Pressable>
  );
}

function Summary({ label, masked = false, value }: { label: string; masked?: boolean; value: number | string }) {
  const display = typeof value === "number" ? formatINR(value) : value;
  return (
    <View style={styles.summaryItem}>
      <AppText color="secondary" variant="caption">{label}</AppText>
      <MaskedValue masked={masked} value={display} weight="bold" />
    </View>
  );
}

function hasFiniteSummary(summary: NonNullable<PpfCsvImportPlan["summary"]>) {
  return [summary.opening, summary.contributions, summary.interest, summary.withdrawals, summary.closing, summary.previousClosing]
    .every(Number.isFinite);
}

function friendlyEntryType(type: PpfLedgerEntry["type"]) {
  if (type === "interestCredit") return "Interest credited";
  if (type === "contribution") return "Contribution";
  if (type === "withdrawal") return "Withdrawal";
  return "Balance reconciliation";
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  checkbox: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm, minHeight: 48 },
  checkboxText: { flex: 1 },
  content: { gap: spacing.cardGap, paddingTop: spacing.sm },
  error: { color: colors.loss },
  checkpointDates: { gap: spacing.xs },
  notes: { flexShrink: 1 },
  row: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between", minHeight: 36 },
  rowDetails: { flex: 1, gap: spacing.xs },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  summaryItem: { minWidth: "42%" },
});
