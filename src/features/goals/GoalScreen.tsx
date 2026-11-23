import { useMemo, useState } from "react";
import { KeyboardAvoidingView, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  IconButton,
  MASKED_INR_VALUE,
  MaskedValue,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
} from "@/src/components/common";
import { DatePickerField, FormTextField, MoneyField, SelectionField } from "@/src/components/forms";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { formatCompactINR, formatDate, formatINR } from "@/src/domain/formatters";
import { maxSavingsGoalReturnPct } from "@/src/domain/savingsGoals";
import { EpfCheckRow } from "@/src/features/epf/EpfCheckRow";
import { usePortfolioFields } from "@/src/hooks";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing, createThemedStyles } from "@/src/theme";
import { createId } from "@/src/utils";

import { buildGoalInput, goalDraftFrom, toggleId, type GoalDraft, type GoalDraftErrors } from "./goalForm";
import { buildSavingsGoalValueSources } from "./goalValueSources";
import { formatEstimateINR, goalStatusText, monthsLeftText, reachedText } from "./goalViewModel";
import { useSavingsGoals } from "./useSavingsGoals";

const scopeOptions = [
  { label: "Whole portfolio", value: "portfolio" },
  { label: "Chosen holdings and accounts", value: "selected" },
] as const;
const latestTargetDate = new Date(2100, 11, 31);

/** One savings goal (#767): its progress, and the form that creates or edits it. */
export function GoalScreen({ goalId, now = new Date(), onBack, store = getPortfolioStore() }: {
  goalId?: string;
  now?: Date;
  onBack: () => void;
  store?: StoreApi<PortfolioStoreState>;
}) {
  const styles = useStyles();
  const today = formatLocalCalendarDate(now);
  const { goals, maskWealthValues } = useSavingsGoals({ now, store });
  const view = goals.find((item) => item.goal.id === goalId);
  const records = usePortfolioFields(store, [
    "assets", "cashEntries", "epf", "futuresAccounts", "openingPositions", "ppfAccounts", "ppfLedgerEntries", "quoteCache", "trades",
  ]);
  const [id] = useState(() => goalId ?? createId("goal"));
  const [draft, setDraft] = useState<GoalDraft>(() => goalDraftFrom(view?.goal));
  const [errors, setErrors] = useState<GoalDraftErrors>({});
  const [message, setMessage] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const choices = useMemo(() => {
    const sources = buildSavingsGoalValueSources(records, now);
    const names = new Map(records.assets.map((asset) => [asset.id, asset.name]));
    const held = [...sources.holdingValuesInr.keys(), ...sources.nonInrAssetIds];
    const removed = draft.assetIds.filter((assetId) => !held.includes(assetId));
    return {
      epf: records.epf.accounts.map((account) => ({ id: account.id, label: account.nickname })),
      holdings: [
        ...held.map((assetId) => ({
          helper: sources.nonInrAssetIds.has(assetId) ? "Not in INR, so not counted" : undefined,
          id: assetId,
          label: names.get(assetId) ?? assetId,
        })),
        ...removed.map((assetId) => ({ helper: "No longer held, so not counted", id: assetId, label: names.get(assetId) ?? "Removed holding" })),
      ],
      ppf: records.ppfAccounts.map((account) => ({ id: account.id, label: account.nickname })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the calendar day (today), not the per-render Date.
  }, [records, draft.assetIds, today]);

  const update = (next: Partial<GoalDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setErrors({});
    setMessage("");
  };

  function save() {
    const built = buildGoalInput(draft, { id, savedTargetDate: view?.goal.targetDate, today });
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    const result = store.getState().saveSavingsGoal(built.input);
    if (result.status === "rejected") {
      setMessage(result.reason === "limit" ? "You can keep up to 20 goals." : "Check the goal details.");
      return;
    }
    onBack();
  }

  function remove() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    store.getState().deleteSavingsGoal(id);
    onBack();
  }

  const progress = view?.progress;
  return (
    <KeyboardAvoidingView behavior="height" style={styles.flex}>
      <ScreenContainer scroll testID="goal-screen">
        <View style={styles.content}>
          <ScreenHeader
            leading={<IconButton accessibilityLabel="Back" icon="arrow-back" onPress={onBack} />}
            subtitle={view ? `Target ${formatDate(view.goal.targetDate)}` : "A target amount by a date"}
            title={view ? view.goal.name : "New goal"}
          />
          {view && progress ? (
            <PremiumCard testID="goal-summary">
              {progress.currentValueInr === null ? (
                <AppText color="secondary">Waiting for prices</AppText>
              ) : (
                <MaskedValue
                  exactValue={formatINR(progress.currentValueInr)}
                  masked={maskWealthValues}
                  testID="goal-summary-value"
                  value={formatCompactINR(progress.currentValueInr)}
                  variant="title"
                  weight="bold"
                />
              )}
              <AppText color="secondary">
                {reachedText(progress)} · {monthsLeftText(progress.monthsLeft)}
              </AppText>
              <AppText testID="goal-summary-status">{goalStatusText(view.goal, progress, maskWealthValues)}</AppText>
              {progress.status === "inProgress" && progress.projectedValueInr !== null ? (
                <AppText color="secondary" testID="goal-summary-projection" variant="caption">
                  {`At ${view.goal.assumedAnnualReturnPct}% a year, today's value grows to about `}
                  {maskWealthValues ? MASKED_INR_VALUE : formatEstimateINR(progress.projectedValueInr)}
                  {` by ${formatDate(view.goal.targetDate)} without more investment.`}
                </AppText>
              ) : null}
              {progress.excludedNonInrCount > 0 ? (
                <AppText color="secondary" variant="caption">
                  {progress.excludedNonInrCount === 1 ? "1 chosen holding is" : `${progress.excludedNonInrCount} chosen holdings are`} not in INR and not counted.
                </AppText>
              ) : null}
              {progress.missingItemCount > 0 ? (
                <AppText color="secondary" variant="caption">
                  {progress.missingItemCount === 1 ? "1 chosen item is" : `${progress.missingItemCount} chosen items are`} no longer held and not counted.
                </AppText>
              ) : null}
              {view.overlaps ? (
                <AppText color="secondary" variant="caption">
                  Shares holdings with another goal, so the same money counts toward both.
                </AppText>
              ) : null}
            </PremiumCard>
          ) : null}

          <PremiumCard section style={styles.form}>
            <FormTextField error={errors.name} label="Goal name" onChangeText={(name) => update({ name })}
              placeholder="House, retirement" testID="goal-name" value={draft.name} />
            <MoneyField currency="INR" error={errors.targetAmount} label="Target amount"
              onChangeText={(targetAmount) => update({ targetAmount })} testID="goal-target-amount" value={draft.targetAmount} />
            <DatePickerField error={errors.targetDate} label="Target date" maximumDate={latestTargetDate}
              openAt={new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())} onChange={(targetDate) => update({ targetDate })} testID="goal-target-date" value={draft.targetDate} />
            <FormTextField error={errors.assumedReturn} keyboardType="decimal-pad" label="Assumed yearly return (%)"
              onChangeText={(assumedReturn) => update({ assumedReturn })} testID="goal-return" value={draft.assumedReturn} />
            <AppText color="secondary" variant="caption">
              {`Your own assumption, from 0% to ${maxSavingsGoalReturnPct}%. CogVest does not suggest one.`}
            </AppText>
          </PremiumCard>

          <PremiumCard section style={styles.form}>
            <SelectionField
              helperText={draft.scopeKind === "portfolio"
                ? "Counts the portfolio value shown on the Dashboard."
                : "Counts only what you tick below."}
              label="Counts toward this goal"
              onChange={(scopeKind) => update({ scopeKind })}
              options={scopeOptions}
              testIDPrefix="goal-scope"
              value={draft.scopeKind}
            />
            {draft.scopeKind === "selected" ? (
              <View testID="goal-scope-items">
                <EpfCheckRow checked={draft.includeCash} label="Cash" onToggle={() => update({ includeCash: !draft.includeCash })}
                  testID="goal-scope-cash" />
                {choices.holdings.map((item) => (
                  <EpfCheckRow checked={draft.assetIds.includes(item.id)} helper={item.helper} key={item.id} label={item.label}
                    onToggle={() => update({ assetIds: toggleId(draft.assetIds, item.id) })} testID={`goal-scope-asset-${item.id}`} />
                ))}
                {choices.ppf.map((item) => (
                  <EpfCheckRow checked={draft.ppfAccountIds.includes(item.id)} helper="PPF" key={item.id} label={item.label}
                    onToggle={() => update({ ppfAccountIds: toggleId(draft.ppfAccountIds, item.id) })} testID={`goal-scope-ppf-${item.id}`} />
                ))}
                {choices.epf.map((item) => (
                  <EpfCheckRow checked={draft.epfAccountIds.includes(item.id)} helper="EPF" key={item.id} label={item.label}
                    onToggle={() => update({ epfAccountIds: toggleId(draft.epfAccountIds, item.id) })} testID={`goal-scope-epf-${item.id}`} />
                ))}
                {errors.scope ? <AppText style={styles.error} testID="goal-scope-error" variant="caption">{errors.scope}</AppText> : null}
              </View>
            ) : null}
          </PremiumCard>

          <AppText color="secondary" variant="caption">
            Estimates use today&apos;s values and your assumed return, in today&apos;s rupees with no inflation adjustment.
            They are not a promise or advice. Holdings not in INR are not counted.
          </AppText>
          {message ? <AppText style={styles.error} testID="goal-message">{message}</AppText> : null}
          <AppButton onPress={save} testID="goal-save" title={view ? "Save changes" : "Save goal"} />
          {view ? (
            <AppButton
              onPress={remove}
              testID="goal-delete"
              title={confirmingDelete ? "Tap again to delete this goal" : "Delete goal"}
              variant="secondary"
            />
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
  form: { gap: spacing.sm, paddingVertical: spacing.sm },
}));
