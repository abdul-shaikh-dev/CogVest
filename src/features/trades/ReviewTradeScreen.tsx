import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  EmptyState,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import { DatePickerField, FormTextField } from "@/src/components/forms";
import { getCalendarDatePart, isFutureCalendarDate } from "@/src/domain/dates";
import { formatINR } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, interaction, radii, spacing } from "@/src/theme";
import type { ConvictionScore } from "@/src/types";

type ReviewTradeScreenProps = {
  now?: Date;
  onCancel: () => void;
  onComplete: (message: string) => void;
  store?: StoreApi<PortfolioStoreState>;
  tradeId: string;
};

type Errors = Partial<Record<"conviction" | "date" | "fees" | "holdDays" | "price" | "quantity" | "save", string>>;
const convictionScores: ConvictionScore[] = [1, 2, 3, 4, 5];

function parsePositive(value: string) {
  const parsed = Number(value.trim());
  return value.trim() && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function failureMessage(reason?: string) {
  if (reason === "notFound") return "This transaction is no longer available.";
  if (reason === "insufficientCash") return "Cash available on this date is not enough for the corrected purchase.";
  if (reason === "oversold") return "This correction would sell more units than were held on that date.";
  if (reason === "inconsistentLink") return "The linked cash movement is inconsistent. The transaction was not changed.";
  if (reason === "assetMismatch" || reason === "typeMismatch") return "Transaction identity changed. Return to Holdings and try again.";
  return "This transaction could not be saved safely. Review it and try again.";
}

export function ReviewTradeScreen({
  now = new Date(),
  onCancel,
  onComplete,
  store = getPortfolioStore(),
  tradeId,
}: ReviewTradeScreenProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const currentTrade = snapshot.trades.find((item) => item.id === tradeId);
  const initialTradeRef = useRef(currentTrade);
  const trade = initialTradeRef.current;
  const asset = trade ? snapshot.assets.find((item) => item.id === trade.assetId) : undefined;
  const [quantity, setQuantity] = useState(() => trade ? String(trade.quantity) : "");
  const [price, setPrice] = useState(() => trade ? String(trade.pricePerUnit) : "");
  const [fees, setFees] = useState(() => trade?.fees !== undefined ? String(trade.fees) : "0");
  const [date, setDate] = useState(() => getCalendarDatePart(trade?.date ?? "") ?? "");
  const [notes, setNotes] = useState(() => trade?.notes ?? "");
  const [conviction, setConviction] = useState(() => trade?.conviction?.toString() ?? "");
  const [holdDays, setHoldDays] = useState(() => trade?.intendedHoldDays?.toString() ?? "");
  const [rationale, setRationale] = useState(() => trade?.whyThisTrade ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isRevealed, setIsRevealed] = useState(
    () => !snapshot.preferences.maskWealthValues,
  );
  const wasMaskingRef = useRef(snapshot.preferences.maskWealthValues);
  const actionInFlightRef = useRef(false);

  useLayoutEffect(() => {
    if (snapshot.preferences.maskWealthValues && !wasMaskingRef.current) {
      setIsRevealed(false);
    }
    wasMaskingRef.current = snapshot.preferences.maskWealthValues;
  }, [snapshot.preferences.maskWealthValues]);

  if (!currentTrade || !trade || !asset) {
    return (
      <ScreenContainer testID="review-trade-screen">
        <EmptyState
          actionLabel="Back to Holdings"
          message="It may have already been removed or its holding may have changed."
          title="Transaction unavailable"
          onAction={onCancel}
        />
      </ScreenContainer>
    );
  }

  const stableTrade = trade;
  const linkedCashEntry = snapshot.cashEntries.find(
    (entry) => entry.linkedTradeId === stableTrade.id,
  );

  if (!isRevealed) {
    return (
      <ScreenContainer testID="review-trade-screen">
        <View style={styles.content}>
          <ScreenHeader
            title="Review Transaction"
            subtitle={`${asset.name} · values masked`}
          />
          <PremiumCard>
            <SectionHeader title="Reveal to review" />
            <AppText color="secondary">
              Sensitive transaction values are hidden by your masking setting.
            </AppText>
            <AppButton
              title="Reveal transaction"
              testID="reveal-trade-button"
              onPress={() => setIsRevealed(true)}
            />
          </PremiumCard>
          <AppButton title="Back to Holdings" variant="secondary" onPress={onCancel} />
        </View>
      </ScreenContainer>
    );
  }

  const parsedQuantity = parsePositive(quantity);
  const parsedPrice = parsePositive(price);
  const parsedFees = fees.trim() === "" ? 0 : Number(fees);
  const previewTotal = parsedQuantity && parsedPrice && Number.isFinite(parsedFees)
    ? (parsedQuantity * parsedPrice) + (stableTrade.type === "buy" ? parsedFees : -parsedFees)
    : null;

  function validate() {
    const nextErrors: Errors = {};
    if (!parsedQuantity) nextErrors.quantity = "Quantity must be greater than zero.";
    if (!parsedPrice) nextErrors.price = "Price must be greater than zero.";
    if (!Number.isFinite(parsedFees) || parsedFees < 0) nextErrors.fees = "Fees cannot be negative.";
    if (!getCalendarDatePart(date)) nextErrors.date = "Choose a valid date.";
    else if (isFutureCalendarDate(date, now)) nextErrors.date = "Date cannot be in the future.";
    const parsedConviction = conviction.trim() === "" ? undefined : Number(conviction);
    if (parsedConviction !== undefined && (!Number.isInteger(parsedConviction) || parsedConviction < 1 || parsedConviction > 5)) {
      nextErrors.conviction = "Conviction must be between 1 and 5.";
    }
    const parsedHoldDays = holdDays.trim() === "" ? undefined : Number(holdDays);
    if (parsedHoldDays !== undefined && (!Number.isInteger(parsedHoldDays) || parsedHoldDays <= 0)) {
      nextErrors.holdDays = "Holding period must be a whole number of days.";
    }
    if (previewTotal !== null && previewTotal <= 0) nextErrors.fees = "Fees must be lower than sale proceeds.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !parsedQuantity || !parsedPrice) return null;
    return { parsedConviction, parsedFees, parsedHoldDays };
  }

  async function save() {
    if (actionInFlightRef.current) return;
    const valid = validate();
    if (!valid) return;
    actionInFlightRef.current = true;
    setIsSaving(true);
    let completed = false;
    try {
      const result = store.getState().correctTrade({
        ...stableTrade,
        conviction: valid.parsedConviction as ConvictionScore | undefined,
        date,
        fees: valid.parsedFees,
        intendedHoldDays: valid.parsedHoldDays,
        notes: notes.trim() || undefined,
        pricePerUnit: parsedPrice!,
        quantity: parsedQuantity!,
        whyThisTrade: rationale.trim() || undefined,
      });
      if (result.status === "rejected") {
        setErrors({ save: failureMessage(result.reason) });
        return;
      }
      await Promise.resolve();
      completed = true;
      onComplete(result.pendingMonths.length > 0
        ? "Transaction saved. Portfolio history will refresh automatically."
        : "Transaction saved. Portfolio and cash records updated.");
    } catch {
      setErrors({ save: failureMessage() });
    } finally {
      if (!completed) {
        actionInFlightRef.current = false;
        setIsSaving(false);
      }
    }
  }

  async function deleteTransaction() {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setIsSaving(true);
    let completed = false;
    try {
      const result = store.getState().deleteTrade(stableTrade.id);
      if (result.status === "rejected") {
        setErrors({ save: failureMessage(result.reason) });
        return;
      }
      await Promise.resolve();
      completed = true;
      onComplete(result.pendingMonths.length > 0
        ? "Transaction removed. Portfolio history will refresh automatically."
        : "Transaction removed. Portfolio and cash records updated.");
    } catch {
      setErrors({ save: "This transaction could not be removed safely. Try again." });
    } finally {
      if (!completed) {
        actionInFlightRef.current = false;
        setIsSaving(false);
      }
    }
  }

  return (
    <ScreenContainer scroll testID="review-trade-screen">
      <View style={styles.content}>
        <ScreenHeader title="Review Transaction" subtitle={`${asset.name} · local record`} />
        <PremiumCard>
          <SectionHeader title="Transaction identity" />
          <View style={styles.identityRow}>
            <View><AppText color="secondary" variant="caption">Holding</AppText><AppText weight="bold">{asset.name}</AppText></View>
            <View><AppText color="secondary" variant="caption">Type</AppText><AppText weight="bold">{trade.type === "buy" ? "Purchase" : "Sale"}</AppText></View>
          </View>
          <AppText color="secondary" variant="caption">Holding and transaction type stay fixed so linked records remain trustworthy.</AppText>
        </PremiumCard>
        <PremiumCard>
          <SectionHeader title="Transaction details" />
          <View style={styles.row}>
            <View style={styles.flex}><FormTextField error={errors.quantity} keyboardType="decimal-pad" label="Quantity" onChangeText={setQuantity} testID="trade-correction-quantity-input" value={quantity} /></View>
            <View style={styles.flex}><FormTextField error={errors.price} keyboardType="decimal-pad" label="Price per unit" onChangeText={setPrice} testID="trade-correction-price-input" value={price} /></View>
          </View>
          <FormTextField error={errors.fees} keyboardType="decimal-pad" label="Fees" onChangeText={setFees} testID="trade-correction-fees-input" value={fees} />
          <DatePickerField error={errors.date} label="Transaction date" maximumDate={now} onChange={setDate} testID="trade-correction-date-input" value={date} />
          <FormTextField label="Notes" multiline onChangeText={setNotes} testID="trade-correction-notes-input" value={notes} />
        </PremiumCard>
        <PremiumCard elevated>
          <AppText color="secondary" variant="caption">Corrected total</AppText>
          <AppText variant="title" weight="bold">{previewTotal === null ? "Not available" : formatINR(previewTotal)}</AppText>
          <AppText color="secondary" variant="caption">Calculated from quantity, price, and fees.</AppText>
        </PremiumCard>
        <PremiumCard>
          <SectionHeader title="Investment context (optional)" />
          <View style={styles.convictionRow}>
            {convictionScores.map((score) => {
              const selected = conviction === String(score);
              return <Pressable accessibilityLabel={`Conviction ${score}`} accessibilityRole="button" accessibilityState={{ selected }} key={score} onPress={() => setConviction(selected ? "" : String(score))} style={({ pressed }) => [styles.convictionChip, selected && styles.convictionChipActive, pressed && styles.pressed]} testID={`trade-correction-conviction-${score}`}><AppText color={selected ? "inverse" : "secondary"} weight="bold">{score}</AppText></Pressable>;
            })}
          </View>
          {errors.conviction ? <AppText style={styles.errorText} variant="caption">{errors.conviction}</AppText> : null}
          <FormTextField error={errors.holdDays} keyboardType="number-pad" label="Intended holding period (days)" onChangeText={setHoldDays} value={holdDays} />
          <FormTextField label="Why this investment?" multiline onChangeText={setRationale} value={rationale} />
        </PremiumCard>
        {errors.save ? <AppText accessibilityLiveRegion="polite" selectable style={styles.errorText} variant="caption">{errors.save}</AppText> : null}
        <View style={styles.actions}>
          <AppButton disabled={isSaving} title="Cancel" variant="secondary" onPress={onCancel} />
          <AppButton accessibilityState={{ busy: isSaving, disabled: isSaving }} disabled={isSaving} title={isSaving ? "Saving..." : "Save changes"} testID="save-trade-correction-button" onPress={save} />
        </View>
        <PremiumCard>
          <SectionHeader title="Remove transaction" />
          <AppText color="secondary" variant="caption">
            {linkedCashEntry
              ? "Its linked cash funding or sale proceeds will be removed at the same time."
              : "No cash movement is linked to this legacy transaction."}
          </AppText>
          {isConfirmingDelete ? (
            <View style={styles.deleteConfirmation}>
              <AppText weight="bold">Remove this transaction?</AppText>
              <AppText color="secondary" variant="caption">Portfolio totals and automatic history will be recalculated. This cannot be undone.</AppText>
              <View style={styles.actions}>
                <AppButton disabled={isSaving} title="Keep transaction" variant="secondary" onPress={() => setIsConfirmingDelete(false)} />
                <AppButton disabled={isSaving} title={isSaving ? "Removing..." : "Remove transaction"} variant="destructive" testID="confirm-delete-trade-button" onPress={deleteTransaction} />
              </View>
            </View>
          ) : <AppButton title="Remove transaction" variant="ghost" testID="delete-trade-button" onPress={() => setIsConfirmingDelete(true)} />}
        </PremiumCard>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" },
  content: { gap: spacing.lg, paddingVertical: spacing.lg },
  convictionChip: { alignItems: "center", backgroundColor: colors.surface.elevated, borderRadius: radii.button, flex: 1, justifyContent: "center", minHeight: interaction.minimumTouchTarget },
  convictionChipActive: { backgroundColor: colors.primary },
  convictionRow: { flexDirection: "row", gap: spacing.sm },
  deleteConfirmation: { backgroundColor: colors.surface.elevated, borderRadius: radii.button, gap: spacing.sm, padding: spacing.md },
  errorText: { color: colors.loss },
  flex: { flex: 1 },
  identityRow: { flexDirection: "row", gap: spacing.xl, justifyContent: "space-between" },
  pressed: { opacity: interaction.pressedOpacity },
  row: { flexDirection: "row", gap: spacing.sm },
});
