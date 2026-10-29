import { useEffect, useState, useSyncExternalStore } from "react";
import { BackHandler, KeyboardAvoidingView, StyleSheet, View } from "react-native";
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
  useSensitiveValueReveal,
} from "@/src/components/common";
import { DatePickerField, FormTextField, SelectionField } from "@/src/components/forms";
import { formatINR } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing, createThemedStyles } from "@/src/theme";
import { createId } from "@/src/utils";

import {
  buildPayoutInput,
  canRecordPayouts,
  draftFromDistribution,
  draftNet,
  emptyPayoutDraft,
  payoutEffectCopy,
  payoutRejectionMessage,
  payoutTreatmentOptions,
  reinvestmentBuyOptions,
  type PayoutDraft,
  type PayoutFieldErrors,
} from "./payoutForm";

export function PayoutEntryScreen({ assetId, distributionId, now = new Date(), onBack, onComplete, store = getPortfolioStore() }: {
  assetId: string;
  distributionId?: string;
  now?: Date;
  onBack: () => void;
  onComplete: (message: string) => void;
  store?: StoreApi<PortfolioStoreState>;
}) {
  const styles = useStyles();
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const { isRevealed, reveal } = useSensitiveValueReveal(snapshot.preferences.maskWealthValues);
  const existing = distributionId ? snapshot.distributions.find((item) => item.id === distributionId) : undefined;
  const asset = snapshot.assets.find((item) => item.id === (existing?.assetId ?? assetId));
  const [initial] = useState(() => (existing ? draftFromDistribution(existing) : emptyPayoutDraft(now)));
  const [draft, setDraft] = useState<PayoutDraft>(initial);
  const [errors, setErrors] = useState<PayoutFieldErrors>({});
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<"exit" | "delete">();
  const [id] = useState(() => existing?.id ?? createId("payout"));
  const isDirty = JSON.stringify(draft) !== JSON.stringify(initial);

  function requestBack() {
    if (confirm) { setConfirm(undefined); return; }
    if (isDirty) { setConfirm("exit"); return; }
    onBack();
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      requestBack();
      return true;
    });
    return () => subscription.remove();
  }, [confirm, isDirty]);

  if (!asset || !canRecordPayouts(asset) || (distributionId && !existing)) {
    return (
      <ScreenContainer testID="payout-entry-screen">
        <EmptyState actionLabel="Back" message="It may have already been removed on another screen."
          onAction={onBack} title="Payout unavailable" />
      </ScreenContainer>
    );
  }
  if (!isRevealed) {
    return (
      <ScreenContainer testID="payout-entry-screen">
        <View style={styles.content}>
          <ScreenHeader title={existing ? "Payout" : "Add payout"} subtitle={`${asset.name} · values masked`} />
          <PremiumCard><SensitiveValueReveal onReveal={reveal} testID="reveal-payout-entry" /></PremiumCard>
          <AppButton onPress={onBack} title="Back" variant="secondary" />
        </View>
      </ScreenContainer>
    );
  }

  const buyOptions = reinvestmentBuyOptions(snapshot.trades, asset.id, draft.paidOn, snapshot.distributions, existing?.id);
  const net = draftNet(draft);

  function update<Key extends keyof PayoutDraft>(key: Key, value: PayoutDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key as keyof PayoutFieldErrors];
      return next;
    });
  }

  function save() {
    setMessage("");
    const result = buildPayoutInput(draft, { assetId: asset!.id, id, now });
    if (!result.ok) { setErrors(result.errors); return; }
    const outcome = store.getState().saveDistribution(result.input);
    if (outcome.status === "rejected") { setMessage(payoutRejectionMessage(outcome.reason)); return; }
    onComplete(existing ? "Payout updated." : "Payout recorded.");
  }

  if (confirm === "exit") {
    return (
      <ScreenContainer scroll testID="payout-entry-exit-confirmation">
        <View style={styles.content}>
          <ScreenHeader title="Discard this payout?" subtitle="What you entered will not be saved" />
          <View style={styles.actions}>
            <AppButton onPress={() => setConfirm(undefined)} testID="keep-editing-payout" title="Keep editing" />
            <AppButton onPress={onBack} testID="discard-payout" title="Discard payout" variant="destructive" />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <KeyboardAvoidingView behavior="height" style={styles.flex}>
      <ScreenContainer scroll testID="payout-entry-screen">
        <View style={styles.content}>
          <ScreenHeader
            leading={<IconButton accessibilityLabel="Back" icon="arrow-back" onPress={requestBack} />}
            subtitle={asset.name}
            title={existing ? "Payout" : "Add payout"}
          />
          <PremiumCard section style={styles.formSection}>
            <DatePickerField error={errors.paidOn} label="Paid on" maximumDate={now}
              onChange={(value) => update("paidOn", value)} testID="payout-paid-on" value={draft.paidOn} />
            <FormTextField error={errors.gross} keyboardType="decimal-pad" label="Payout before tax (INR)"
              onChangeText={(value) => update("gross", value)} testID="payout-gross-input" value={draft.gross} />
            <FormTextField error={errors.tax} keyboardType="decimal-pad" label="Tax withheld (INR, optional)"
              onChangeText={(value) => update("tax", value)} testID="payout-tax-input" value={draft.tax} />
            <AppText color="secondary" testID="payout-net" weight="bold">
              {net === null ? "After tax: —" : `After tax: ${formatINR(net)}`}
            </AppText>
          </PremiumCard>
          <PremiumCard section style={styles.formSection}>
            <SelectionField label="Where did it go?" onChange={(value) => update("treatment", value)}
              options={payoutTreatmentOptions} testIDPrefix="payout-treatment" value={draft.treatment} />
            {draft.treatment === "reinvested" ? (
              buyOptions.length === 0 ? (
                <AppText style={errors.linkedTradeId ? styles.error : undefined} testID="payout-no-reinvest-buy">
                  Record the purchase this payout paid for first. It must be on or after the pay date.
                </AppText>
              ) : (
                <>
                  <SelectionField label="Purchase it paid for" onChange={(value) => update("linkedTradeId", value)}
                    options={buyOptions} testIDPrefix="payout-reinvest-buy" value={draft.linkedTradeId} />
                  {errors.linkedTradeId ? <AppText style={styles.error} variant="caption">{errors.linkedTradeId}</AppText> : null}
                </>
              )
            ) : null}
            <AppText color="secondary" variant="caption" testID="payout-effect">{payoutEffectCopy(draft)}</AppText>
          </PremiumCard>
          {message ? <AppText selectable style={styles.error} testID="payout-error">{message}</AppText> : null}
          <View style={styles.actions}>
            <AppButton onPress={save} testID="save-payout" title={existing ? "Save changes" : "Save payout"} />
            <AppButton onPress={requestBack} title="Cancel" variant="secondary" />
          </View>
          {existing ? (
            confirm === "delete" ? (
              <PremiumCard testID="delete-payout-confirmation">
                <AppText weight="bold">Delete this payout?</AppText>
                <AppText color="secondary" variant="caption">
                  {existing.linkedCashEntryId ? "Its Cash addition is removed too. " : ""}
                  Use this for a payout recorded by mistake.
                </AppText>
                <View style={styles.actions}>
                  <AppButton onPress={() => {
                    const outcome = store.getState().deleteDistribution(existing.id);
                    if (outcome.status === "rejected") { setMessage(payoutRejectionMessage(outcome.reason)); setConfirm(undefined); return; }
                    onComplete("Payout deleted.");
                  }} testID="confirm-delete-payout" title="Delete payout" variant="destructive" />
                  <AppButton onPress={() => setConfirm(undefined)} title="Keep payout" variant="secondary" />
                </View>
              </PremiumCard>
            ) : (
              <AppButton onPress={() => setConfirm("delete")} testID="delete-payout" title="Delete payout" variant="ghost" />
            )
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
  formSection: { paddingVertical: spacing.sm },
}));
