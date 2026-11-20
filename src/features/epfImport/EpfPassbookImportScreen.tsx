import { StyleSheet, View } from "react-native";

import {
  AppButton,
  AppText,
  IconButton,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  SensitiveValueReveal,
  useSensitiveValueReveal,
} from "@/src/components/common";
import { FormTextField, SelectionField } from "@/src/components/forms";
import { formatINR } from "@/src/domain/formatters";
import { readEpfPassbookFile } from "@/src/services/import-export/epfPassbookImport";
import { getPortfolioStore } from "@/src/store";
import { createThemedStyles, interaction, spacing } from "@/src/theme";
import { balanceChange, defaultChoice, NEW_ACCOUNT, targetOptions } from "./epfPassbookImportViewModel";
import { useEpfPassbookImport, type EpfPassbookImportDeps } from "./useEpfPassbookImport";

type Props = Partial<Pick<EpfPassbookImportDeps, "now" | "store" | "readPassbook">> & Pick<EpfPassbookImportDeps, "pickPassbooks"> & {
  onBack: () => void;
  onComplete: (accountId: string) => void;
};

/** Imports EPFO Member Passbook PDFs, read on the device and checked before anything is saved (#740). */
export function EpfPassbookImportScreen({ now = new Date(), store = getPortfolioStore(), readPassbook = (source) => readEpfPassbookFile({ source }),
  pickPassbooks, onBack, onComplete }: Props) {
  const styles = useStyles();
  const state = useEpfPassbookImport({ now, store, pickPassbooks, readPassbook });
  const { isRevealed, reveal } = useSensitiveValueReveal(state.maskWealthValues);
  const { grouped, review } = state;

  if (review) {
    const { view } = review;
    return (
      <ScreenContainer scroll testID="epf-import-review-screen">
        <View style={styles.content}>
          <ScreenHeader leading={<IconButton accessibilityLabel="Back to passbooks" icon="arrow-back" onPress={state.closeReview} />}
            subtitle="Nothing is saved until you confirm" title="Review import" />
          {!isRevealed ? (
            <PremiumCard><SensitiveValueReveal onReveal={reveal} testID="reveal-epf-import" /></PremiumCard>
          ) : null}
          {view.accounts.map((account, index) => (
            <PremiumCard key={account.id} section testID={`epf-import-account-${index}`}>
              <SectionHeader title={account.nickname} />
              {account.isNew ? <AppText color="secondary" variant="caption">New EPF account</AppText> : null}
              {isRevealed ? (
                <Line label="Balance" testID={`epf-import-account-${index}-balance`} value={balanceChange(account.balance)} />
              ) : null}
              {account.years.map((year) => (
                <View key={year.key}>
                  <Line label={year.label} value={year.status} />
                  {year.message ? <AppText color="secondary" variant="caption">{year.message}</AppText> : null}
                </View>
              ))}
              <AppText color="secondary" testID={`epf-import-account-${index}-changes`} variant="caption">
                {[account.added ? `${account.added} ${account.added === 1 ? "entry" : "entries"} added` : null,
                  ...account.updated.map((label) => `Updated: ${label}`),
                  ...account.removed.map((label) => `Replaced: ${label}`)].filter(Boolean).join(". ") || "No changes."}
              </AppText>
              {account.startingBalanceMoved ? (
                <AppText color="secondary" variant="caption">Its starting balance moves to the first passbook&apos;s opening balance.</AppText>
              ) : null}
              {account.excludedPension > 0 && isRevealed ? (
                <AppText color="secondary" variant="caption">
                  {formatINR(account.excludedPension)} pension (EPS) contributions are left out. CogVest doesn&apos;t value EPS.
                </AppText>
              ) : null}
            </PremiumCard>
          ))}
          {isRevealed ? (
            <Line label="All EPF" testID="epf-import-total"
              value={`${view.total.before === null ? "—" : formatINR(view.total.before)} → ${view.total.after === null ? "—" : formatINR(view.total.after)}`} />
          ) : null}
          {view.warnings.length ? (
            <PremiumCard testID="epf-import-warnings">
              <AppText weight="bold">Check before saving</AppText>
              {view.warnings.map((warning) => <AppText color="secondary" key={warning} variant="caption">{warning}</AppText>)}
            </PremiumCard>
          ) : null}
          {state.saveError ? <AppText selectable style={styles.error} testID="epf-import-save-error">{state.saveError}</AppText> : null}
          <View style={styles.actions}>
            {view.nothingChanges ? (
              <AppText testID="epf-import-nothing-changes">These passbooks are already imported. Nothing changes.</AppText>
            ) : (
              <AppButton onPress={() => state.save(onComplete)} testID="save-epf-import" title="Save import" />
            )}
            <AppButton onPress={state.closeReview} title="Back to passbooks" variant="secondary" />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll testID="epf-import-screen">
      <View style={styles.content}>
        <ScreenHeader leading={<IconButton accessibilityLabel="Back" icon="arrow-back" onPress={onBack} />}
          subtitle="EPFO member passbooks, read on this phone" title="Import EPF passbooks" />
        <PremiumCard section>
          <AppText color="secondary">
            Download each year&apos;s Member Passbook PDF from the EPFO member portal, then choose them all. CogVest reads them on
            this phone, checks every total, and saves nothing until you confirm.
          </AppText>
          <AppText color="secondary" variant="caption">
            Your name, date of birth and UAN aren&apos;t read. The member ID is used only to match years and is never saved.
          </AppText>
          <AppButton disabled={state.reading} onPress={state.addFiles} testID="choose-epf-passbooks"
            title={state.reading ? "Reading passbooks…" : state.files.length ? "Add more passbooks" : "Choose passbook PDFs"}
            variant={state.files.length ? "secondary" : "primary"} />
        </PremiumCard>

        {grouped.rejected.length ? (
          <PremiumCard testID="epf-import-rejected">
            <AppText weight="bold">Not read</AppText>
            {grouped.rejected.map((file) => (
              <View key={file.key} style={styles.fileRow}>
                <View style={styles.flex}>
                  <AppText>{file.name}</AppText>
                  <AppText color="secondary" variant="caption">{file.message}</AppText>
                </View>
                <AppButton onPress={() => state.removeFile(file.key)} title="Remove" variant="ghost" />
              </View>
            ))}
          </PremiumCard>
        ) : null}

        {grouped.groups.map((group, index) => {
          const choice = state.choices[group.memberId] ?? defaultChoice(group);
          const fileKeys = state.files.filter((file) => file.result.ok && file.result.passbook.memberId === group.memberId).map((file) => file.key);
          return (
            <PremiumCard key={group.memberId} section testID={`epf-import-member-${index}`}>
              <SectionHeader title={group.label} />
              <AppText color="secondary" variant="caption">{group.years.join(", ")}</AppText>
              <SelectionField label="Import into" onChange={(value) => state.choose(group.memberId, { target: value })}
                options={targetOptions(state.accounts, state.choices, group.memberId)}
                testIDPrefix={`epf-import-member-${index}-target`} value={choice.target} />
              {choice.target === NEW_ACCOUNT ? (
                <FormTextField error={state.choiceErrors[group.memberId]} label="New account nickname"
                  onChangeText={(value) => state.choose(group.memberId, { nickname: value })}
                  testID={`epf-import-member-${index}-nickname`} value={choice.nickname} />
              ) : state.choiceErrors[group.memberId] ? (
                <AppText style={styles.error} variant="caption">{state.choiceErrors[group.memberId]}</AppText>
              ) : null}
              <AppButton onPress={() => fileKeys.forEach(state.removeFile)} title="Remove these passbooks" variant="ghost" />
            </PremiumCard>
          );
        })}

        {state.problems.length ? (
          <PremiumCard testID="epf-import-problems">
            <AppText weight="bold">These passbooks can&apos;t be imported yet</AppText>
            {state.problems.map((problem) => <AppText key={problem} selectable style={styles.error}>{problem}</AppText>)}
          </PremiumCard>
        ) : null}
        <View style={styles.actions}>
          <AppButton disabled={!grouped.groups.length || state.reading} onPress={state.startReview} testID="review-epf-import" title="Review import" />
          <AppButton onPress={onBack} title="Cancel" variant="secondary" />
        </View>
      </View>
    </ScreenContainer>
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
  fileRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
  line: { alignItems: "center", columnGap: spacing.md, flexDirection: "row", flexWrap: "wrap",
    justifyContent: "space-between", minHeight: interaction.minimumTouchTarget },
}));
