import { useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  AppButton,
  AppText,
  IconButton,
  MaskedValue,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import { formatINR } from "@/src/domain/formatters";
import type { PpfMergePlan, PpfMergeRow, PpfMergeStatus } from "@/src/domain/ppfCsvMerge";
import { spacing, createThemedStyles } from "@/src/theme";

import { Checkbox, Summary } from "./ppfImportParts";

const rowsPerPage = 50;

export const mergeStatusLabels: Record<PpfMergeStatus, string> = {
  beforeOpening: "Before your opening balance",
  differs: "Differs from your records",
  new: "New",
  recorded: "Already recorded",
};

const rowTypeLabels = { contribution: "Contribution", interest: "Interest credited", withdrawal: "Withdrawal" } as const;

/** "Add 3 entries", "Add 1 entry and correct 2", "Correct 1 entry". */
export function mergeSaveLabel(added: number, corrected: number) {
  const entries = (count: number) => `${count} ${count === 1 ? "entry" : "entries"}`;
  if (added && corrected) return `Add ${entries(added)} and correct ${corrected}`;
  return added ? `Add ${entries(added)}` : `Correct ${entries(corrected)}`;
}

/** Where the error is, for example "Row 4, amount" or "Columns". */
function errorPlace(rowNumber?: number, column?: string) {
  if (rowNumber) return `Row ${rowNumber}${column ? `, ${column}` : ""}: `;
  return column ? "Columns: " : "";
}

/**
 * Review of a CogVest PPF CSV against the account's existing entries (#748).
 * Nothing is saved until the user presses the save button; differing rows keep
 * the user's amount unless they tick "Use the file's amount".
 */
export function PpfMergePreview({
  accountName,
  error,
  isSaving,
  masked,
  onBack,
  onSave,
  onToggleFileAmount,
  plan,
  useFileAmounts,
}: {
  accountName: string;
  error?: string;
  isSaving: boolean;
  masked: boolean;
  onBack: () => void;
  onSave: (confirmDuplicateRows: boolean) => void;
  onToggleFileAmount: (rowNumber: number) => void;
  plan: PpfMergePlan;
  useFileAmounts: ReadonlySet<number>;
}) {
  const styles = useStyles();
  const [confirmDuplicateRows, setConfirmDuplicateRows] = useState(false);
  const [visibleRows, setVisibleRows] = useState(rowsPerPage);
  const changes = plan.additions.length + plan.corrections.length;
  const blocked = plan.errors.length > 0;
  const differing = plan.rows.filter((item) => item.status === "differs");

  return (
    <ScreenContainer key="merge-preview" scroll testID="ppf-merge-preview-screen">
      <View style={styles.content}>
        <ScreenHeader
          leading={<IconButton accessibilityLabel="Back to PPF import" icon="arrow-back" onPress={onBack} testID="ppf-merge-back" />}
          subtitle={`${accountName} • no changes saved yet`}
          title="Review PPF file"
        />
        {blocked ? (
          <PremiumCard section>
            <SectionHeader title="Fix the file first" />
            <AppText color="secondary" variant="caption">Nothing will be saved. Every problem CogVest found:</AppText>
            {plan.errors.map((item, index) => (
              <AppText key={`${item.rowNumber ?? "file"}-${item.column ?? ""}-${index}`} style={styles.error} testID="ppf-merge-error">
                {errorPlace(item.rowNumber, item.column)}{item.message}
              </AppText>
            ))}
            {plan.firstRows?.length ? (
              <View style={styles.firstRows} testID="ppf-merge-first-rows">
                <AppText color="secondary" variant="caption">The first rows, as CogVest read them:</AppText>
                {plan.firstRows.map((cells, index) => (
                  <AppText key={index} variant="caption">{cells.join(" | ")}</AppText>
                ))}
              </View>
            ) : null}
          </PremiumCard>
        ) : (
          <PremiumCard section>
            <SectionHeader title="What saving does" />
            <View style={styles.summaryGrid} testID="ppf-merge-counts">
              {(["new", "recorded", "differs", "beforeOpening"] as const).map((status) => (
                <Summary key={status} label={mergeStatusLabels[status]} testID={`ppf-merge-count-${status}`} value={String(plan.counts[status])} />
              ))}
            </View>
            <AppText color="secondary" variant="caption">
              New rows are added. Rows already in your records, and rows your opening balance already includes, are skipped.
              Your other entries are not changed.
            </AppText>
          </PremiumCard>
        )}

        {plan.warnings.length ? (
          <PremiumCard section>
            <SectionHeader title="Check these" />
            {plan.warnings.map((warning) => (
              <AppText key={warning} testID="ppf-merge-warning" variant="caption">{warning}</AppText>
            ))}
          </PremiumCard>
        ) : null}

        {differing.length ? (
          <PremiumCard section>
            <SectionHeader title="Differs from your records" />
            <AppText color="secondary" variant="caption">
              Same type on or near the same date, another amount. Your amount is kept unless you choose the file&apos;s.
            </AppText>
            {differing.map((item) => (
              <DifferingRow
                checked={useFileAmounts.has(item.row.rowNumber)}
                item={item}
                key={item.row.rowNumber}
                masked={masked}
                onToggle={() => onToggleFileAmount(item.row.rowNumber)}
              />
            ))}
          </PremiumCard>
        ) : null}

        {plan.years.length ? (
          <PremiumCard section>
            <SectionHeader title="By financial year, once saved" />
            {plan.years.map((year) => (
              <View key={year.financialYearStart} style={styles.year} testID={`ppf-merge-year-${year.financialYearStart}`}>
                <AppText weight="bold">FY {year.financialYearStart}-{String(year.financialYearStart + 1).slice(-2)}</AppText>
                <View style={styles.summaryGrid}>
                  <Summary label="Deposits" masked={masked} value={year.contributions} />
                  <Summary label="Interest" masked={masked} value={year.interest} />
                  <Summary label="Withdrawals" masked={masked} value={year.withdrawals} />
                  <Summary label="Closing balance" masked={masked} value={year.closing} />
                </View>
              </View>
            ))}
          </PremiumCard>
        ) : null}

        {plan.duplicateRows > 0 ? (
          <PremiumCard>
            <AppText weight="bold">Repeated rows</AppText>
            <AppText color="secondary" variant="caption">
              {plan.duplicateRows} new rows repeat another row exactly. They are added only if they are separate deposits.
            </AppText>
            <Checkbox
              checked={confirmDuplicateRows}
              label="These repeated rows are separate transactions"
              onPress={() => setConfirmDuplicateRows((value) => !value)}
              testID="ppf-merge-confirm-duplicates"
            />
          </PremiumCard>
        ) : null}

        {plan.rows.length ? (
          <PremiumCard section>
            <SectionHeader title={`File rows (${plan.rows.length})`} />
            {plan.rows.slice(0, visibleRows).map((item) => (
              <View key={item.row.rowNumber} style={styles.row} testID={`ppf-merge-row-${item.row.rowNumber}`}>
                <View style={styles.rowDetails}>
                  <AppText>{item.row.date} · {rowTypeLabels[item.row.type]}</AppText>
                  <AppText color="secondary" variant="caption">{mergeStatusLabels[item.status]}</AppText>
                </View>
                <MaskedValue masked={masked} value={formatINR(item.row.amount)} weight="bold" />
              </View>
            ))}
            {visibleRows < plan.rows.length ? (
              <AppButton
                onPress={() => setVisibleRows((value) => value + rowsPerPage)}
                testID="ppf-merge-show-more"
                title={`Show next ${Math.min(rowsPerPage, plan.rows.length - visibleRows)} rows`}
                variant="secondary"
              />
            ) : null}
          </PremiumCard>
        ) : null}

        {!blocked && changes === 0 ? (
          <AppText testID="ppf-merge-nothing-new" weight="bold">Nothing to add: every row is already in your records.</AppText>
        ) : null}
        {error ? <AppText accessibilityRole="alert" style={styles.error} testID="ppf-merge-save-error">{error}</AppText> : null}
        <View style={styles.actions}>
          <AppButton
            disabled={blocked || changes === 0 || isSaving || (plan.duplicateRows > 0 && !confirmDuplicateRows)}
            onPress={() => onSave(confirmDuplicateRows)}
            testID="ppf-merge-save"
            title={isSaving ? "Saving..." : changes ? mergeSaveLabel(plan.additions.length, plan.corrections.length) : "Nothing to add"}
          />
          <AppButton disabled={isSaving} onPress={onBack} testID="ppf-merge-cancel" title="Back" variant="secondary" />
        </View>
      </View>
    </ScreenContainer>
  );
}

function DifferingRow({ checked, item, masked, onToggle }: {
  checked: boolean;
  item: PpfMergeRow;
  masked: boolean;
  onToggle: () => void;
}) {
  const styles = useStyles();
  const yours = item.existing && "amount" in item.existing ? item.existing.amount : 0;
  return (
    <View style={styles.differs} testID={`ppf-merge-differs-${item.row.rowNumber}`}>
      <AppText weight="bold">{item.row.date} · {rowTypeLabels[item.row.type]}</AppText>
      <View style={styles.summaryGrid}>
        <Summary
          label={item.existing && item.existing.date !== item.row.date ? `Your records (${item.existing.date})` : "Your records"}
          masked={masked}
          value={yours}
        />
        <Summary label="File" masked={masked} value={item.row.amount} />
      </View>
      {item.locked ? (
        <AppText color="secondary" variant="caption">
          This entry is linked to Cash, so it can only be changed from the entry itself.
        </AppText>
      ) : (
        <Checkbox
          checked={checked}
          label="Use the file's amount"
          onPress={onToggle}
          testID={`ppf-merge-use-file-${item.row.rowNumber}`}
        />
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  actions: { gap: spacing.sm },
  content: { gap: spacing.cardGap, paddingTop: spacing.sm },
  differs: { borderTopColor: colors.border.subtle, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.xs, paddingTop: spacing.sm },
  error: { color: colors.loss },
  firstRows: { gap: spacing.xs },
  row: {
    alignItems: "flex-start", borderBottomColor: colors.border.subtle, borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row", gap: spacing.sm, justifyContent: "space-between", minHeight: 48, paddingVertical: spacing.sm,
  },
  rowDetails: { flexShrink: 1, gap: spacing.xs, minWidth: 0 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  year: { gap: spacing.xs },
}));
